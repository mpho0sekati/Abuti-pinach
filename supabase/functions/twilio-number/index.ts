import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const voiceWebhookUrl = `${SUPABASE_URL}/functions/v1/twilio-voice`;
    const smsWebhookUrl = `${SUPABASE_URL}/functions/v1/twilio-sms`;

    const { action, country, areaCode, phoneNumberSid, phoneNumber } = await req.json();

    const headers = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
    };

    // List owned numbers
    if (action === "list") {
      const resp = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json`, {
        method: "GET",
        headers,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Twilio API error [${resp.status}]: ${JSON.stringify(data)}`);

      const numbers = (data.incoming_phone_numbers || []).map((n: any) => ({
        sid: n.sid,
        phoneNumber: n.phone_number,
        friendlyName: n.friendly_name,
        voiceUrl: n.voice_url,
        smsUrl: n.sms_url,
        capabilities: n.capabilities,
      }));

      return new Response(JSON.stringify({ numbers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search available numbers
    if (action === "search") {
      const countryCode = country || "US";
      let url = `${GATEWAY_URL}/AvailablePhoneNumbers/${countryCode}/Local.json?VoiceEnabled=true&SmsEnabled=true&Limit=10`;
      if (areaCode) url += `&AreaCode=${areaCode}`;

      const resp = await fetch(url, { method: "GET", headers });
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Twilio API error [${resp.status}]: ${JSON.stringify(data)}`);

      const available = (data.available_phone_numbers || []).map((n: any) => ({
        phoneNumber: n.phone_number,
        friendlyName: n.friendly_name,
        locality: n.locality,
        region: n.region,
        capabilities: n.capabilities,
      }));

      return new Response(JSON.stringify({ available }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Purchase a number and configure webhooks
    if (action === "purchase") {
      if (!phoneNumber) throw new Error("phoneNumber is required");

      const resp = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          PhoneNumber: phoneNumber,
          VoiceUrl: voiceWebhookUrl,
          VoiceMethod: "POST",
          SmsUrl: smsWebhookUrl,
          SmsMethod: "POST",
          FriendlyName: "abuti Spinach Farming Line",
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(`Twilio API error [${resp.status}]: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify({
        success: true,
        number: {
          sid: data.sid,
          phoneNumber: data.phone_number,
          friendlyName: data.friendly_name,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configure webhooks on an existing number
    if (action === "configure") {
      if (!phoneNumberSid) throw new Error("phoneNumberSid is required");

      const resp = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers/${phoneNumberSid}.json`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          VoiceUrl: voiceWebhookUrl,
          VoiceMethod: "POST",
          SmsUrl: smsWebhookUrl,
          SmsMethod: "POST",
          FriendlyName: "abuti Spinach Farming Line",
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(`Twilio API error [${resp.status}]: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'list', 'search', 'purchase', or 'configure'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("twilio-number error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
