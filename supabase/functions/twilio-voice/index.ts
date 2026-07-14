import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHAT_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/chat";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

// Session store for voice conversations
const voiceSessions = new Map<string, Array<{ role: string; content: string }>>();

function sanitizeInput(text: string, maxLen = 500): string {
  return text.replace(/[<>]/g, "").trim().slice(0, maxLen);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Twilio sends webhooks as application/x-www-form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        params[key] = value as string;
      }
    } else {
      params = await req.json();
    }

    const callSid = params.CallSid || "";
    const callStatus = params.CallStatus || "";
    const from = params.From || "";
    const speechResult = params.SpeechResult || "";
    const digits = params.Digits || "";

    let history = voiceSessions.get(callSid) || [];

    // New incoming call - play welcome and gather speech
    if (callStatus === "ringing" || callStatus === "in-progress" && history.length === 0) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">
    Welcome to abuti Spinach, your personal farming advisor.
    I'm a sentient ball of green light, and I know more about farming than you'd expect.
    Tell me your farming question after the beep.
  </Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${SUPABASE_URL}/functions/v1/twilio-voice" method="POST">
    <Say voice="man" language="en-US">I'm listening. Go ahead.</Say>
  </Gather>
  <Say voice="man" language="en-US">I didn't hear anything. Goodbye!</Say>
</Response>`;
      
      voiceSessions.set(callSid, []);
      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Process speech input from farmer
    if (speechResult) {
      const sanitized = sanitizeInput(speechResult, 500);
      history.push({ role: "user", content: `[Via phone call, farmer: ${from}] ${sanitized}. Keep response under 200 characters for voice.` });

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

      const cleanText = aiText.replace(/[*#_`]/g, "").replace(/🌿|🌾|🍄|😂|💪|🤷/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").trim();
      history.push({ role: "assistant", content: aiText });
      voiceSessions.set(callSid, history);

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">${cleanText}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${SUPABASE_URL}/functions/v1/twilio-voice" method="POST">
    <Say voice="man" language="en-US">Want to ask another question? Go ahead.</Say>
  </Gather>
  <Say voice="man" language="en-US">Thanks for calling abuti Spinach. Happy farming!</Say>
</Response>`;

      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Call completed
    if (callStatus === "completed") {
      voiceSessions.delete(callSid);
      return new Response("<Response/>", {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Default: gather speech
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${SUPABASE_URL}/functions/v1/twilio-voice" method="POST">
    <Say voice="man" language="en-US">I'm listening. Tell me your farming question.</Say>
  </Gather>
  <Say voice="man" language="en-US">Thanks for calling abuti Spinach. Happy farming!</Say>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (e) {
    console.error("Twilio voice error:", e);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Something went wrong. Please try again later.</Say>
</Response>`;
    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});
