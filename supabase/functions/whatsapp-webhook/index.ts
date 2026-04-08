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
      // WhatsApp profile data from Baileys
      push_name, profile_pic_url, whatsapp_about,
    } = body;

    if (!phone || (!message && !media_url)) {
      return new Response(JSON.stringify({ error: "phone and (message or media_url) required" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Upsert contact with WhatsApp profile data
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
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      content: message || (media_type === "image" ? "📷 صورة" : "📎 ملف"),
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
        last_message: message || (media_type === "image" ? "📷 صورة" : "📎 ملف"),
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count || 0) + 1,
        status: conversation.status === "new" ? "open" : conversation.status,
      })
      .eq("id", conversation.id);

    // If AI is active, generate reply
    let aiReply = null;
    if (conversation.is_ai_active) {
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
            return new Response(
              JSON.stringify({ success: true, ai_reply: botSettings.off_hours_message, conversation_id: conversation.id }),
              { headers: { ...corsH, "Content-Type": "application/json" } }
            );
          }
        }
      }

      // Get training data
      const { data: trainingData } = await supabase
        .from("training_data")
        .select("question, answer, category")
        .eq("is_active", true);

      // Get quick replies
      const { data: quickReplies } = await supabase
        .from("quick_replies")
        .select("title, content");

      // Get customer memory
      const { data: memories } = await supabase
        .from("customer_memory")
        .select("memory_type, key, value")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const knowledgeBase = (trainingData || [])
        .map((t: any) => `[${t.category}] سؤال: ${t.question}\nجواب: ${t.answer}`)
        .join("\n\n");

      const quickRepliesText = (quickReplies || [])
        .map((q: any) => `${q.title}: ${q.content}`)
        .join("\n");

      const memoryText = (memories || [])
        .map((m: any) => `- ${m.key}: ${m.value} (${m.memory_type})`)
        .join("\n");

      const contactName = contact.whatsapp_name || contact.name || contact.phone;

      const systemPrompt = `أنت ${botSettings?.bot_name || "مساعد الشركة"}، أحد أعضاء فريق العمل.
${botSettings?.personality || "أنت مساعد ذكي ومهذب للشركة."}

⚠️ تعليمات صارمة:
- لا تقل أبداً أنك ذكاء اصطناعي أو بوت أو روبوت
- رد كأنك شخص حقيقي من فريق العمل بأسلوب طبيعي ودود
- استخدم أسلوب محادثة عادي مع إيموجي خفيف
- إذا سُئلت "هل أنت بوت؟" قل "لا طبعاً، أنا من فريق خدمة العملاء 😊"

👤 معلومات العميل "${contactName}":
${memoryText || "لا توجد معلومات سابقة"}
${contact.summary ? `ملخص: ${contact.summary}` : ""}

📚 بيانات الشركة والخدمات:
${knowledgeBase || "لا توجد بيانات تدريب بعد"}

💬 ردود جاهزة يمكن الاستعانة بها:
${quickRepliesText || "لا توجد ردود جاهزة"}

📋 تعليمات الرد:
- أجب باللغة العربية بشكل مختصر ومهني
- إذا لم تعرف الإجابة: قل "خليني أتأكد من الزملاء وأرجعلك"
- إذا أرسل صورة بدون نص: اسأله عن المطلوب بلطف
- تذكر تفاصيل العميل واستخدمها في الردود`;

      // Get conversation history (last 50 messages)
      const { data: history } = await supabase
        .from("messages")
        .select("content, direction, sender_type, media_type")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(50);

      const messages = [
        { role: "system", content: systemPrompt },
        ...(history || []).map((m: any) => ({
          role: m.direction === "in" ? "user" : "assistant",
          content: m.media_type && !m.content ? `[${m.media_type === "image" ? "صورة" : "ملف"} مرفق]` : m.content,
        })),
      ];

      const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
          "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
          "X-Title": "WhatsApp Bot",
        },
        body: JSON.stringify({
          model: "stepfun/step-3.5-flash:free",
          messages,
          max_tokens: 500,
        }),
      });

      const aiData = await aiResponse.json();
      aiReply = aiData.choices?.[0]?.message?.content;

      if (aiReply) {
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
        });

        await supabase
          .from("conversations")
          .update({ last_message: aiReply, last_message_at: new Date().toISOString() })
          .eq("id", conversation.id);

        // Extract memory from conversation (async, don't wait)
        extractMemory(supabase, contact.id, message, aiReply).catch(console.error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ai_reply: aiReply, conversation_id: conversation.id }),
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

async function extractMemory(supabase: any, contactId: string, userMsg: string, aiReply: string) {
  try {
    const extractPrompt = `حلل الرسالة التالية واستخرج أي معلومات مهمة عن العميل.
أرجع JSON array فقط (بدون أي نص إضافي). كل عنصر يحتوي: {"memory_type": "preference|complaint|interest|order|note", "key": "وصف قصير", "value": "القيمة"}
إذا لم توجد معلومات مهمة، أرجع: []

رسالة العميل: ${userMsg}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
        "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
        "X-Title": "WhatsApp Bot Memory",
      },
      body: JSON.stringify({
        model: "stepfun/step-3.5-flash:free",
        messages: [{ role: "user", content: extractPrompt }],
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content || content === "[]") return;

    // Try parsing JSON
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
