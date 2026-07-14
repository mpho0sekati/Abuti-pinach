import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHAT_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/chat";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const AT_API_KEY = Deno.env.get("AT_API_KEY");
const AT_USERNAME = "sandbox";
const AT_SMS_URL = "https://api.sandbox.africastalking.com/version1/messaging";

// === INPUT VALIDATION ===
function sanitizeInput(text: string, maxLen = 500): string {
  return text.replace(/[<>]/g, "").trim().slice(0, maxLen);
}

function isValidPhoneNumber(phone: string): boolean {
  return /^\+?\d{7,15}$/.test(phone.replace(/\s/g, ""));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const from = formData.get("from") as string || "";
    const text = formData.get("text") as string || "";
    const to = formData.get("to") as string || "";

    // Validate
    if (!text.trim() || !from) {
      return new Response("OK", { headers: corsHeaders });
    }

    if (!isValidPhoneNumber(from)) {
      console.error("Invalid phone number:", from);
      return new Response("OK", { headers: corsHeaders });
    }

    const sanitizedText = sanitizeInput(text, 500);

    // Get AI response
    let aiText = "abuti Spinach is napping. Try again soon!";
    try {
      const chatResp = await fetch(CHAT_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "user", content: `[Via SMS, farmer phone: ${from}] ${sanitizedText}. Keep response under 160 characters, no emojis, no markdown.` },
          ],
          channel: "sms",
        }),
      });

      if (chatResp.ok && chatResp.body) {
        const reader = chatResp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        aiText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) aiText += content;
            } catch { break; }
          }
        }
      }
    } catch (e) {
      console.error("Chat call failed:", e);
    }

    // Clean and truncate for SMS
    const clean = aiText.replace(/[*#_`]/g, "").replace(/\n+/g, " ").trim();
    const smsText = clean.length > 160 ? clean.slice(0, 157) + "..." : clean;

    // Send SMS reply via Africa's Talking
    const smsBody = new URLSearchParams({
      username: AT_USERNAME,
      to: from,
      message: `abuti Spinach: ${smsText}`,
      from: to || "",
    });

    const smsResp = await fetch(AT_SMS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey: AT_API_KEY!,
        Accept: "application/json",
      },
      body: smsBody.toString(),
    });

    const smsResult = await smsResp.text();
    console.log("SMS send result:", smsResult);

    return new Response("OK", { headers: { ...corsHeaders, "Content-Type": "text/plain" } });
  } catch (e) {
    console.error("SMS callback error:", e);
    return new Response("Error", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
