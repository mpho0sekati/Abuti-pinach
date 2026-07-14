import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Using "Chris" voice - young, natural male voice that sounds conversational
const DEFAULT_VOICE_ID = "iP95p4xoKVk53GoZ742B";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const { text, voiceId } = await req.json();
    if (!text) throw new Error("No text provided");

    // Clean text for TTS
    const clean = text.replace(/[*_`#\[\]()]/g, "").replace(/\n+/g, ". ").replace(/🌿|🌾|🍄|😂|💪|🤷|🎯|✅|❌|⚡|🔥|💧|🌱|🐛|🦗/g, "").trim();
    if (!clean) throw new Error("Empty text after cleaning");

    const vid = voiceId || DEFAULT_VOICE_ID;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}/stream?output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: clean,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.85,
            style: 0.45,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs error:", response.status, errText);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (e) {
    console.error("TTS error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "TTS error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
