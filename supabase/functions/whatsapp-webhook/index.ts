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

// ===== Web Search via DuckDuckGo =====
async function webSearch(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SityBot/1.0)" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    // Extract snippets from result__snippet class
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

  const [trainingRes, knowledgeRes, quickRes, memoryRes, historyRes] = await Promise.all([
    supabase.from("training_data").select("question, answer, category").eq("is_active", true),
    supabase.from("knowledge_base").select("title, content, category, data_type, media_url, media_type").eq("is_active", true),
    supabase.from("quick_replies").select("title, content"),
    supabase.from("customer_memory").select("memory_type, key, value").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("messages").select("content, direction, sender_type, media_type").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(50),
  ]);

  const trainingData = trainingRes.data || [];
  const knowledgeData = knowledgeRes.data || [];
  const quickReplies = quickRes.data || [];
  const memories = memoryRes.data || [];
  const history = historyRes.data || [];

  const faqText = trainingData
    .map((t: any) => `[${t.category}] سؤال: ${t.question}\nجواب: ${t.answer}`)
    .join("\n\n");

  const knowledgeText = knowledgeData
    .filter((k: any) => k.data_type === "text" || k.data_type === "document")
    .map((k: any) => `[${k.category}] ${k.title}:\n${k.content}`)
    .join("\n\n");

  const imageKnowledge = knowledgeData
    .filter((k: any) => k.data_type === "image" && k.media_url)
    .map((k: any) => `- ${k.title}: ${k.content} [صورة: ${k.media_url}]`)
    .join("\n");

  const faqKnowledge = knowledgeData
    .filter((k: any) => k.data_type === "faq")
    .map((k: any) => `سؤال: ${k.title}\nجواب: ${k.content}`)
    .join("\n\n");

  const quickRepliesText = quickReplies
    .map((q: any) => `${q.title}: ${q.content}`)
    .join("\n");

  const memoryText = memories
    .map((m: any) => `- ${m.key}: ${m.value} (${m.memory_type})`)
    .join("\n");

  const contactName = contact.whatsapp_name || contact.name || contact.phone;
  const botName = botSettings?.bot_name || "مرام";

  const systemPrompt = `انتي ${botName}، موظفة خدمة عملاء حقيقية في شركة Sity Cloud. اونلاين 24/7.

شخصيتك:
- بنت مصرية لطيفة ومهنية بتتكلم عامية مصرية طبيعية
- بتتعاملي كأنك إنسانة حقيقية مش بوت - لو حد سألك قولي "انا ${botName} من فريق Sity Cloud"
- بتفهمي العميل وبتحسسيه إنك مهتمة بيه فعلاً

قواعد صارمة:
1. ممنوع تماماً اي ايموجي او رموز تعبيرية - لا ايموجي ولا رموز نهائي
2. متقوليش إنك AI أو بوت أبداً
3. التزمي فقط بالمعلومات الموجودة في بيانات التدريب - لو مش عارفة حاجة قولي "خليني اتأكد من الفريق وارجعلك"
4. متخترعيش معلومات أو أسعار مش موجودة
5. الردود تكون مختصرة ومفيدة - من جملة لـ 3 جمل. متتكلميش كتير
6. استخدمي اسم العميل مرة واحدة بس في أول رد، بعد كده متكرريش اسمه
7. لو العميل طلب دعم بشري أو عنده مشكلة كبيرة، ابدئي بـ [ESCALATE]
8. لو العميل بعت صورة، حللي الصورة وردي عليه بناءً على محتواها
9. لو العميل بعت رسالة صوتية، افهمي المحتوى وردي عليه
10. لو محتاجة معلومة مش موجودة في التدريب وممكن تتلاقي على الإنترنت، ابحثي وردي

${botSettings?.personality ? `\nتعليمات إضافية:\n${botSettings.personality}` : ""}

معلومات العميل "${contactName}":
${memoryText || "عميل جديد - اترحبي بيه"}
${contact.summary ? `ملخص سابق: ${contact.summary}` : ""}

بيانات التدريب (المصدر الرئيسي للمعلومات):
${knowledgeText || ""}
${faqText || ""}
${faqKnowledge || ""}

صور متاحة للإرسال:
${imageKnowledge || "لا يوجد"}
لو العميل سأل عن حاجة ليها صورة، حطي الرابط كده: [IMAGE:رابط_الصورة]

ردود جاهزة:
${quickRepliesText || "لا يوجد"}

مهم جدا: اكتبي الرد النهائي فقط اللي هيتبعت للعميل مباشرة. متكتبيش تحليل أو تفكير أو شرح. رد واحد مباشر بس.`;

  // Build chat messages with multimodal support
  const chatMessages: any[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add history
  for (const m of history) {
    chatMessages.push({
      role: m.direction === "in" ? "user" : "assistant",
      content: m.media_type && !m.content ? `[${m.media_type === "image" ? "صورة" : m.media_type === "audio" ? "رسالة صوتية" : "ملف"} مرفق]` : m.content,
    });
  }

  // Handle current message with multimodal content
  if (mediaType === "image" && mediaUrl && mediaUrl.startsWith("data:")) {
    // Image sent by customer - use multimodal vision
    const userContent: any[] = [];
    if (message) userContent.push({ type: "text", text: message });
    userContent.push({
      type: "image_url",
      image_url: { url: mediaUrl },
    });
    // Replace last user message or add new one
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === "user") {
      chatMessages[chatMessages.length - 1].content = userContent;
    } else {
      chatMessages.push({ role: "user", content: userContent });
    }
  } else if (mediaType === "audio" && mediaUrl && mediaUrl.startsWith("data:")) {
    // Voice note - ask AI to understand it as context
    // Since free models may not support audio directly, we'll add it as context
    const audioNote = "العميل بعت رسالة صوتية. حاولي تفهمي من سياق المحادثة وردي عليه. لو مش قادرة تفهمي الصوت، اسأليه يكتب رسالته.";
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === "user") {
      chatMessages[chatMessages.length - 1].content = audioNote;
    } else {
      chatMessages.push({ role: "user", content: audioNote });
    }
  }

  // Use OpenRouter with fallback models
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY not configured");
    return { reply: null, mediaUrl: null };
  }

  const models = [
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "deepseek/deepseek-chat-v3-0324:free",
    "microsoft/phi-4-multimodal-instruct:free",
    "google/gemma-4-26b-a4b-it:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
  ];

  let aiReply: string | null = null;

  for (const model of models) {
    try {
      console.log(`Trying model: ${model}`);
      const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://sityai.lovable.app",
          "X-Title": "Sity Cloud Bot",
        },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`Model ${model} error: ${aiResponse.status}`, errText);
        continue;
      }

      const aiData = await aiResponse.json();
      aiReply = aiData.choices?.[0]?.message?.content;
      if (aiReply) {
        console.log(`Success with model: ${model}`);
        break;
      }
    } catch (e) {
      console.error(`Model ${model} exception:`, e);
      continue;
    }
  }

  if (!aiReply) return { reply: null, mediaUrl: null };

  // ===== CLEANUP AI OUTPUT =====
  // 1. Remove <think>...</think> tags
  aiReply = aiReply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Remove reasoning patterns (Arabic or English) - look for the actual customer-facing reply
  // Many models output analysis like "العميل سأل عن..." or "لازم أرد..." before the actual reply
  // The actual reply usually starts with greeting words or direct answers
  const replyStarters = /^(وعليكم|أهلا|مرحبا|تمام|أيوه|فاهمة|طبعا|شكرا|العفو|أنا مرام|أنا م|عندنا|ممكن|خليني|حلو|سعيدة|صباح|مساء|يا هلا|نورت|أهلاً|هلا|Hi |Hello|Welcome|هاي|أنا فاهم|أنا آسف|بياناتك|تقدر|الباقة|سؤال حلو|ده غالبا|جرب|حاليا|من خلال|بنرحب|كل دورة|أيوه!|ببساطة|ووردبريس|ويكس|شوبيفاي|GoDaddy)/;

  if (aiReply.length > 200) {
    const lines = aiReply.split("\n");
    let replyStartIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (replyStarters.test(line)) {
        replyStartIdx = i;
        break;
      }
    }
    if (replyStartIdx > 0) {
      aiReply = lines.slice(replyStartIdx).join("\n").trim();
    }
  }

  // 3. If still too long (reasoning mixed in), try to extract just sentences without analysis patterns
  if (aiReply.length > 400) {
    // Remove lines that look like reasoning
    const cleanLines = aiReply.split("\n").filter(line => {
      const t = line.trim();
      if (!t) return false;
      // Skip reasoning lines
      if (/^(العميل |لازم |أولا|ثانيا|ملاحظة|السيناريو|التعليمات|بيانات التدريب|لقيت|أتحقق|أبدأ|أذكر|أكتفي|ده يتوافق|لكن|ربما|كمان|حسب|بناء|المطلوب|الخطوة)/i.test(t)) return false;
      if (/^\[.*\]$/.test(t) && !t.startsWith("[ESCALATE]") && !t.startsWith("[IMAGE:")) return false;
      return true;
    });
    if (cleanLines.length > 0) {
      aiReply = cleanLines.join("\n").trim();
    }
  }

  // 4. Truncate if still too long
  if (aiReply.length > 500) {
    const sentences = aiReply.split(/[.؟?!]\s*/);
    let result = "";
    for (const s of sentences) {
      if ((result + s).length > 400) break;
      result += (result ? ". " : "") + s;
    }
    if (result.length > 20) aiReply = result;
  }

  // 5. Remove English text that appears after Arabic reply (reasoning leakage)
  aiReply = aiReply.replace(/\n\s*(Also|Note|However|But|So |This |I |We |The |Let|Now|Based|According|There|Here|First|Then)[^\n]*/gi, "").trim();
  // Remove lines starting with [ that are training data references
  aiReply = aiReply.replace(/\n\s*\[(?!ESCALATE|IMAGE)[^\]]*\][^\n]*/g, "").trim();

  // 6. Strip emoji
  aiReply = aiReply.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "").trim();


  // Check for escalation
  let needsEscalation = false;
  if (aiReply.startsWith("[ESCALATE]")) {
    needsEscalation = true;
    aiReply = aiReply.replace("[ESCALATE]", "").trim();
  }

  // Extract image URL if present
  let aiMediaUrl = null;
  const imageMatch = aiReply.match(/\[IMAGE:(https?:\/\/[^\]]+)\]/);
  if (imageMatch) {
    aiMediaUrl = imageMatch[1];
    aiReply = aiReply.replace(/\[IMAGE:https?:\/\/[^\]]+\]/g, "").trim();
  }

  // Check if AI couldn't answer - escalate
  if (aiReply.includes("اتاكد من الفريق") || aiReply.includes("احول لموظف") || aiReply.includes("ساحول سؤالك") || needsEscalation) {
    await supabase
      .from("conversations")
      .update({ is_ai_active: false, status: "waiting" })
      .eq("id", conversation.id);

    notifyAdmin(supabase, contactName, contact.phone, message).catch(console.error);
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

  await supabase
    .from("conversations")
    .update({ last_message: aiReply, last_message_at: new Date().toISOString() })
    .eq("id", conversation.id);

  extractMemory(supabase, contact.id, message, aiReply).catch(console.error);

  return { reply: aiReply, mediaUrl: aiMediaUrl };
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

    const adminMsg = `تنبيه - طلب دعم بشري\n\nالعميل: ${customerName}\nالرقم: ${customerPhone}\nالرسالة: ${customerMessage}\n\nيرجى التواصل مع العميل في اقرب وقت.`;

    await fetch(`${serverUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: ADMIN_PHONE, message: adminMsg }),
    });
    console.log("Admin notification sent to", ADMIN_PHONE);
  } catch (e) {
    console.error("Failed to notify admin:", e);
  }
}

// ===== Memory Extraction =====
async function extractMemory(supabase: any, contactId: string, userMsg: string, aiReply: string) {
  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) return;

    const extractPrompt = `حلل الرسالة التالية واستخرج اي معلومات مهمة عن العميل.
ارجع JSON array فقط (بدون اي نص اضافي). كل عنصر يحتوي: {"memory_type": "preference|complaint|interest|order|note", "key": "وصف قصير", "value": "القيمة"}
اذا لم توجد معلومات مهمة، ارجع: []

رسالة العميل: ${userMsg}`;

    const memModels = ["google/gemma-4-31b-it:free", "meta-llama/llama-4-scout:free", "qwen/qwen3-next-80b-a3b-instruct:free", "deepseek/deepseek-chat-v3-0324:free"];
    let content: string | null = null;

    for (const model of memModels) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://sityai.lovable.app",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: extractPrompt }],
            max_tokens: 300,
          }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        content = data.choices?.[0]?.message?.content?.trim();
        if (content) break;
      } catch { continue; }
    }
    if (!content || content === "[]") return;

    // Remove thinking tags
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const memoryItems = JSON.parse(jsonMatch[0]);
      for (const mem of memoryItems) {
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
    console.error("Memory extraction error:", e);
  }
}
