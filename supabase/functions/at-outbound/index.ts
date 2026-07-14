import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AT_API_KEY = Deno.env.get("AT_API_KEY");
const AT_USERNAME = "sandbox";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const AT_VOICE_URL = "https://voice.sandbox.africastalking.com/call";
const AT_SMS_URL = "https://api.sandbox.africastalking.com/version1/messaging";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!AT_API_KEY) throw new Error("AT_API_KEY is not configured");

    const { action, phone, message } = await req.json();

    if (action === "call") {
      // Initiate outbound voice call
      const body = new URLSearchParams({
        username: AT_USERNAME,
        to: phone,
        from: "", // sandbox doesn't need a caller ID
      });

      const resp = await fetch(AT_VOICE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: AT_API_KEY,
          Accept: "application/json",
        },
        body: body.toString(),
      });

      const result = await resp.json();
      return new Response(JSON.stringify({ success: resp.ok, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sms") {
      // Send SMS
      const body = new URLSearchParams({
        username: AT_USERNAME,
        to: phone,
        message: message || "Hello from abuti Spinach! 🌿 Text us your farming questions anytime.",
      });

      const resp = await fetch(AT_SMS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: AT_API_KEY,
          Accept: "application/json",
        },
        body: body.toString(),
      });

      const result = await resp.json();
      return new Response(JSON.stringify({ success: resp.ok, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'call' or 'sms'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("AT outbound error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
