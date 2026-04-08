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

    // Get active followup rules
    const { data: rules } = await supabase
      .from("followup_rules")
      .select("*")
      .eq("is_active", true);

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: "No active rules" }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    let followupsSent = 0;

    for (const rule of rules) {
      const delayMs = rule.delay_hours * 60 * 60 * 1000;
      const cutoffTime = new Date(Date.now() - delayMs).toISOString();

      if (rule.trigger_type === "no_reply") {
        // Find conversations where last message was from us and customer hasn't replied
        let query = supabase
          .from("conversations")
          .select("id, contact_id, contacts(phone, name, category)")
          .in("status", ["open", "waiting"])
          .lt("last_message_at", cutoffTime);

        if (rule.target_category && rule.target_category !== "all") {
          // Filter by contact category through a subquery approach
        }

        const { data: conversations } = await query.limit(50);

        for (const conv of conversations || []) {
          // Check last message direction
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("direction")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (lastMsg?.direction === "out") {
            // Customer hasn't replied, send followup
            const content = rule.message_template
              .replace("{name}", (conv as any).contacts?.name || "عميلنا");

            await supabase.from("messages").insert({
              conversation_id: conv.id,
              content,
              direction: "out",
              sender_type: "ai",
            });

            await supabase.from("conversations").update({
              last_message: content,
              last_message_at: new Date().toISOString(),
            }).eq("id", conv.id);

            followupsSent++;
          }
        }
      } else if (rule.trigger_type === "periodic") {
        // Send periodic messages to all matching contacts
        let contactsQuery = supabase.from("contacts").select("id, phone, name");
        if (rule.target_category && rule.target_category !== "all") {
          contactsQuery = contactsQuery.eq("category", rule.target_category);
        }
        contactsQuery = contactsQuery.lt("last_message_at", cutoffTime);
        const { data: contacts } = await contactsQuery.limit(20);

        for (const contact of contacts || []) {
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
            const content = rule.message_template
              .replace("{name}", contact.name || "عميلنا");

            await supabase.from("messages").insert({
              conversation_id: conv.id,
              content,
              direction: "out",
              sender_type: "ai",
            });

            await supabase.from("conversations").update({
              last_message: content,
              last_message_at: new Date().toISOString(),
            }).eq("id", conv.id);

            followupsSent++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, followups_sent: followupsSent }),
      { headers: { ...corsH, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Followup check error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsH, "Content-Type": "application/json" } }
    );
  }
});
