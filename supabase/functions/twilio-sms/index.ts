import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function buildGoogleCalendarUrl(task: { task_title: string; due_date: string; task_description?: string }): string {
  const date = task.due_date.replace(/-/g, "");
  const title = encodeURIComponent(task.task_title);
  const details = encodeURIComponent(task.task_description || "Farm task from abuti Spinach");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}/${date}&details=${details}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const { phone: rawPhone, type, weather, farmPlans, farmerName, fromNumber } = await req.json();

    // Normalize to E.164 (default to South Africa +27 if local format)
    let phone = (rawPhone || "").replace(/[\s\-()]/g, "");
    if (phone.startsWith("00")) phone = "+" + phone.slice(2);
    if (!phone.startsWith("+")) {
      if (phone.startsWith("0")) phone = "+27" + phone.slice(1);
      else if (/^27\d{9}$/.test(phone)) phone = "+" + phone;
      else phone = "+" + phone;
    }

    if (!/^\+\d{8,15}$/.test(phone)) {
      return new Response(JSON.stringify({ error: `Invalid phone number: ${rawPhone}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let message = "";

    if (type === "welcome") {
      const name = farmerName || "Farmer";
      message = `Yo ${name}! It's abuti Spinach - your personal farming sidekick. You're officially part of the crew now.`;

      if (weather) {
        message += ` Right now in ${weather.locationName}: ${weather.description}, ${weather.temperature}C.`;
      }

      if (farmPlans && farmPlans.length > 0) {
        const upcoming = farmPlans.slice(0, 2);
        message += ` Upcoming: ${upcoming.map((p: any) => `${p.task_title} (${p.due_date})`).join(", ")}.`;
        message += ` Add to calendar: ${buildGoogleCalendarUrl(upcoming[0])}`;
      }

      message += ` No internet? Dial *384*87343# to chat with me anytime. Let's grow something great!`;
    } else if (type === "weather-alert") {
      const name = farmerName || "Farmer";
      message = `ALERT ${name}!`;

      if (weather) {
        message += ` ${weather.locationName}: ${weather.description}, ${weather.temperature}C, wind ${weather.windSpeed}km/h.`;
      }

      if (weather?.warnings && weather.warnings.length > 0) {
        message += ` Warnings: ${weather.warnings.join(", ")}.`;
      }

      message += ` Stay safe. More info: Dial *384*87343#`;
    } else if (type === "farm-plan") {
      const name = farmerName || "Farmer";
      message = `${name}, your farm plan update:`;

      if (farmPlans && farmPlans.length > 0) {
        const tasks = farmPlans.slice(0, 3);
        message += ` ${tasks.map((p: any) => `${p.task_title} (${p.due_date})`).join(", ")}.`;
        message += ` Add to Google Calendar: ${buildGoogleCalendarUrl(tasks[0])}`;
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use 'welcome', 'weather-alert', or 'farm-plan'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Truncate to SMS limit
    if (message.length > 1600) {
      message = message.slice(0, 1597) + "...";
    }

    // First, get a Twilio phone number to use as "From"
    let twilioFrom = fromNumber || "";
    
    if (!twilioFrom) {
      // List available phone numbers from Twilio
      try {
        const numbersResp = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
          },
        });
        
        if (numbersResp.ok) {
          const numbersData = await numbersResp.json();
          if (numbersData.incoming_phone_numbers && numbersData.incoming_phone_numbers.length > 0) {
            twilioFrom = numbersData.incoming_phone_numbers[0].phone_number;
          }
        }
      } catch (e) {
        console.error("Failed to fetch Twilio numbers:", e);
      }
    }

    if (!twilioFrom) {
      return new Response(JSON.stringify({ error: "No Twilio phone number available. Please configure a Twilio phone number." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send SMS via Twilio gateway
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: twilioFrom,
        Body: message,
      }),
    });

    const result = await response.json();
    console.log("Twilio SMS result:", JSON.stringify(result));

    if (!response.ok) {
      throw new Error(`Twilio API error [${response.status}]: ${JSON.stringify(result)}`);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("twilio-sms error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
