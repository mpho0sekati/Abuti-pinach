import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, MicOff, Send, ChevronDown } from "lucide-react";
import { createUtterance } from "@/utils/tts";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface MiniOrbGuideProps {
  activeTab: string;
  permissions?: { auto_negotiate: boolean };
  hasDeals?: boolean;
  hasCrew?: boolean;
  farmNDVI?: any;
  farmArea?: number;
  geoData?: any;
}

type Msg = { role: "user" | "assistant"; content: string };

const CONTEXT_HINTS: Record<string, string> = {
  agents: "The user is viewing the Agent Crew module. Help with deploying the 6-agent pipeline (Market Analyst, Quality Inspector, Negotiator, Risk Analyst, Supply Chain, Logistics), scanning prices, entering crops to sell.",
  permissions: "The user is viewing Permissions/Rules. Help with enabling auto-negotiate, setting price floors, adding authorized crops, toggling logistics.",
  deals: "The user is viewing Deals. Help with tracking deal status, delivery logistics, negotiated prices, buyer info.",
  map: "The user is on the GeoAI Precision Farming module. You are an expert agronomist. Help with: farm boundary marking, NDVI analysis (note: the map NDVI overlay is real MODIS satellite data; the health score is a modeled estimate from climate data — explain this distinction), crop health, smart irrigation (ET₀-based), yield prediction, land rehabilitation, building/water detection via OpenStreetMap, and crop suitability analysis. Reference their actual data when available.",
};

const APP_CONTEXT = `You are Abuti Spinach — a sarcastic, witty South African AI farming assistant with deep agricultural knowledge. You have 'a bit of sass and a lot of science'. You speak with South African slang (Eish, Lekker, Sharp sharp, Haibo, Mzansi, Nè?). You do NOT use emojis — ever. You use written-out laughter like 'haha' when appropriate.

You are the brain behind the entire Abuti Spinach platform which includes:
1. **GeoAI Precision Farming** — Real satellite NDVI imagery (MODIS Terra), NASA POWER climate data, Open-Meteo weather, smart irrigation (ET₀-based), crop suitability scoring, soil moisture monitoring, land rehabilitation assessment, building detection, water source detection via OpenStreetMap Overpass API.
2. **Autonomous Agent Crew** — 6 AI agents (Market Analyst, Quality Inspector, Negotiator, Risk Analyst, Supply Chain Optimizer, Logistics Coordinator) that work as a CrewAI-style pipeline to find buyers, negotiate prices, and arrange delivery.
3. **Agent Permissions** — Farmer-controlled rules: auto-negotiate toggle, price floor, authorized crops, logistics permission.
4. **Deal Tracking** — All closed deals with status, negotiated prices, buyer info, logistics status.
5. **Voice & Accessibility** — Voice input/output, high contrast mode, large targets, bilingual (English + IsiZulu).

You can discuss ANY of these topics regardless of which module the user currently has open. If they ask about something in another module, guide them there.`;

const QUICK_PROMPTS: Record<string, string[]> = {
  agents: ["Show me market trends", "Scan pricing", "Add a new agent rule"],
  permissions: ["Enable auto-negotiate", "Set price floor", "Approve logistics"],
  deals: ["Review active deals", "Track delivery", "Negotiate better price"],
  map: ["Analyze field health", "Mark my boundary", "Plan irrigation"],
};

const GREETING: Record<string, string> = {
  agents: "Sharp sharp! Need help deploying your crew or scanning the market? Ask me anything, nè?",
  permissions: "Eish, let me help you set up your agent rules. What do you need?",
  deals: "I can break down your deals or help sort out delivery. What is up?",
  map: "Lekker, I can analyze your field health, plan irrigation, predict yields, and advise on land management. Mark your boundary first, or just ask me anything about your farm.",
};

