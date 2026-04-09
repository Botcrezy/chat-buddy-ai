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

    const msgContent = message || (media_type === "image" ? "صورة" : "ملف");
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
      const result = await generateAIReply(supabase, conversation, contact, message);
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

async function generateAIReply(supabase: any, conversation: any, contact: any, message: string) {
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

  const systemPrompt = `انتي ${botName}، من فريق خدمة العملاء في شركة Sity Cloud. اونلاين 24/7.

قواعد صارمة:
1. ممنوع تماما استخدام اي ايموجي او رموز تعبيرية في الردود - لا ايموجي نهائيا
2. لا تقولي انك ذكاء اصطناعي او بوت - لو حد سالك قولي "انا ${botName} من فريق Sity Cloud"
3. لا تتكلمي عن اي حاجة مش موجودة في بيانات التدريب - لو مش عارفة قولي "خليني اتاكد من الفريق وارجعلك حالا"
4. لا تخترعي معلومات او اسعار مش مذكورة في البيانات
5. ردي بشكل مختصر ومهني - جملتين لـ 4 جمل كحد اقصى
6. اتكلمي بالمصري العامي بشكل طبيعي ومهني ولطيف
7. لو العميل طلب حد بشري او دعم فني او عنده مشكلة كبيرة، ابدئي ردك بـ [ESCALATE] وبعدين الرد الطبيعي

${botSettings?.personality ? `\nتعليمات الادارة:\n${botSettings.personality}` : ""}

العميل "${contactName}":
${memoryText || "عميل جديد"}
${contact.summary ? `ملخص: ${contact.summary}` : ""}

بيانات التدريب (المصدر الوحيد للمعلومات):
${knowledgeText || ""}
${faqText || ""}
${faqKnowledge || ""}

صور متاحة:
${imageKnowledge || "لا يوجد"}
لو العميل سال عن حاجة ليها صورة، حطي الرابط كده: [IMAGE:رابط_الصورة]

ردود جاهزة:
${quickRepliesText || "لا يوجد"}`;

  const chatMessages = [
    { role: "system", content: systemPrompt },
    ...(history).map((m: any) => ({
      role: m.direction === "in" ? "user" : "assistant",
      content: m.media_type && !m.content ? `[${m.media_type === "image" ? "صورة" : "ملف"} مرفق]` : m.content,
    })),
  ];

  // Use OpenRouter with fallback models
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY not configured");
    return { reply: null, mediaUrl: null };
  }

  const models = [
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
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
          max_tokens: 400,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`Model ${model} error: ${aiResponse.status}`, errText);
        continue; // Try next model
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

  // Strip any emoji that might slip through
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

  // Check if AI couldn't answer
  if (aiReply.includes("اتاكد من الزملاء") || aiReply.includes("احول لموظف") || aiReply.includes("ساحول سؤالك") || needsEscalation) {
    await supabase
      .from("conversations")
      .update({ is_ai_active: false, status: "waiting" })
      .eq("id", conversation.id);

    // Send admin notification via Baileys
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

async function notifyAdmin(supabase: any, customerName: string, customerPhone: string, customerMessage: string) {
  try {
    const { data: botSettings } = await supabase
      .from("bot_settings")
      .select("baileys_server_url")
      .limit(1)
      .single();

    const serverUrl = botSettings?.baileys_server_url;
    if (!serverUrl) {
      console.error("No baileys server URL for admin notification");
      return;
    }

    const adminMsg = `تنبيه - طلب دعم بشري\n\nالعميل: ${customerName}\nالرقم: ${customerPhone}\nالرسالة: ${customerMessage}\n\nيرجى التواصل مع العميل في اقرب وقت.`;

    await fetch(`${serverUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: ADMIN_PHONE,
        message: adminMsg,
      }),
    });
    console.log("Admin notification sent to", ADMIN_PHONE);
  } catch (e) {
    console.error("Failed to notify admin:", e);
  }
}

async function extractMemory(supabase: any, contactId: string, userMsg: string, aiReply: string) {
  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) return;

    const extractPrompt = `حلل الرسالة التالية واستخرج اي معلومات مهمة عن العميل.
ارجع JSON array فقط (بدون اي نص اضافي). كل عنصر يحتوي: {"memory_type": "preference|complaint|interest|order|note", "key": "وصف قصير", "value": "القيمة"}
اذا لم توجد معلومات مهمة، ارجع: []

رسالة العميل: ${userMsg}`;

    const memModels = ["google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free", "qwen/qwen3-next-80b-a3b-instruct:free"];
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
