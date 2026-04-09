import { createClient } from "https://esm.sh/@supabase/supabase-js@2.102.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_PHONE = "201152956791";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      phone, name, message, whatsapp_message_id,
      media_url, media_type,
      push_name, profile_pic_url, whatsapp_about,
    } = body;

    if (!phone || (!message && !media_url)) {
      return new Response(JSON.stringify({ error: "phone and (message or media_url) required" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    const contactData: any = {
      phone,
      name: name || push_name || phone,
      last_message_at: new Date().toISOString(),
    };
    if (push_name) contactData.whatsapp_name = push_name;
    if (profile_pic_url) contactData.whatsapp_avatar_url = profile_pic_url;
    if (whatsapp_about) contactData.whatsapp_about = whatsapp_about;

    const { data: contact } = await supabase
      .from("contacts")
      .upsert(contactData, { onConflict: "phone" })
      .select()
      .single();

    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("contact_id", contact.id)
      .in("status", ["new", "open", "waiting"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({ contact_id: contact.id, status: "new", is_ai_active: true })
        .select()
        .single();
      conversation = newConv;
    }

    // === AUTO-REACTIVATE AI ===
    if (!conversation.is_ai_active) {
      const lastMsgTime = conversation.last_message_at ? new Date(conversation.last_message_at).getTime() : 0;
      const now = Date.now();
      const minsSinceLastMsg = (now - lastMsgTime) / (1000 * 60);
      
      if (minsSinceLastMsg >= 10) {
        console.log(`Auto-reactivating AI for conversation ${conversation.id} (${minsSinceLastMsg.toFixed(0)}min since last msg)`);
        await supabase.from("conversations")
          .update({ is_ai_active: true, status: "open" })
          .eq("id", conversation.id);
        conversation.is_ai_active = true;
        conversation.status = "open";
      } else {
        console.log(`AI inactive for conversation ${conversation.id}, skipping (${minsSinceLastMsg.toFixed(0)}min since last msg, need 10min)`);
      }
    }

    const msgContent = message || (media_type === "image" ? "صورة" : media_type === "audio" ? "رسالة صوتية" : "ملف");
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      content: msgContent,
      direction: "in",
      sender_type: "customer",
      whatsapp_message_id,
      media_url: media_url || null,
      media_type: media_type || null,
    });

    await supabase
      .from("conversations")
      .update({
        last_message: msgContent,
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count || 0) + 1,
        status: conversation.status === "new" ? "open" : conversation.status,
      })
      .eq("id", conversation.id);

    let aiReply = null;
    let aiMediaUrl = null;
    if (conversation.is_ai_active) {
      console.log(`Generating AI reply for conversation ${conversation.id}`);
      const result = await generateAIReply(supabase, conversation, contact, message, media_url, media_type);
      aiReply = result.reply;
      aiMediaUrl = result.mediaUrl;
      console.log(`AI reply result: ${aiReply ? aiReply.slice(0, 100) : "null"}`);
    } else {
      console.log(`AI is OFF for conversation ${conversation.id}, no reply generated`);
    }

    return new Response(
      JSON.stringify({ success: true, ai_reply: aiReply, ai_media_url: aiMediaUrl, conversation_id: conversation.id }),
      { headers: { ...corsH, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsH, "Content-Type": "application/json" } }
    );
  }
});

// ===== Web Search =====
async function webSearch(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " site:sity.cloud OR Sity Cloud")}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SityBot/1.0)" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const snippets: string[] = [];
    const regex = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && snippets.length < 3) {
      const text = match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (text.length > 20) snippets.push(text);
    }
    return snippets.join("\n");
  } catch (e) {
    console.error("Web search error:", e);
    return "";
  }
}

// ===== Detect if message needs web search =====
function needsWebSearch(msg: string, knowledgeText: string): boolean {
  if (!msg) return false;
  const searchTriggers = ["ابحث", "دور لي", "اعرف لي", "هل فيه", "ايه اخبار", "ايه الجديد", "قارن", "الفرق بين"];
  for (const t of searchTriggers) {
    if (msg.includes(t)) return true;
  }
  if (msg.includes("؟") && knowledgeText.length < 100) return true;
  return false;
}

