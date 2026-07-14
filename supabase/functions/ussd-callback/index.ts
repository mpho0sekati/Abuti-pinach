import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHAT_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/chat";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

// Simple session store (in production use Redis/DB)
const sessions = new Map<string, { history: Array<{ role: string; content: string }>; lastMenu: string }>();

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
    const sessionId = formData.get("sessionId") as string;
    const serviceCode = formData.get("serviceCode") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const text = formData.get("text") as string || "";

    // Validate required fields
    if (!sessionId || !phoneNumber) {
      return new Response("END Invalid request.", {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      return new Response("END Invalid phone number.", {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const sanitizedText = sanitizeInput(text);
    const parts = sanitizedText.split("*").filter(Boolean);
    let session = sessions.get(sessionId);

    if (!session) {
      session = { history: [], lastMenu: "main" };
      sessions.set(sessionId, session);
    }

    let response = "";

    if (sanitizedText === "") {
      response = "CON Welcome to abuti Spinach\n";
      response += "Your pocket farming advisor\n\n";
      response += "1. Ask a farming question\n";
      response += "2. Get weather advice\n";
      response += "3. Crop recommendations\n";
      response += "4. Pest & disease help";
      session.lastMenu = "main";
    } else if (parts.length === 1 && ["1", "2", "3", "4"].includes(parts[0])) {
      const prompts: Record<string, string> = {
        "1": "CON Type your farming question:",
        "2": "CON Which region are you farming in?\n(Type your location)",
        "3": "CON What's your soil type?\n1. Clay\n2. Sandy\n3. Loam\n4. Silt\n5. Not sure",
        "4": "CON Describe the symptoms you see:\n(e.g. yellow leaves, spots, wilting)",
      };
      response = prompts[parts[0]];
      session.lastMenu = parts[0];
    } else {
      let userQuery = "";
      const menuChoice = parts[0];

      if (menuChoice === "1") {
        userQuery = sanitizeInput(parts.slice(1).join(" "), 300);
      } else if (menuChoice === "2") {
        userQuery = `Give me farming weather advice for the region: ${sanitizeInput(parts.slice(1).join(" "), 100)}. Keep it very short for USSD.`;
      } else if (menuChoice === "3") {
        const soils: Record<string, string> = { "1": "clay", "2": "sandy", "3": "loam", "4": "silt", "5": "unknown" };
        const soilType = soils[parts[1]] || sanitizeInput(parts[1] || "unknown", 50);
        userQuery = `Recommend crops for ${soilType} soil. Keep it very short for USSD (max 160 chars).`;
      } else if (menuChoice === "4") {
        userQuery = `Diagnose this crop issue: ${sanitizeInput(parts.slice(1).join(" "), 300)}. Keep it very short for USSD.`;
      } else {
        userQuery = sanitizeInput(text, 300);
      }

      try {
        const chatResp = await fetch(CHAT_URL!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              ...session.history,
              { role: "user", content: `[Via USSD, phone: ${phoneNumber}] ${userQuery}. IMPORTANT: Keep response under 160 characters, no emojis, no markdown.` },
            ],
            channel: "ussd",
          }),
        });

        if (chatResp.ok && chatResp.body) {
          const reader = chatResp.body.getReader();
          const decoder = new TextDecoder();
          let aiText = "";
          let buffer = "";

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

          const clean = aiText.replace(/[*#_`]/g, "").replace(/\n+/g, " ").trim();
          const truncated = clean.length > 160 ? clean.slice(0, 157) + "..." : clean;

          session.history.push({ role: "user", content: userQuery });
          session.history.push({ role: "assistant", content: aiText });

          response = `END abuti Spinach:\n${truncated}`;
        } else {
          response = "END abuti Spinach is taking a nap. Try again later!";
        }
      } catch {
        response = "END Could not reach AgriAI. Try again later.";
      }
    }

    sessions.set(sessionId, session);

    return new Response(response, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (e) {
    console.error("USSD error:", e);
    return new Response("END Something went wrong. Try again.", {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
