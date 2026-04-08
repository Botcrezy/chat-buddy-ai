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

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Get campaign
    const { data: campaign } = await supabase
      .from("broadcast_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Get target contacts
    let contactsQuery = supabase.from("contacts").select("id, phone, name");
    if (campaign.target_category && campaign.target_category !== "all") {
      contactsQuery = contactsQuery.eq("category", campaign.target_category);
    }
    const { data: contacts } = await contactsQuery;

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ error: "No contacts found" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Update campaign status
    await supabase.from("broadcast_campaigns").update({
      status: "sending",
      total_recipients: contacts.length,
      sent_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    // Create recipients
    const recipients = contacts.map((c: any) => ({
      campaign_id,
      contact_id: c.id,
      status: "pending",
    }));
    await supabase.from("broadcast_recipients").insert(recipients);

    // Get WhatsApp session for server URL
    const { data: session } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .eq("status", "connected")
      .limit(1)
      .single();

    let sentCount = 0;
    let failedCount = 0;

    // Send messages one by one with delay
    for (const contact of contacts) {
      try {
        // Save message in DB
        let { data: conv } = await supabase
          .from("conversations")
          .select("id")
          .eq("contact_id", contact.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!conv) {
          const { data: newConv } = await supabase
            .from("conversations")
            .insert({ contact_id: contact.id, status: "open", is_ai_active: true })
            .select("id")
            .single();
          conv = newConv;
        }

        if (conv) {
          await supabase.from("messages").insert({
            conversation_id: conv.id,
            content: campaign.content,
            direction: "out",
            sender_type: "agent",
            media_url: campaign.media_url,
            media_type: campaign.media_type,
          });

          await supabase.from("conversations").update({
            last_message: campaign.content,
            last_message_at: new Date().toISOString(),
          }).eq("id", conv.id);
        }

        // Update recipient status
        await supabase.from("broadcast_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("campaign_id", campaign_id)
          .eq("contact_id", contact.id);

        sentCount++;

        // Update campaign progress
        await supabase.from("broadcast_campaigns").update({
          sent_count: sentCount,
        }).eq("id", campaign_id);

        // Delay between messages (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e: any) {
        failedCount++;
        await supabase.from("broadcast_recipients")
          .update({ status: "failed", error_message: e.message })
          .eq("campaign_id", campaign_id)
          .eq("contact_id", contact.id);

        await supabase.from("broadcast_campaigns").update({
          failed_count: failedCount,
        }).eq("id", campaign_id);
      }
    }

    // Mark campaign as completed
    await supabase.from("broadcast_campaigns").update({
      status: "completed",
      sent_count: sentCount,
      failed_count: failedCount,
    }).eq("id", campaign_id);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failedCount }),
      { headers: { ...corsH, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Broadcast error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsH, "Content-Type": "application/json" } }
    );
  }
});