// ===== Detect escalation request (STRICT) =====
function isEscalationRequest(msg: string): boolean {
  if (!msg) return false;
  // Only EXPLICIT human support requests - not vague phrases
  const triggers = [
    "دعم بشري", "كلمني بحد", "عايز اكلم حد بشري", "عايز حد بشري",
    "حد من الفريق يكلمني", "ابعتلي حد من الفريق",
    "شخص حقيقي", "كلمني بإنسان",
    "human support", "talk to agent", "real person", "representative",
  ];
  const lower = msg.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

// ===== Detect abusive/rude messages =====
function isAbusiveMessage(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  const abuseWords = [
    "نصابين", "نصب", "حرامية", "سرقة", "كداب", "كدابين",
    "ابن", "يلعن", "كسم", "عرص", "زبالة", "قرف", "وسخ",
    "scam", "fraud", "thieves", "liars",
  ];
  return abuseWords.some(w => lower.includes(w));
}

// ===== AI Reply Generation =====
async function generateAIReply(
  supabase: any, conversation: any, contact: any,
  message: string, mediaUrl?: string, mediaType?: string
) {
  const { data: botSettings } = await supabase
    .from("bot_settings")
    .select("*")
    .limit(1)
    .single();

  // Check escalation FIRST - return immediately, no AI reply after this
  if (isEscalationRequest(message)) {
    const escalationReply = "تمام هحولك لحد من الفريق يكلمك، حد هيرد عليك في أقرب وقت";

    await supabase.from("conversations")
      .update({ is_ai_active: false, status: "waiting" })
      .eq("id", conversation.id);

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      content: escalationReply,
      direction: "out",
      sender_type: "ai",
    });

    await supabase.from("conversations")
      .update({ last_message: escalationReply, last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    const contactName = contact.whatsapp_name || contact.name || contact.phone;
    notifyAdmin(supabase, contactName, contact.phone, message).catch(console.error);

    return { reply: escalationReply, mediaUrl: null };
  }

  // Check for abuse BEFORE generating AI reply
  if (isAbusiveMessage(message)) {
    const warningReply = "حضرتك لو سمحت نلتزم بأدب الحوار، إحنا هنا عشان نساعدك. لو فيه مشكلة حقيقية قولي وأنا هحاول أحلها معاك";
    
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      content: warningReply,
      direction: "out",
      sender_type: "ai",
    });

    await supabase.from("conversations")
      .update({ last_message: warningReply, last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return { reply: warningReply, mediaUrl: null };
  }

  const [trainingRes, knowledgeRes, memoryRes, historyRes] = await Promise.all([
    supabase.from("training_data").select("question, answer, category").eq("is_active", true),
    supabase.from("knowledge_base").select("title, content, category, data_type, media_url, media_type").eq("is_active", true),
    supabase.from("customer_memory").select("memory_type, key, value").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("messages").select("content, direction, sender_type, media_type").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(30),
  ]);

  const trainingData = trainingRes.data || [];
  const knowledgeData = knowledgeRes.data || [];
  const memories = memoryRes.data || [];
  const history = historyRes.data || [];

  // Build KEYWORD-MATCHED training context
  const msgLower = (message || "").toLowerCase();
  const msgWords = msgLower.split(/\s+/).filter(w => w.length > 2);

  // Score and pick top relevant FAQ entries
  let scoredFaq = trainingData.map((t: any) => {
    const combined = `${t.question} ${t.answer}`.toLowerCase();
    const score = msgWords.filter(w => combined.includes(w)).length;
    return { ...t, score };
  }).filter(t => t.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);

  if (scoredFaq.length === 0 && trainingData.length > 0) {
    scoredFaq = trainingData.slice(0, 5);
    console.log("No FAQ keyword match, using top 5 general FAQ as fallback");
  }
  const faqText = scoredFaq.map((t: any) => `س: ${t.question}\nج: ${t.answer}`).join("\n");

  // Score and pick top relevant knowledge entries
  let scoredKnowledge = knowledgeData
    .filter((k: any) => k.data_type !== "image")
    .map((k: any) => {
      const combined = `${k.title} ${k.content}`.toLowerCase();
      const score = msgWords.filter(w => combined.includes(w)).length;
      return { ...k, score };
    }).filter(k => k.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);

  if (scoredKnowledge.length === 0 && knowledgeData.length > 0) {
    scoredKnowledge = knowledgeData.filter((k: any) => k.data_type !== "image").slice(0, 5);
    console.log("No knowledge keyword match, using top 5 general entries as fallback");
  }
  const knowledgeText = scoredKnowledge.map((k: any) => `${k.title}: ${k.content}`).join("\n");

  const imageKnowledge = knowledgeData
    .filter((k: any) => k.data_type === "image" && k.media_url)
    .map((k: any) => `${k.title}: ${k.content} [صورة: ${k.media_url}]`)
    .join("\n");

  const memoryText = memories.map((m: any) => `${m.key}: ${m.value}`).join(", ");
  const contactName = contact.whatsapp_name || contact.name || contact.phone;
  const botName = botSettings?.bot_name || "مرام";

  // Detect conversation state
  const isShortMsg = (message || "").length < 15;
  const hasHistory = history.length > 2;
  const isFirstMessage = history.length <= 1;

  // Build smart context hints
  let contextHints = "";
  if (isShortMsg && hasHistory) {
    contextHints += "\nدي رسالة متابعة من العميل مش رسالة جديدة - كملي الكلام معاه طبيعي ومتقوليش أهلاً تاني ومتسأليش ازاي اساعدك.";
  }
  if (isFirstMessage) {
    contextHints += `\nدي أول رسالة من العميل اسمه ${contactName} - رحبي بيه مرة واحدة بس.`;
  }

  // Handle media descriptions
  let mediaDescription = "";
  if (mediaType === "image" && !mediaUrl?.startsWith("data:")) {
    mediaDescription = "\n(العميل بعتلك صورة - اسأليه عنها أو وصفيها لو تقدري)";
  }
  if (mediaType === "audio" && !mediaUrl?.startsWith("data:")) {
    mediaDescription = "\n(العميل بعت رسالة صوتية - حاولي تفهميها أو اسأليه يكتبلك)";
  }

  // Web search if needed
  let searchResults = "";
  const allKnowledge = knowledgeData.map((k: any) => `${k.title} ${k.content}`).join(" ");
  if (needsWebSearch(message, allKnowledge)) {
    searchResults = await webSearch(message);
    if (searchResults) {
      searchResults = `\nنتائج بحث:\n${searchResults}`;
    }
  }

  // ===== ENHANCED SYSTEM PROMPT =====
  const systemPrompt = `انتي ${botName} من فريق Sity Cloud - بنت مصرية ذكية وطبيعية ومهنية.

شخصيتك:
- بتتكلمي زي البشر بالظبط بالمصري العامي
- ردودك فيها روح وحيوية مش جامدة ولا آلية
- لو العميل متضايق أو زعلان خففي عليه وهزري معاه شوية بذوق
- لو العميل سأل سؤال تقني أو عن خدمة، ردي بمعلومات دقيقة ومفصلة من البيانات اللي عندك
- لو مش لاقية معلومة محددة، حاولي تساعدي من اللي تعرفيه واعرضي تسأليله
- متكرريش اسم العميل في كل رسالة - استخدميه مرة واحدة بس في أول تعارف
- ممنوع ايموجي نهائيا
- ممنوع تقولي انك ذكاء اصطناعي أو بوت
- لو فيه صورة مناسبة من البيانات حطي [IMAGE:الرابط]

قواعد الرد:
- رد مختصر من جملة لـ 4 جمل حسب السؤال
- لو السؤال بسيط رد قصير، لو السؤال مفصل رد مفصل
- متقوليش "خليني اتاكد وارجعلك" - دايما حاولي تساعدي من المعلومات المتاحة
- لو مفيش معلومة دقيقة قولي "مش متأكدة من التفاصيل دي بس خليني اسألك الفريق" بدل متجمدي
- ممنوع ترسلي رسائل طويلة أو تشرحي شرح زيادة عن اللزوم
${contextHints}${mediaDescription}
${memoryText ? `\nمعلومات عن العميل: ${memoryText}` : ""}${searchResults}
${knowledgeText ? `\nمعلومات عن خدماتنا:\n${knowledgeText.slice(0, 1500)}` : ""}
${faqText ? `\nأسئلة شائعة:\n${faqText.slice(0, 800)}` : ""}
${imageKnowledge ? `\nصور متاحة: ${imageKnowledge.slice(0, 400)}` : ""}`;

  // Build messages
  console.log(`System prompt length: ${systemPrompt.length}`);
  const chatMessages: any[] = [{ role: "system", content: systemPrompt }];

  // Add last 6 messages, deduplicate
  const recentHistory = history.slice(-6);
  const seenContents = new Set<string>();
  let lastRole = "system";
  for (const m of recentHistory) {
    const role = m.direction === "in" ? "user" : "assistant";
    let content = m.content || (m.media_type === "image" ? "صورة" : "رسالة صوتية");
    if (content.length > 200) content = content.slice(0, 200);
    const contentKey = content.slice(0, 50);
    if (seenContents.has(contentKey)) continue;
    seenContents.add(contentKey);
    if (role === lastRole && chatMessages.length > 1) {
      chatMessages[chatMessages.length - 1].content += "\n" + content;
    } else {
      chatMessages.push({ role, content });
    }
    lastRole = role;
  }

  // Ensure last message is from user
  const lastMsg = chatMessages[chatMessages.length - 1];
  if (!lastMsg || lastMsg.role !== "user") {
    chatMessages.push({ role: "user", content: message || "مرحبا" });
  }

  // Handle multimodal
  const multimodalMessage = (mediaType === "image" && mediaUrl && mediaUrl.startsWith("data:"))
    ? { role: "user", content: [
        ...(message ? [{ type: "text", text: message }] : [{ type: "text", text: "العميل بعتلك الصورة دي" }]),
        { type: "image_url", image_url: { url: mediaUrl } },
      ]}
    : (mediaType === "audio" && mediaUrl && mediaUrl.startsWith("data:"))
    ? { role: "user", content: [
        { type: "text", text: message || "العميل بعتلك رسالة صوتية" },
        { type: "input_audio", input_audio: { data: mediaUrl.split(",")[1] || mediaUrl, format: "ogg" } },
      ]}
    : null;

  // Try Lovable AI Gateway first, then OpenRouter
  let aiReply: string | null = null;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

  // --- PRIMARY: Lovable AI Gateway ---
  if (LOVABLE_API_KEY) {
    const lovableMessages = chatMessages.map((m: any) => {
      if (Array.isArray(m.content)) {
        const textParts = m.content.filter((p: any) => p.type === "text");
        return { ...m, content: textParts.map((p: any) => p.text).join(" ") };
      }
      return m;
    });

    const freshSystemMsg = { role: "system", content: `انتي ${botName} من Sity Cloud. ردي بالمصري العامي بشكل طبيعي وذكي. ممنوع ايموجي. ممنوع تتكلمي كروبوت. ردي زي الإنسان بالظبط.${contextHints}${mediaDescription}` };
    const userMsg = lovableMessages[lovableMessages.length - 1];

    const attempts = [
      { msgs: lovableMessages, model: "google/gemini-2.5-flash" },
      { msgs: [lovableMessages[0], ...lovableMessages.slice(-3)], model: "google/gemini-2.5-flash" },
      { msgs: [freshSystemMsg, userMsg], model: "google/gemini-2.5-flash-lite" },
    ];

    for (const attempt of attempts) {
      try {
        console.log(`Lovable AI: ${attempt.model}, ${attempt.msgs.length} msgs`);
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: attempt.model,
            messages: attempt.msgs,
            max_tokens: 300,
            temperature: 0.8,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const rawContent = aiData.choices?.[0]?.message?.content;
          if (rawContent && rawContent.trim().length > 2) {
            aiReply = rawContent;
            console.log(`Success with Lovable AI (${attempt.model})`);
            break;
          }
          console.log(`Lovable AI (${attempt.model}) returned empty, trying next`);
        } else {
          const errText = await aiResponse.text();
          console.error(`Lovable AI error: ${aiResponse.status} - ${errText}`);
          break;
        }
      } catch (e) {
        console.error("Lovable AI exception:", e);
        break;
      }
    }
  }

  // --- FALLBACK: OpenRouter free models ---
  if (!aiReply && OPENROUTER_API_KEY) {
    const models = [
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-4-26b-a4b-it:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
    ];

    for (const model of models) {
      try {
        console.log(`Trying OpenRouter: ${model}`);
        let messagesToSend = chatMessages;
        if (mediaType === "audio" && !model.includes("multimodal")) {
          messagesToSend = chatMessages.map((m: any) => {
            if (Array.isArray(m.content)) {
              const textParts = m.content.filter((p: any) => p.type === "text");
              return { ...m, content: textParts.map((p: any) => p.text).join(" ") + "\n(العميل بعت رسالة صوتية)" };
            }
            return m;
          });
        }

        const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://sityai.lovable.app",
          },
          body: JSON.stringify({ model, messages: messagesToSend, max_tokens: 300, temperature: 0.8 }),
        });

        if (!aiResponse.ok) { console.error(`${model}: ${aiResponse.status}`); continue; }
        const aiData = await aiResponse.json();
        aiReply = aiData.choices?.[0]?.message?.content;
        if (aiReply && aiReply.trim().length > 2) { console.log(`Success: ${model}`); break; }
        console.log(`${model} returned empty`);
        aiReply = null;
      } catch (e) { console.error(`${model} error:`, e); continue; }
    }
  }

  if (!aiReply) {
    console.log("All AI attempts failed, returning null");
    return { reply: null, mediaUrl: null };
  }

  // ===== CLEANUP =====
  aiReply = cleanAIReply(aiReply);

  // Extract image URL
  let aiMediaUrl = null;
  const imageMatch = aiReply.match(/\[IMAGE:(https?:\/\/[^\]]+)\]/);
  if (imageMatch) {
    aiMediaUrl = imageMatch[1];
    aiReply = aiReply.replace(/\[IMAGE:https?:\/\/[^\]]+\]/g, "").trim();
  }

  // Check if AI self-escalated
  if (aiReply.includes("[ESCALATE]")) {
    await supabase.from("conversations")
      .update({ is_ai_active: false, status: "waiting" })
      .eq("id", conversation.id);
    const cName = contact.whatsapp_name || contact.name || contact.phone;
    notifyAdmin(supabase, cName, contact.phone, message).catch(console.error);
    aiReply = aiReply.replace("[ESCALATE]", "").trim();
  }

  // Save AI reply
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    content: aiReply,
    direction: "out",
    sender_type: "ai",
    media_url: aiMediaUrl || null,
    media_type: aiMediaUrl ? "image" : null,
  });

  await supabase.from("conversations")
    .update({ last_message: aiReply, last_message_at: new Date().toISOString() })
    .eq("id", conversation.id);

  extractMemory(supabase, contact.id, message, aiReply).catch(console.error);

  return { reply: aiReply, mediaUrl: aiMediaUrl };
}