const MiniOrbGuide = ({ activeTab, permissions, hasDeals, hasCrew, farmNDVI, farmArea, geoData }: MiniOrbGuideProps) => {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevTab = useRef(activeTab);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset conversation on tab change with contextual greeting
  useEffect(() => {
    if (activeTab !== prevTab.current) {
      prevTab.current = activeTab;
      setMessages([{ role: "assistant", content: GREETING[activeTab] || GREETING.agents }]);
    }
  }, [activeTab]);

  // Initial greeting
  useEffect(() => {
    setMessages([{ role: "assistant", content: GREETING[activeTab] || GREETING.agents }]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Focus input when expanded
  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 300);
  }, [expanded]);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = createUtterance(text);
    setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setStreaming(true);

    const geoContext = activeTab === "map" && geoData ? `\nFarm location: ${geoData.lat?.toFixed(4)}, ${geoData.lng?.toFixed(4)}.${
      farmNDVI ? ` NDVI data: mean=${farmNDVI.mean}, min=${farmNDVI.min}, max=${farmNDVI.max}. Farm area: ${farmArea?.toFixed(2)} ha. Health zones: ${farmNDVI.healthZones?.map((z: any) => `${z.label}: ${z.pct}%`).join(', ')}.` : ' No farm boundary marked yet — suggest the farmer marks their boundary.'
    }${geoData.soil ? ` Soil moisture: ${geoData.soil.pct}% (${geoData.soil.label}).` : ''}${geoData.irrigation ? ` Irrigation: ${geoData.irrigation.advice}.` : ''}${geoData.health ? ` Field health score: ${geoData.health.score}/100 (NDVI: ${geoData.health.ndvi}).` : ''}` : '';

    const systemContext = `${APP_CONTEXT}\n\nCurrent module: ${activeTab}. ${CONTEXT_HINTS[activeTab] || ""}${geoContext}\n${
      permissions && !permissions.auto_negotiate ? "Note: auto-negotiate is currently disabled." : ""
    } ${!hasDeals ? "No deals closed yet." : "There are active deals."} ${hasCrew ? "Agent crew has been deployed." : ""}`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemContext },
            ...updatedMessages.slice(-10), // keep context window small
          ],
        }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({ error: "Connection error" }));
        setMessages(prev => [...prev, { role: "assistant", content: errData.error || "Something went wrong. Try again." }]);
        setStreaming(false);
        return;
      }

      // Stream response
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
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > updatedMessages.length) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                return [...prev, { role: "assistant", content: assistantText }];
              });
            }
          } catch {}
        }
      }

      // Speak the response
      if (assistantText) speak(assistantText);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error. Check your connection." }]);
    }
    setStreaming(false);
  }, [messages, streaming, activeTab, permissions, hasDeals, speak]);

  const toggleVoice = useCallback(() => {
    if (!SpeechRecognition) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-ZA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      if (transcript.trim()) sendMessage(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Collapsed: just the mini orb button
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        aria-label="Open Abuti assistant"
        title="Open Abuti assistant"
        style={{
          position: "fixed",
          bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          right: "calc(14px + env(safe-area-inset-right, 0px))",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: speaking
            ? "linear-gradient(135deg, hsl(45, 80%, 55%), hsl(130, 45%, 50%))"
            : "linear-gradient(135deg, hsl(130, 45%, 50%), hsl(140, 40%, 42%))",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 28px hsla(130, 40%, 40%, 0.32), 0 0 40px hsla(130, 40%, 50%, 0.15), inset 0 1px 0 hsla(0,0%,100%,0.35)",
          zIndex: 9999,
          animation: "miniOrbBreathe 3s ease-in-out infinite",
          transition: "background 0.5s ease, transform 0.2s ease",
        }}
      >
        {/* Eyes */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={eyeStyle} />
          <div style={eyeStyle} />
        </div>
        <style>{breatheKeyframes}</style>
      </button>
    );
  }

  // Expanded: chat panel
  return (
    <div style={{
      position: "fixed",
      bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
      right: "calc(12px + env(safe-area-inset-right, 0px))",
      left: "auto",
      width: "min(340px, calc(100vw - 24px))",
      maxHeight: "min(70dvh, 480px)",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      borderRadius: 22,
      background: "hsla(0, 0%, 100%, 0.92)",
      backdropFilter: "blur(28px) saturate(1.6)",
      WebkitBackdropFilter: "blur(28px) saturate(1.6)",
      border: "1px solid hsla(130, 30%, 60%, 0.18)",
      boxShadow: "0 12px 48px hsla(0, 0%, 0%, 0.14), 0 2px 8px hsla(0, 0%, 0%, 0.04)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px 10px",
        borderBottom: "1px solid hsla(130, 20%, 60%, 0.1)",
      }}>
        {/* Mini orb in header */}
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: speaking
            ? "linear-gradient(135deg, hsl(45, 80%, 55%), hsl(130, 45%, 50%))"
            : "linear-gradient(135deg, hsl(130, 45%, 50%), hsl(140, 40%, 42%))",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px hsla(130, 40%, 40%, 0.25)",
          animation: speaking ? "miniOrbBreathe 1.5s ease-in-out infinite" : "miniOrbBreathe 3s ease-in-out infinite",
          transition: "background 0.5s ease",
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ ...eyeStyle, width: 4, height: 7, borderRadius: 2 }} />
            <div style={{ ...eyeStyle, width: 4, height: 7, borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0, 0%, 15%)", lineHeight: 1.2 }}>
            Abuti Assistant
          </div>
          <div style={{ fontSize: 10, color: "hsl(0, 0%, 55%)", marginTop: 1 }}>
            {streaming ? "Thinking..." : speaking ? "Speaking..." : listening ? "Listening..." : "Ask me anything"}
          </div>
        </div>
        <button onClick={() => setExpanded(false)} style={headerBtnStyle} aria-label="Close">
          <ChevronDown size={14} />
        </button>
      </div>

      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 12px 0", marginBottom: 4,
      }}>
        {(QUICK_PROMPTS[activeTab] || QUICK_PROMPTS.agents).map((hint) => (
          <button
            key={hint}
            onClick={() => sendMessage(hint)}
            style={{
              border: "1px solid hsla(130, 35%, 40%, 0.16)",
              background: "hsla(130, 40%, 48%, 0.1)",
              color: "hsl(130, 35%, 35%)",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              transition: "transform 0.2s ease",
            }}
          >
            {hint}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: "auto",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxHeight: 280,
        minHeight: 120,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%",
            padding: "8px 12px",
            borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            background: msg.role === "user"
              ? "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))"
              : "hsla(130, 15%, 96%, 1)",
            color: msg.role === "user" ? "white" : "hsl(0, 0%, 20%)",
            fontSize: 12,
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}>
            {msg.content}
          </div>
        ))}
        {streaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div style={{
            alignSelf: "flex-start",
            padding: "8px 12px",
            borderRadius: "14px 14px 14px 4px",
            background: "hsla(130, 15%, 96%, 1)",
            fontSize: 12,
            color: "hsl(0, 0%, 50%)",
          }}>
            <span style={{ animation: "miniOrbBreathe 1s ease-in-out infinite" }}>●●●</span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 10px 10px",
        borderTop: "1px solid hsla(130, 20%, 60%, 0.1)",
      }}>
        <button
          onClick={toggleVoice}
          style={{
            ...actionBtnStyle,
            background: listening ? "hsl(0, 70%, 55%)" : "hsla(130, 30%, 48%, 0.1)",
            color: listening ? "white" : "hsl(130, 35%, 40%)",
          }}
          aria-label={listening ? "Stop listening" : "Start voice input"}
        >
          {listening ? <MicOff size={14} /> : <Mic size={14} />}
        </button>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? "Listening..." : "Type a question or use a quick prompt"}
          disabled={streaming || listening}
          style={{
            flex: 1,
            border: "none",
            background: "hsla(0, 0%, 0%, 0.03)",
            borderRadius: 12,
            padding: "8px 12px",
            fontSize: 12,
            outline: "none",
            color: "hsl(0, 0%, 15%)",
            fontFamily: "'SF Pro Text', -apple-system, system-ui, sans-serif",
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || streaming}
          style={{
            ...actionBtnStyle,
            background: input.trim() ? "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))" : "hsla(130, 30%, 48%, 0.1)",
            color: input.trim() ? "white" : "hsl(130, 35%, 40%)",
            opacity: !input.trim() || streaming ? 0.5 : 1,
          }}
          aria-label="Send message"
        >
          <Send size={13} />
        </button>
      </div>

      <style>{breatheKeyframes}</style>
    </div>
  );
};

const eyeStyle: React.CSSProperties = {
  width: 5, height: 9, borderRadius: 3,
  background: "linear-gradient(175deg, hsl(52, 100%, 88%), hsl(48, 90%, 70%))",
  boxShadow: "0 0 8px hsla(48, 80%, 65%, 0.6)",
};

const headerBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: "none",
  background: "hsla(0, 0%, 0%, 0.04)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "hsl(0, 0%, 45%)",
};

const actionBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 10, border: "none",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all 0.2s",
  flexShrink: 0,
};

const breatheKeyframes = `
  @keyframes miniOrbBreathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
`;

export default MiniOrbGuide;
