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
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("*, contacts(*)")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      console.error("Conversation lookup error:", convError);
      return new Response(JSON.stringify({ error: "Conversation not found", details: convError?.message }), {
        status: 404, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Get Baileys server URL
    const { data: botSettings } = await supabase
      .from("bot_settings")
      .select("baileys_server_url")
      .limit(1)
      .single();

    const serverUrl = botSettings?.baileys_server_url;
    const phone = conversation.contacts?.phone;

    // Send via WhatsApp
    let whatsappSent = false;
    let whatsappError = null;
    if (serverUrl && phone) {
      try {
        console.log(`Sending to ${phone} via ${serverUrl}/send`);
        const res = await fetch(`${serverUrl}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message: content }),
        });
        const responseText = await res.text();
        if (res.ok) {
          whatsappSent = true;
          console.log(`WhatsApp sent OK to ${phone}`);
        } else {
          whatsappError = responseText;
          console.error(`Baileys send failed (${res.status}):`, responseText);
        }
      } catch (e) {
        whatsappError = e.message;
        console.error("Baileys send error:", e.message);
      }
    } else {
      whatsappError = !serverUrl ? "No baileys_server_url configured" : "No phone number for contact";
      console.error("Cannot send WhatsApp:", whatsappError);
    }

    // Save the message
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id,
      content,
      direction: "out",
      sender_type: "agent",
    });

    if (msgError) {
      console.error("Message save error:", msgError);
    }

    // Update conversation
    await supabase
      .from("conversations")
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return new Response(
      JSON.stringify({ success: true, whatsapp_sent: whatsappSent, phone, whatsapp_error: whatsappError }),
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
