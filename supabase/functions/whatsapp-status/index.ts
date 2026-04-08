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

    if (req.method === "POST") {
      // Update session status from Baileys server
      const { session_id, status, phone_number, qr_code } = await req.json();

      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (phone_number) updateData.phone_number = phone_number;
      if (qr_code !== undefined) updateData.qr_code = qr_code;
      if (status === "connected") updateData.connected_at = new Date().toISOString();

      await supabase
        .from("whatsapp_sessions")
        .upsert({ session_id: session_id || "default", ...updateData }, { onConflict: "session_id" });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // GET - return current status
    const { data: session } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    return new Response(JSON.stringify(session || { status: "disconnected" }), {
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("WhatsApp status error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsH, "Content-Type": "application/json" } }
    );
  }
});
