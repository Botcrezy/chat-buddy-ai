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
      const result = await generateAIReply(supabase, conversation, contact, message, media_url, media_type);
      aiReply = result.reply;
      aiMediaUrl = result.mediaUrl;
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
  // If question mark and short knowledge
  if (msg.includes("؟") && knowledgeText.length < 100) return true;
  return false;
}

// ===== Detect escalation request =====
function isEscalationRequest(msg: string): boolean {
  if (!msg) return false;
  const triggers = [
    "دعم بشري", "موظف", "حد يكلمني", "شخص حقيقي", "مدير", "شكوى",
    "عايز اكلم حد", "كلمني بحد", "ابعتلي حد", "مش فاهم", "مش راضي",
    "human", "agent", "support", "representative", "manager",
    "عايز حد بشري", "حد من الفريق", "ادارة", "مسؤول",
  ];
  const lower = msg.toLowerCase();
  return triggers.some(t => lower.includes(t));
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

  // Check escalation FIRST - return fixed response immediately
  if (isEscalationRequest(message)) {
    const escalationReply = "تمام هحولك لحد من الفريق دلوقتي، حد هيتواصل معاك في اقرب وقت";

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

  // Build compact training context
  const faqText = trainingData.map((t: any) => `س: ${t.question}\nج: ${t.answer}`).join("\n");
  const knowledgeText = knowledgeData
    .filter((k: any) => k.data_type !== "image")
    .map((k: any) => `${k.title}: ${k.content}`)
    .join("\n");
  const imageKnowledge = knowledgeData
    .filter((k: any) => k.data_type === "image" && k.media_url)
    .map((k: any) => `${k.title}: ${k.content} [صورة: ${k.media_url}]`)
    .join("\n");

  const memoryText = memories.map((m: any) => `${m.key}: ${m.value}`).join(", ");
  const contactName = contact.whatsapp_name || contact.name || contact.phone;
  const botName = botSettings?.bot_name || "مرام";

  // Web search if needed
  let searchResults = "";
  if (needsWebSearch(message, knowledgeText)) {
    searchResults = await webSearch(message);
    if (searchResults) {
      searchResults = `\nنتائج بحث:\n${searchResults}`;
    }
  }

  // SHORT, focused system prompt
  const systemPrompt = `انتي ${botName} من Sity Cloud. بنت مصرية لطيفة ومهنية.

قواعد:
- ردي بالمصري العامي بس، جمله لـ 3 جمل مختصرة
- ممنوع ايموجي نهائي
- ممنوع تقولي انك AI او بوت
- التزمي بالبيانات دي بس. لو مش عارفة قولي "خليني اتاكد وارجعلك"
- متكرريش اسم العميل اكتر من مرة
- لو فيه صورة مناسبة حطي [IMAGE:الرابط]

${memoryText ? `العميل: ${memoryText}` : ""}
${searchResults}

بيانات:
${knowledgeText.slice(0, 4000)}
${faqText.slice(0, 1500)}

صور: ${imageKnowledge.slice(0, 500) || "لا يوجد"}`;

  // Build messages
  const chatMessages: any[] = [{ role: "system", content: systemPrompt }];

  // Add last 8 messages, truncate long ones, deduplicate consecutive same-role
  const recentHistory = history.slice(-8);
  let lastRole = "system";
  for (const m of recentHistory) {
    const role = m.direction === "in" ? "user" : "assistant";
    let content = m.content || (m.media_type === "image" ? "صورة" : "رسالة صوتية");
    if (content.length > 200) content = content.slice(0, 200);
    // Skip if same role as last (merge into previous)
    if (role === lastRole && chatMessages.length > 1) {
      chatMessages[chatMessages.length - 1].content += "\n" + content;
    } else {
      chatMessages.push({ role, content });
    }
    lastRole = role;
  }

  // Handle current message - multimodal
  if (mediaType === "image" && mediaUrl && mediaUrl.startsWith("data:")) {
    chatMessages.push({
      role: "user",
      content: [
        ...(message ? [{ type: "text", text: message }] : [{ type: "text", text: "العميل بعتلك الصورة دي، حللها وردي عليه" }]),
        { type: "image_url", image_url: { url: mediaUrl } },
      ],
    });
  } else if (mediaType === "audio" && mediaUrl && mediaUrl.startsWith("data:")) {
    // Send audio as input_audio for models that support it
    const base64Data = mediaUrl.split(",")[1] || mediaUrl;
    chatMessages.push({
      role: "user",
      content: [
        { type: "text", text: message || "العميل بعتلك رسالة صوتية، افهمها وردي عليه" },
        { type: "input_audio", input_audio: { data: base64Data, format: "ogg" } },
      ],
    });
  }

  // Try Lovable AI Gateway first (reliable), then OpenRouter free models as fallback
  let aiReply: string | null = null;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

  // --- PRIMARY: Lovable AI Gateway ---
  if (LOVABLE_API_KEY) {
    try {
      console.log("Trying Lovable AI Gateway");
      // For multimodal, strip non-text content for Lovable AI
      const lovableMessages = chatMessages.map((m: any) => {
        if (Array.isArray(m.content)) {
          const textParts = m.content.filter((p: any) => p.type === "text");
          return { ...m, content: textParts.map((p: any) => p.text).join(" ") };
        }
        return m;
      });

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: lovableMessages,
          max_tokens: 200,
          temperature: 0.6,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        console.log("Lovable AI full choices:", JSON.stringify(aiData.choices).slice(0, 500));
        const choice = aiData.choices?.[0];
        const rawContent = choice?.message?.content ?? choice?.text ?? "";
        aiReply = rawContent || null;
        if (aiReply) console.log("Success with Lovable AI Gateway");
        else console.error("Lovable AI: empty content, finish_reason:", choice?.finish_reason);
      } else {
        const errBody = await aiResponse.text();
        console.error(`Lovable AI error ${aiResponse.status}: ${errBody.slice(0, 300)}`);
      }
    } catch (e) {
      console.error("Lovable AI exception:", e);
    }
  }

  // --- FALLBACK: OpenRouter free models ---
  if (!aiReply && OPENROUTER_API_KEY) {
    const models = [
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "openai/gpt-oss-120b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-4-26b-a4b-it:free",
      "minimax/minimax-m2.5:free",
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
          body: JSON.stringify({ model, messages: messagesToSend, max_tokens: 200, temperature: 0.6 }),
        });

        if (!aiResponse.ok) { console.error(`${model}: ${aiResponse.status}`); continue; }
        const aiData = await aiResponse.json();
        aiReply = aiData.choices?.[0]?.message?.content;
        if (aiReply) { console.log(`Success: ${model}`); break; }
      } catch (e) { console.error(`${model} error:`, e); continue; }
    }
  }

  if (!aiReply) return { reply: null, mediaUrl: null };

  // ===== CLEANUP =====
  aiReply = cleanAIReply(aiReply);

  // Extract image URL
  let aiMediaUrl = null;
  const imageMatch = aiReply.match(/\[IMAGE:(https?:\/\/[^\]]+)\]/);
  if (imageMatch) {
    aiMediaUrl = imageMatch[1];
    aiReply = aiReply.replace(/\[IMAGE:https?:\/\/[^\]]+\]/g, "").trim();
  }

  // Check if AI escalated
  if (aiReply.includes("اتاكد من الفريق") || aiReply.includes("احول") || aiReply.includes("[ESCALATE]")) {
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
  // 1. Remove think tags
  reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Remove reasoning blocks (lines that are analysis, not reply)
  const lines = reply.split("\n");
  const cleanLines = lines.filter(line => {
    const t = line.trim();
    if (!t) return false;
    // Skip reasoning/analysis lines
    if (/^(العميل |لازم |أولا|ثانيا|ملاحظة|السيناريو|التعليمات|بيانات التدريب|لقيت|أتحقق|أبدأ|أذكر|أكتفي|ده يتوافق|المطلوب|الخطوة|بناء على|حسب ال|من خلال ال|هنا |أولاً|ثانياً|Note:|Analysis:|Reasoning:|Step |First|Then|Based on)/i.test(t)) return false;
    // Skip category tags
    if (/^\[(?!IMAGE|ESCALATE)[^\]]*\]/.test(t)) return false;
    // Skip English reasoning
    if (/^(The customer|I need|I should|Let me|I will|According|Based on|Looking at)/i.test(t)) return false;
    return true;
  });

  reply = cleanLines.join("\n").trim();

  // 3. Remove training data tags
  reply = reply.replace(/\[(?:pricing|scenarios|features|about|faq|expert|security|support|websites|خدمات|تقنية|عام|تدريب|سيناريو)\]\s*/gi, "").trim();

  // 4. Remove stray English sentences after Arabic
  reply = reply.replace(/\n\s*(Also|Note|However|But|So |This |I |We |The |Let|Now|Based|According|There|Here|First|Then)[^\n]*/gi, "").trim();

  // 5. Strip ALL emoji
  reply = reply.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "").trim();

  // 6. Remove asterisks used for bold (markdown)
  reply = reply.replace(/\*+/g, "").trim();

  // 7. Truncate if too long (max ~300 chars for natural feel)
  if (reply.length > 350) {
    const sentences = reply.split(/[.،؟!]\s*/);
    let result = "";
    for (const s of sentences) {
      if (!s.trim()) continue;
      if ((result + s).length > 300) break;
      result += (result ? "، " : "") + s;
    }
    if (result.length > 20) reply = result;
  }

  // 8. If reply is empty after cleanup, return fallback
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

    const adminMsg = `تنبيه - طلب دعم بشري\nالعميل: ${customerName}\nالرقم: ${customerPhone}\nالرسالة: ${customerMessage}`;

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
