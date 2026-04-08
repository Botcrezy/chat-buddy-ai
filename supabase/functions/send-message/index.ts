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

    const { conversation_id, content } = await req.json();

    if (!conversation_id || !content) {
      return new Response(JSON.stringify({ error: "conversation_id and content required" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Get conversation with contact
    const { data: conversation } = await supabase
      .from("conversations")
      .select("*, contacts(*)")
      .eq("id", conversation_id)
      .single();

    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Save the message
    await supabase.from("messages").insert({
      conversation_id,
      content,
      direction: "out",
      sender_type: "agent",
    });

    // Update conversation
    await supabase
      .from("conversations")
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq("id", conversation_id);

    // Get Baileys server URL from settings to forward message
    // The VPS server will handle the actual WhatsApp sending
    // For now, we store the message and the VPS polls or receives webhook

    return new Response(
      JSON.stringify({
        success: true,
        phone: conversation.contacts?.phone,
        message: content,
      }),
      { headers: { ...corsH, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send message error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsH, "Content-Type": "application/json" } }
    );
  }
});