// ===== Clean AI Reply =====
function cleanAIReply(reply: string): string {
  // Remove thinking tags
  reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const lines = reply.split("\n");
  const cleanLines = lines.filter(line => {
    const t = line.trim();
    if (!t) return false;
    // Filter out internal reasoning/analysis lines
    if (/^(العميل |لازم |أولا|ثانيا|ملاحظة|السيناريو|التعليمات|بيانات التدريب|لقيت|أتحقق|أبدأ|أذكر|أكتفي|ده يتوافق|المطلوب|الخطوة|بناء على|حسب ال|من خلال ال|هنا |أولاً|ثانياً|Note:|Analysis:|Reasoning:|Step |First|Then|Based on)/i.test(t)) return false;
    if (/^\[(?!IMAGE|ESCALATE)[^\]]*\]/.test(t)) return false;
    if (/^(The customer|I need|I should|Let me|I will|According|Based on|Looking at|This is|My response|Response:)/i.test(t)) return false;
    // Filter out category tags
    if (/^\[(pricing|scenarios|features|about|faq|expert|security|support|websites|خدمات|تقنية|عام|تدريب|سيناريو)\]/i.test(t)) return false;
    return true;
  });

  reply = cleanLines.join("\n").trim();
  // Remove inline category tags
  reply = reply.replace(/\[(?:pricing|scenarios|features|about|faq|expert|security|support|websites|خدمات|تقنية|عام|تدريب|سيناريو)\]\s*/gi, "").trim();
  // Remove English reasoning lines
  reply = reply.replace(/\n\s*(Also|Note|However|But|So |This |I |We |The |Let|Now|Based|According|There|Here|First|Then)[^\n]*/gi, "").trim();
  // Remove emojis
  reply = reply.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "").trim();
  // Remove markdown bold
  reply = reply.replace(/\*+/g, "").trim();

  // Trim overly long responses
  if (reply.length > 400) {
    const sentences = reply.split(/[.،؟!]\s*/);
    let result = "";
    for (const s of sentences) {
      if (!s.trim()) continue;
      if ((result + s).length > 350) break;
      result += (result ? "، " : "") + s;
    }
    if (result.length > 20) reply = result;
  }

  if (!reply || reply.length < 5) {
    reply = "تمام، ازاي اقدر اساعدك";
  }

  return reply;
}

