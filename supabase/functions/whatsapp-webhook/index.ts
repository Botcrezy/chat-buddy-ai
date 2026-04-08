import { corsHeaders } from "@anthropic-ai/sdk";
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
    const { phone, name, message, whatsapp_message_id } = body;

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone and message required" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Upsert contact
    const { data: contact } = await supabase
      .from("contacts")
      .upsert({ phone, name: name || phone, last_message_at: new Date().toISOString() }, { onConflict: "phone" })
      .select()
      .single();

    // Get or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("contact_id", contact.id)
      .in("status", ["new", "open"])
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
      content: message,
      direction: "in",
      sender_type: "customer",
      whatsapp_message_id,
    });

    // Update conversation
    await supabase
      .from("conversations")
      .update({
        last_message: message,
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count || 0) + 1,
        status: "open",
      })
      .eq("id", conversation.id);

    // If AI is active, generate reply
    let aiReply = null;
    if (conversation.is_ai_active) {
      // Get bot settings
      const { data: botSettings } = await supabase
        .from("bot_settings")
        .select("*")
        .limit(1)
        .single();

      // Get training data
      const { data: trainingData } = await supabase
        .from("training_data")
        .select("question, answer")
        .eq("is_active", true);

      // Get quick replies
      const { data: quickReplies } = await supabase
        .from("quick_replies")
        .select("title, content");

      const knowledgeBase = (trainingData || [])
        .map((t: any) => `سؤال: ${t.question}\nجواب: ${t.answer}`)
        .join("\n\n");

      const quickRepliesText = (quickReplies || [])
        .map((q: any) => `${q.title}: ${q.content}`)
        .join("\n");

      const systemPrompt = `${botSettings?.personality || "أنت مساعد ذكي للشركة"}

بيانات الشركة:
${knowledgeBase || "لا توجد بيانات تدريب بعد"}

ردود جاهزة يمكن الاستعانة بها:
${quickRepliesText || "لا توجد ردود جاهزة"}

تعليمات:
- أجب بشكل مختصر ومهني باللغة العربية
- إذا لم تعرف الإجابة، قل "سأحول سؤالك لأحد الموظفين"
- لا تخترع معلومات غير موجودة في بيانات الشركة`;

      // Get conversation history
      const { data: history } = await supabase
        .from("messages")
        .select("content, direction, sender_type")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(20);

      const messages = [
        { role: "system", content: systemPrompt },
        ...(history || []).map((m: any) => ({
          role: m.direction === "in" ? "user" : "assistant",
          content: m.content,
        })),
      ];

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          max_tokens: 500,
        }),
      });

      const aiData = await aiResponse.json();
      aiReply = aiData.choices?.[0]?.message?.content;

      if (aiReply) {
        // Check if AI couldn't answer
        if (aiReply.includes("سأحول سؤالك") || aiReply.includes("أحول لموظف")) {
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
