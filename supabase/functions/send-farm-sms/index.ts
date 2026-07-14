import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AT_API_KEY = Deno.env.get("AT_API_KEY");
const AT_USERNAME = "sandbox";
const AT_SMS_URL = "https://api.sandbox.africastalking.com/version1/messaging";

function buildGoogleCalendarUrl(task: { task_title: string; due_date: string; task_description?: string }): string {
  const date = task.due_date.replace(/-/g, "");
  const title = encodeURIComponent(task.task_title);
  const details = encodeURIComponent(task.task_description || "Farm task from abuti Spinach");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}/${date}&details=${details}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!AT_API_KEY) throw new Error("AT_API_KEY is not configured");

    const { phone, type, weather, farmPlans, farmerName, location } = await req.json();

    if (!phone || !/^\+?\d{7,15}$/.test(phone.replace(/\s/g, ""))) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let message = "";

    if (type === "welcome") {
      const name = farmerName || "Farmer";
      message = `Yo ${name}! It's abuti Spinach here - your personal farming sidekick. You're officially part of the crew now.`;

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
      // Weather warning SMS
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
      // Farm plan update with calendar links
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

    // Truncate to SMS limit (keep URL intact if possible)
    if (message.length > 320) {
      message = message.slice(0, 317) + "...";
    }

    // Send SMS via Africa's Talking
    const smsBody = new URLSearchParams({
      username: AT_USERNAME,
      to: phone,
      message,
    });

    const smsResp = await fetch(AT_SMS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey: AT_API_KEY,
        Accept: "application/json",
      },
      body: smsBody.toString(),
    });

    const result = await smsResp.json();
    console.log("Farm SMS result:", JSON.stringify(result));

    return new Response(JSON.stringify({ success: smsResp.ok, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-farm-sms error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
