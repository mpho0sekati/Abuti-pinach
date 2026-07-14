import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHAT_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/chat";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

// Session store for voice conversations
const voiceSessions = new Map<string, Array<{ role: string; content: string }>>();

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
    const sessionId = formData.get("sessionId") as string || "";
    const isActive = formData.get("isActive") as string;
    const callerNumber = formData.get("callerNumber") as string || "";
    const dtmfDigits = formData.get("dtmfDigits") as string || "";
    const recordingUrl = formData.get("recordingUrl") as string || "";

    // Validate caller
    if (callerNumber && !isValidPhoneNumber(callerNumber)) {
      console.error("Invalid caller number:", callerNumber);
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="en-US-Standard-D">Invalid request. Goodbye.</Say>
</Response>`;
      return new Response(xml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    let history = voiceSessions.get(sessionId) || [];

    // If call just started
    if (isActive === "1" && history.length === 0) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="en-US-Standard-D" playBeep="false">
    Welcome to abuti Spinach, your personal farming advisor. 
    I'm a sentient ball of green light, and I know more about farming than you'd expect.
    After the beep, tell me your farming question. Press hash when done.
  </Say>
  <Record finishOnKey="#" maxLength="30" trimSilence="true" playBeep="true"
    callbackUrl="${SUPABASE_URL}/functions/v1/voice-callback" />
</Response>`;
      return new Response(xml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // If we have a recording (farmer spoke)
    if (recordingUrl) {
      const sanitizedDigits = sanitizeInput(dtmfDigits, 20);
      const userQuestion = sanitizedDigits
        ? `Farmer pressed: ${sanitizedDigits}`
        : "Give me a general farming tip for today. Be brief and sarcastic.";

      history.push({ role: "user", content: `[Via phone call, farmer: ${callerNumber}] ${userQuestion}. Keep response under 200 characters for voice.` });

      let aiText = "Even my green glow can't help right now. Try again later!";
      try {
        const chatResp = await fetch(CHAT_URL!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ messages: history, channel: "voice" }),
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

      const cleanText = aiText.replace(/[*#_`]/g, "").replace(/🌿|🌾|🍄|😂|💪|🤷/g, "").trim();
      history.push({ role: "assistant", content: aiText });
      voiceSessions.set(sessionId, history);

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="en-US-Standard-D" playBeep="false">${escapeXml(cleanText)}</Say>
  <Say voice="en-US-Standard-D" playBeep="false">
    Want to ask another question? Speak after the beep, or hang up to end.
  </Say>
  <Record finishOnKey="#" maxLength="30" trimSilence="true" playBeep="true"
    callbackUrl="${SUPABASE_URL}/functions/v1/voice-callback" />
</Response>`;

      return new Response(xml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Call ended
    if (isActive === "0") {
      voiceSessions.delete(sessionId);
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="en-US-Standard-D">Thanks for calling abuti Spinach. Happy farming!</Say>
</Response>`;
      return new Response(xml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Default: prompt for input
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="en-US-Standard-D">I'm listening. Speak after the beep.</Say>
  <Record finishOnKey="#" maxLength="30" trimSilence="true" playBeep="true"
    callbackUrl="${SUPABASE_URL}/functions/v1/voice-callback" />
</Response>`;

    return new Response(xml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (e) {
    console.error("Voice error:", e);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="en-US-Standard-D">Something went wrong. Please try again later.</Say>
</Response>`;
    return new Response(xml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
