import { useState, useRef, useEffect, useCallback } from "react";
import { createUtterance, cleanForTTS } from "@/utils/tts";
import ReactMarkdown from "react-markdown";
import { WeatherData } from "@/hooks/useWeather";
import CameraCapture from "@/components/CameraCapture";

type Msg = { role: "user" | "assistant"; content: string; image?: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

// Voice trigger keywords for camera
const CAMERA_TRIGGERS = ["take a picture", "take photo", "scan", "camera", "show me", "look at", "analyze this", "what is this", "pest", "disease", "check my crop"];

// Hook: track mouse position for refractive light shift
const useMouseLight = () => {
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);
  return pos;
};

interface ChatBubbleProps {
  farmerName: string;
  onThinkingChange?: (thinking: boolean) => void;
  weather?: WeatherData | null;
}

const ChatBubble = ({ farmerName, onThinkingChange, weather }: ChatBubbleProps) => {
  const mouseLight = useMouseLight();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Browser-native TTS (free, no API key needed)
  const speak = useCallback((text: string) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    const clean = cleanForTTS(text);
    if (!clean) return;

    setIsSpeaking(true);
    setBubbleVisible(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    const utterance = createUtterance(text);
    utterance.onend = () => {
      setIsSpeaking(false);
      fadeTimerRef.current = setTimeout(() => setBubbleVisible(false), 4000);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      fadeTimerRef.current = setTimeout(() => setBubbleVisible(false), 4000);
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => { onThinkingChange?.(isLoading); }, [isLoading, onThinkingChange]);

  // Check if voice input triggers camera
  const checkCameraTrigger = useCallback((text: string): boolean => {
    const lower = text.toLowerCase();
    return CAMERA_TRIGGERS.some(trigger => lower.includes(trigger));
  }, []);

  const send = useCallback(async (text?: string, imageBase64?: string) => {
    const msg = (text || input).trim();
    if ((!msg && !imageBase64) || isLoading) return;

    const userMsg: Msg = {
      role: "user",
      content: imageBase64 ? (msg || "Analyze this image for pest or farming issues.") : msg,
      image: imageBase64,
    };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setPendingImage(null);
    setIsLoading(true);
    setBubbleVisible(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    const weatherContext = weather
      ? `\n[Current weather at ${weather.locationName}: ${weather.description}, ${weather.temperature}°C, humidity ${weather.humidity}%, wind ${weather.windSpeed} km/h. Today's forecast: high ${weather.daily.maxTemp}°C, low ${weather.daily.minTemp}°C, precipitation ${weather.daily.precipitationSum}mm, rain probability ${weather.daily.precipitationProbability}%]`
      : "";

    const contextMessages = allMessages.map((m, i) => {
      const base: any = { role: m.role, content: m.content };
      if (m.image) base.image = m.image;
      if (i === 0 && m.role === "user") {
        base.content = `[Farmer name: ${farmerName}]${weatherContext} ${m.content}`;
      }
      return base;
    });

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: contextMessages }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Something went wrong" }));
        setMessages(prev => [...prev, { role: "assistant", content: err.error || "Even my circuits are confused. Try again?" }]);
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                return [...prev, { role: "assistant", content: assistantText }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Speak the final response
      if (assistantText) speak(assistantText);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong — try again. 🌿" }]);
    }
    setIsLoading(false);
  }, [input, isLoading, messages, farmerName, weather, speak]);

  const handleImageCapture = useCallback((base64: string) => {
    setPendingImage(base64);
    send("Please analyze this image. Identify any pests, diseases, or farming issues you can see. Provide practical advice.", base64);
  }, [send]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) { setShowTextInput(true); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-ZA"; // South African English
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      setIsListening(false);
      const transcript = event.results[0][0].transcript;
      // Check if user wants camera
      if (checkCameraTrigger(transcript)) {
        setShowCamera(true);
      } else {
        send(transcript);
      }
    };
    recognition.onerror = () => { setIsListening(false); setShowTextInput(true); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [send, checkCameraTrigger]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setIsListening(false); }, []);

  const latestAssistant = [...messages].reverse().find(m => m.role === "assistant");
  const latestUserImage = [...messages].reverse().find(m => m.role === "user" && m.image);
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col w-full items-center gap-4" style={{ animation: "chatSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
      {/* Camera overlay */}
      {showCamera && (
        <CameraCapture
          onCapture={(base64) => {
            setShowCamera(false);
            handleImageCapture(base64);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Image preview if last message had image */}
      {latestUserImage?.image && bubbleVisible && (
        <div style={{ maxWidth: 240, width: "75%" }}>
          <img
            src={`data:image/jpeg;base64,${latestUserImage.image}`}
            alt="Captured crop"
            style={{
              width: "100%",
              height: 100,
              objectFit: "cover",
              borderRadius: 20,
              border: "2px solid hsla(135, 30%, 50%, 0.2)",
            }}
          />
        </div>
      )}

      {/* Response bubble — floating, fades in/out */}
      {(latestAssistant || isLoading) && (
        <div
          className="relative"
          style={{
            maxWidth: 240,
            width: "75%",
            opacity: bubbleVisible ? 1 : 0,
            transform: bubbleVisible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
            pointerEvents: bubbleVisible ? "auto" : "none",
          }}
        >
          {/* Refractive caret */}
          <div style={{
            position: "absolute", top: -6, left: "50%", transform: "translateX(-50%) rotate(45deg)",
            width: 10, height: 10,
            background: `linear-gradient(${135 + mouseLight.x * 30}deg, hsla(135, 20%, 98%, 0.55), hsla(180, 30%, 96%, 0.35))`,
            backdropFilter: "blur(20px) saturate(1.6)",
            WebkitBackdropFilter: "blur(20px) saturate(1.6)",
            borderTop: "1px solid hsla(0, 0%, 100%, 0.5)",
            borderLeft: "1px solid hsla(0, 0%, 100%, 0.5)",
          }} />
          {/* Main glass panel */}
          <div style={{
            padding: "14px 16px",
            borderRadius: 28,
            position: "relative",
            overflow: "hidden",
            background: `linear-gradient(${120 + mouseLight.x * 40}deg, 
              hsla(135, 22%, 98%, 0.55) 0%, 
              hsla(${140 + mouseLight.x * 20}, 18%, 97%, 0.4) 50%, 
              hsla(135, 15%, 96%, 0.35) 100%)`,
            backdropFilter: "blur(40px) saturate(1.8) brightness(1.02)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8) brightness(1.02)",
            boxShadow: `
              0 8px 32px hsla(130, 25%, 30%, 0.08),
              0 2px 8px hsla(130, 20%, 30%, 0.04),
              inset 0 1px 0 hsla(0, 0%, 100%, 0.65),
              inset 0 -1px 0 hsla(130, 20%, 50%, 0.06),
              0 0 0 0.5px hsla(0, 0%, 100%, 0.35)
            `,
            border: "1px solid hsla(0, 0%, 100%, 0.4)",
            color: "hsl(0, 0%, 20%)",
            fontSize: 13,
            fontFamily: FONT,
            lineHeight: 1.55,
            minHeight: 36,
            transition: "background 0.6s ease, border-color 0.6s ease",
          }}>
            {/* Refractive light band — shifts with mouse */}
            <div style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: 28,
              pointerEvents: "none",
              background: `linear-gradient(${100 + mouseLight.x * 80}deg, 
                transparent 0%, 
                hsla(${160 + mouseLight.x * 40}, 50%, 92%, 0.12) ${30 + mouseLight.y * 20}%, 
                hsla(0, 0%, 100%, 0.08) ${50 + mouseLight.y * 10}%, 
                transparent 70%)`,
              transition: "background 0.3s ease",
            }} />
            {/* Prismatic edge highlight */}
            <div style={{
              position: "absolute",
              top: 0, left: 0, right: 0, height: 1,
              borderRadius: "28px 28px 0 0",
              pointerEvents: "none",
              background: `linear-gradient(90deg, 
                transparent 10%, 
                hsla(${180 + mouseLight.x * 60}, 60%, 85%, 0.3) ${mouseLight.x * 100}%, 
                hsla(${120 + mouseLight.x * 40}, 50%, 80%, 0.25) ${mouseLight.x * 100 + 15}%, 
                transparent 90%)`,
            }} />
            {isLoading && !latestAssistant?.content ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center", color: "hsl(0, 0%, 55%)", position: "relative", zIndex: 1 }}>
                <span style={{ animation: "thinkDot 1.4s infinite 0s", fontSize: 10 }}>●</span>
                <span style={{ animation: "thinkDot 1.4s infinite 0.2s", fontSize: 10 }}>●</span>
                <span style={{ animation: "thinkDot 1.4s infinite 0.4s", fontSize: 10 }}>●</span>
                <span style={{ marginLeft: 4, fontSize: 11, fontStyle: "italic", color: "hsl(0, 0%, 50%)" }}>
                  {pendingImage ? "analyzing photo…" : "thinking…"}
                </span>
              </div>
            ) : latestAssistant ? (
              <div className="prose prose-sm max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1 [&_strong]:text-[hsl(0,0%,15%)]" style={{ fontSize: 13, position: "relative", zIndex: 1 }}>
                <ReactMarkdown>{latestAssistant.content}</ReactMarkdown>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* History */}
      {messages.length > 1 && (
        <div
          ref={scrollRef}
          className="flex flex-col gap-1.5 overflow-y-auto w-full px-1"
          style={{ maxHeight: "18dvh", maxWidth: 240 }}
        >
          {messages.slice(0, -1).map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div style={{
                maxWidth: "80%",
                padding: "8px 14px",
                borderRadius: msg.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                position: "relative",
                overflow: "hidden",
                background: msg.role === "user"
                  ? `linear-gradient(${120 + mouseLight.x * 40}deg, hsla(135, 30%, 48%, 0.2) 0%, hsla(${140 + mouseLight.x * 20}, 25%, 55%, 0.12) 100%)`
                  : `linear-gradient(${120 + mouseLight.x * 40}deg, hsla(135, 22%, 98%, 0.5) 0%, hsla(${140 + mouseLight.x * 20}, 18%, 97%, 0.35) 100%)`,
                backdropFilter: "blur(40px) saturate(1.8) brightness(1.01)",
                WebkitBackdropFilter: "blur(40px) saturate(1.8) brightness(1.01)",
                boxShadow: msg.role === "user"
                  ? "inset 0 1px 0 hsla(0, 0%, 100%, 0.35), 0 0 0 0.5px hsla(135, 30%, 50%, 0.15)"
                  : "inset 0 1px 0 hsla(0, 0%, 100%, 0.45), 0 0 0 0.5px hsla(0, 0%, 100%, 0.25)",
                border: "1px solid hsla(0, 0%, 100%, 0.3)",
                color: "hsl(0, 0%, 30%)",
                fontSize: 12,
                fontFamily: FONT,
                lineHeight: 1.45,
                opacity: 0.7,
                transition: "background 0.5s ease",
              }}>
                {/* Subtle refraction band on history bubbles */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                  pointerEvents: "none",
                  background: `linear-gradient(${100 + mouseLight.x * 60}deg, transparent 20%, hsla(${160 + mouseLight.x * 30}, 40%, 90%, 0.08) 50%, transparent 80%)`,
                  borderRadius: "inherit",
                }} />
                {msg.image && (
                  <div style={{ fontSize: 10, color: "hsl(130, 25%, 45%)", marginBottom: 2, position: "relative", zIndex: 1 }}>📷 Photo attached</div>
                )}
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs max-w-none [&>p]:m-0" style={{ position: "relative", zIndex: 1 }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : <span style={{ position: "relative", zIndex: 1 }}>{msg.content}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex flex-col items-center gap-3 w-full" style={{ maxWidth: 240 }}>
        {/* Voice + Camera buttons */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button
            onClick={() => setShowCamera(true)}
            disabled={isLoading}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "none",
              background: isLoading ? "hsl(0, 0%, 88%)" : "hsla(135, 30%, 48%, 0.15)",
              color: isLoading ? "hsl(0, 0%, 65%)" : "hsl(135, 35%, 40%)",
              fontSize: 20,
              cursor: isLoading ? "default" : "pointer",
              transition: "all 0.3s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Take a photo for analysis"
          >
            📷
          </button>

          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isLoading}
            style={{
              width: isListening ? 60 : 50,
              height: isListening ? 60 : 50,
              borderRadius: "50%",
              border: "none",
              background: isListening
                ? "hsl(0, 55%, 52%)"
                : isLoading
                  ? "hsl(0, 0%, 88%)"
                  : "hsl(135, 35%, 45%)",
              color: "hsl(0, 0%, 100%)",
              fontSize: isListening ? 22 : 18,
              cursor: isLoading ? "default" : "pointer",
              transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              boxShadow: isListening
                ? "0 0 0 8px hsla(0, 55%, 52%, 0.15), 0 4px 20px hsla(0, 40%, 40%, 0.2)"
                : "0 4px 16px hsla(135, 30%, 30%, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: isListening ? "voicePulse 1.5s ease-in-out infinite" : undefined,
            }}
          >
            {isListening ? "⏹" : "🎤"}
          </button>

          {isSpeaking && (
            <button
              onClick={() => { window.speechSynthesis.cancel(); audioRef.current?.pause(); setIsSpeaking(false); }}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: "hsla(0, 0%, 0%, 0.06)",
                color: "hsl(130, 30%, 45%)",
                fontSize: 20,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "voicePulse 1.5s ease-in-out infinite",
              }}
              title="Stop speaking"
            >
              🔊
            </button>
          )}
        </div>

        <span style={{ fontSize: 11, color: "hsl(0, 0%, 55%)", fontFamily: FONT, letterSpacing: "0.04em" }}>
          {isSpeaking ? "🔊 Speaking…" : isListening ? "Listening… (say 'take a picture' for camera)" : hasMessages ? "Tap to speak" : "Tap to ask anything"}
        </span>

        {!showTextInput && (
          <button
            onClick={() => { setShowTextInput(true); setTimeout(() => inputRef.current?.focus(), 100); }}
            style={{
              background: "none", border: "none", fontSize: 12, color: "hsl(0, 0%, 55%)", cursor: "pointer",
              fontFamily: FONT, padding: "2px 8px", opacity: 0.7,
              textDecoration: "none", borderBottom: "1px solid hsla(0, 0%, 55%, 0.3)",
            }}
          >
            or type instead
          </button>
        )}

        {showTextInput && (
          <div className="flex gap-2 w-full" style={{ animation: "chatSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Type your question…"
              style={{
                flex: 1,
                padding: "11px 16px",
                borderRadius: 16,
                border: "1px solid hsla(0, 0%, 0%, 0.06)",
                background: "hsla(0, 0%, 100%, 0.7)",
                backdropFilter: "blur(12px)",
                fontSize: 14,
                fontFamily: FONT,
                outline: "none",
                color: "hsl(0, 0%, 20%)",
                transition: "border-color 0.2s",
                letterSpacing: "0.01em",
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || isLoading}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                border: "none",
                background: input.trim() && !isLoading ? "hsl(135, 35%, 45%)" : "hsl(0, 0%, 88%)",
                color: input.trim() && !isLoading ? "hsl(0, 0%, 100%)" : "hsl(0, 0%, 65%)",
                fontSize: 16,
                cursor: input.trim() && !isLoading ? "pointer" : "default",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
              }}
            >
              ↑
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes chatSlide {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes thinkDot {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 1; }
        }
        @keyframes voicePulse {
          0%, 100% { box-shadow: 0 0 0 8px hsla(0, 55%, 52%, 0.15), 0 4px 20px hsla(0, 40%, 40%, 0.2); }
          50% { box-shadow: 0 0 0 14px hsla(0, 55%, 52%, 0.06), 0 4px 24px hsla(0, 40%, 40%, 0.25); }
        }
      `}</style>
    </div>
  );
};

export default ChatBubble;
