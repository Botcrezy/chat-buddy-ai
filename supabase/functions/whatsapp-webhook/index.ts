import { createClient } from "https://esm.sh/@supabase/supabase-js@2.102.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Upsert contact
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

    // Get or create conversation
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

    // Save incoming message
    const msgContent = message || (media_type === "image" ? "📷 صورة" : "📎 ملف");
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      content: msgContent,
      direction: "in",
      sender_type: "customer",
      whatsapp_message_id,
      media_url: media_url || null,
      media_type: media_type || null,
    });

    // Update conversation
    await supabase
      .from("conversations")
      .update({
        last_message: msgContent,
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count || 0) + 1,
        status: conversation.status === "new" ? "open" : conversation.status,
      })
      .eq("id", conversation.id);

    // If AI is active, generate reply
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

  // Check working hours
  if (botSettings?.working_hours_start && botSettings?.working_hours_end) {
    const now = new Date();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const currentTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    if (currentTime < botSettings.working_hours_start || currentTime > botSettings.working_hours_end) {
      if (botSettings.off_hours_message) {
        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          content: botSettings.off_hours_message,
          direction: "out",
          sender_type: "ai",
        });
        return { reply: botSettings.off_hours_message, mediaUrl: null };
      }
    }
  }

  // Fetch all context in parallel
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

  // Build knowledge sections
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

  const systemPrompt = `أنت ${botSettings?.bot_name || "مساعد الشركة"}، أحد أعضاء فريق العمل.
${botSettings?.personality || "أنت مساعد ذكي ومهذب للشركة."}

⚠️ تعليمات صارمة:
- لا تقل أبداً أنك ذكاء اصطناعي أو بوت أو روبوت أو AI
- رد كأنك شخص حقيقي من فريق العمل بأسلوب طبيعي ودود واحترافي
- استخدم أسلوب محادثة عادي مع إيموجي خفيف
- إذا سُئلت "هل أنت بوت؟" قل "لا طبعاً، أنا من فريق خدمة العملاء 😊"
- كن ذكياً في فهم طلبات العميل حتى لو كانت غير واضحة
- أجب بشكل مفصل ومفيد لكن بدون إطالة غير مبررة

👤 معلومات العميل "${contactName}":
${memoryText || "لا توجد معلومات سابقة عن هذا العميل"}
${contact.summary ? `ملخص سابق: ${contact.summary}` : ""}

📚 معرفة الشركة والخدمات:
${knowledgeText || ""}
${faqText || ""}
${faqKnowledge || ""}

🖼️ صور المنتجات المتاحة:
${imageKnowledge || "لا توجد صور منتجات حالياً"}
⚠️ إذا سأل العميل عن منتج وتوجد له صورة، ضع رابط الصورة في ردك بالصيغة التالية: [IMAGE:رابط_الصورة]
هذا سيرسل الصورة للعميل تلقائياً.

💬 ردود جاهزة يمكن الاستعانة بها:
${quickRepliesText || "لا توجد ردود جاهزة"}

📋 تعليمات الرد:
- أجب باللغة العربية بشكل احترافي ومفيد
- إذا لم تعرف الإجابة: قل "خليني أتأكد من الزملاء وأرجعلك"
- إذا أرسل صورة بدون نص: اسأله عن المطلوب بلطف
- تذكر تفاصيل العميل واستخدمها في الردود
- كن proactive واقترح حلول ومنتجات ذات صلة`;

  const chatMessages = [
    { role: "system", content: systemPrompt },
    ...(history).map((m: any) => ({
      role: m.direction === "in" ? "user" : "assistant",
      content: m.media_type && !m.content ? `[${m.media_type === "image" ? "صورة" : "ملف"} مرفق]` : m.content,
    })),
  ];

  // Call Lovable AI Gateway
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return { reply: null, mediaUrl: null };
  }

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: chatMessages,
      max_tokens: 1000,
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI Gateway error:", aiResponse.status, errText);
    return { reply: null, mediaUrl: null };
  }

  const aiData = await aiResponse.json();
  let aiReply = aiData.choices?.[0]?.message?.content;

  if (!aiReply) return { reply: null, mediaUrl: null };

  // Extract image URL if present in reply
  let aiMediaUrl = null;
  const imageMatch = aiReply.match(/\[IMAGE:(https?:\/\/[^\]]+)\]/);
  if (imageMatch) {
    aiMediaUrl = imageMatch[1];
    aiReply = aiReply.replace(/\[IMAGE:https?:\/\/[^\]]+\]/g, "").trim();
  }

  // Check if AI couldn't answer → transfer to agent
  if (aiReply.includes("أتأكد من الزملاء") || aiReply.includes("أحول لموظف") || aiReply.includes("سأحول سؤالك")) {
    await supabase
      .from("conversations")
      .update({ is_ai_active: false, status: "waiting" })
      .eq("id", conversation.id);
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

  // Extract memory (async)
  extractMemory(supabase, contact.id, message, aiReply).catch(console.error);

  return { reply: aiReply, mediaUrl: aiMediaUrl };
}

async function extractMemory(supabase: any, contactId: string, userMsg: string, aiReply: string) {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return;

    const extractPrompt = `حلل الرسالة التالية واستخرج أي معلومات مهمة عن العميل.
أرجع JSON array فقط (بدون أي نص إضافي). كل عنصر يحتوي: {"memory_type": "preference|complaint|interest|order|note", "key": "وصف قصير", "value": "القيمة"}
إذا لم توجد معلومات مهمة، أرجع: []

رسالة العميل: ${userMsg}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: extractPrompt }],
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content || content === "[]") return;

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const memories = JSON.parse(jsonMatch[0]);
      for (const mem of memories) {
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