// ===== Admin Notification =====
async function notifyAdmin(supabase: any, customerName: string, customerPhone: string, customerMessage: string) {
  try {
    const { data: botSettings } = await supabase
      .from("bot_settings")
      .select("baileys_server_url")
      .limit(1)
      .single();

    const serverUrl = botSettings?.baileys_server_url;
    if (!serverUrl) return;

    // Format phone with + for admin readability
    const formattedPhone = customerPhone.startsWith("+") ? customerPhone : `+${customerPhone}`;
    const adminMsg = `تنبيه - طلب دعم بشري\n\nالعميل: ${customerName}\nالرقم: ${formattedPhone}\nالرسالة: ${customerMessage}`;

    await fetch(`${serverUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: ADMIN_PHONE, message: adminMsg }),
    });
    console.log("Admin notified");
  } catch (e) {
    console.error("Admin notify error:", e);
  }
}

// ===== Memory Extraction =====
async function extractMemory(supabase: any, contactId: string, userMsg: string, aiReply: string) {
  try {
    if (!userMsg || userMsg.length < 10) return;

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) return;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://sityai.lovable.app",
      },
      body: JSON.stringify({
        model: "google/gemma-4-26b-a4b-it:free",
        messages: [{
          role: "user",
          content: `استخرج معلومات مهمة عن العميل من رسالته. ارجع JSON array فقط: [{"memory_type":"preference|interest|note","key":"وصف","value":"قيمة"}] او [] لو مفيش.
رسالة: ${userMsg}`,
        }],
        max_tokens: 200,
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim();
    if (!content || content === "[]") return;

    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const items = JSON.parse(jsonMatch[0]);
      for (const mem of items) {
        if (mem.key && mem.value) {
          await supabase.from("customer_memory").insert({
            contact_id: contactId,
            memory_type: mem.memory_type || "note",
            key: mem.key,
            value: mem.value,
            created_by: "ai",
          });
        }
      }
    }
  } catch (e) {
    console.error("Memory error:", e);
  }
}
