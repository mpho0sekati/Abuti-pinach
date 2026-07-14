import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import GreenOrb, { Emotion } from "@/components/GreenOrb";
import { OrbController, type WeatherAlertLevel } from "@/components/OrbController";
import { useWeather } from "@/hooks/useWeather";
import { useWeatherNotifications } from "@/hooks/useWeatherNotifications";
import { useMultiLocationAlerts } from "@/hooks/useMultiLocationAlerts";
import { supabase } from "@/integrations/supabase/client";
import ProductCarousel, { type Product } from "@/components/ProductCarousel";
import WeatherPopup from "@/components/WeatherPopup";
import MarketPredictionCard, { type MarketPrediction } from "@/components/MarketPredictionCard";
import BiosecurityCard, { type BiosecurityData } from "@/components/BiosecurityCard";
import AccessibilityPanel from "@/components/AccessibilityPanel";
import MiniOrbGuide from "@/components/MiniOrbGuide";
import NotificationSettingsPanel from "@/components/NotificationSettingsPanel";
import TodayDashboard from "@/components/TodayDashboard";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAgentCrew, AgentsContent, PermissionsContent, DealsContent, GeoAIContent } from "@/components/AgentModules";
import { type NDVIData } from "@/components/FarmBoundaryMap";
import { Zap, Map, Shield, Package, X, Mic, ChevronDown, LayoutGrid, Sparkles, WifiOff } from "lucide-react";
import { MarketSkeleton, BiosecuritySkeleton } from "@/components/CardSkeletons";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";
const ACTIVE_EMOTIONS: Emotion[] = ["speaking", "listening", "thinking", "excited", "worried", "eyebrow-raise"];

const FloatingParticles = () => {
  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: 2 + Math.random() * 4, duration: 15 + Math.random() * 25,
      delay: Math.random() * 10, opacity: 0.08 + Math.random() * 0.15,
    })), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size, borderRadius: "50%",
          background: `hsla(130, 40%, 55%, ${p.opacity})`,
          animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite`,
          filter: "blur(0.5px)",
        }} />
      ))}
    </div>
  );
};

// Orbital button positions (around the orb) — distance is a fraction of orb container size
const ORBITAL_BUTTONS = [
  { key: "agents", label: "Auto-assist", icon: Zap, angle: -55, floatDelay: 0 },
  { key: "map", label: "My area", icon: Map, angle: 55, floatDelay: 1.2 },
  { key: "permissions", label: "My rules", icon: Shield, angle: -125, floatDelay: 0.6 },
  { key: "deals", label: "Deals", icon: Package, angle: 125, floatDelay: 1.8 },
] as const;

type DrawerKey = typeof ORBITAL_BUTTONS[number]["key"] | null;

const Index = () => {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const { lang, t, toggleLanguage } = useI18n();

  // ── Behavior-based personalization ─────────────────────────────
  const role = (profile?.primary_role ?? "farmer") as "farmer" | "seller" | "buyer" | "admin";
  const firstName = useMemo(() => (profile?.display_name ?? "").trim().split(/\s+/)[0] || "", [profile?.display_name]);
  const timeGreeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return lang === "zu" ? "Sawubona ekuseni" : "Good morning";
    if (h < 17) return lang === "zu" ? "Sawubona emini" : "Good afternoon";
    return lang === "zu" ? "Sawubona kusihlwa" : "Good evening";
  }, [lang]);

  const roleCopy = useMemo(() => {
    if (role === "seller") return {
      title: lang === "zu" ? "Umsizi wakho wemakethe." : "Your market co-pilot.",
      sub: lang === "zu" ? "Amanani, ama-oda, nabathengi eduze." : "Prices, offers, and buyers nearby.",
    };
    if (role === "buyer") return {
      title: lang === "zu" ? "Thola okusha kubalimi." : "Fresh from local farmers.",
      sub: lang === "zu" ? "Bheka amanani, xoxa idili." : "Compare prices, negotiate deals.",
    };
    return {
      title: lang === "zu" ? "Umngane wepulazi lakho." : "Your farm's AI companion.",
      sub: lang === "zu" ? "Isimo sezulu, izinambuzane, amanani, izinhlelo." : "Weather, pests, prices, plans.",
    };
  }, [role, lang]);

  // Tool usage counts (behavior-based ordering) — scoped per user so sessions don't collide
  const usageKey = useMemo(
    () => `abuti_tool_usage:${profile?.id ?? session?.user?.id ?? "guest"}`,
    [profile?.id, session?.user?.id]
  );
  const lastKey = useMemo(
    () => `abuti_last_tool:${profile?.id ?? session?.user?.id ?? "guest"}`,
    [profile?.id, session?.user?.id]
  );
  const [toolUsage, setToolUsage] = useState<Record<string, number>>({});
  const [lastTool, setLastTool] = useState<string | null>(null);

  // Rehydrate whenever the active user changes (login, profile load, logout)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(usageKey);
      // Migrate legacy un-scoped key once per user
      if (!raw) {
        const legacy = localStorage.getItem("abuti_tool_usage");
        if (legacy) {
          localStorage.setItem(usageKey, legacy);
          setToolUsage(JSON.parse(legacy));
        } else {
          setToolUsage({});
        }
      } else {
        setToolUsage(JSON.parse(raw));
      }
    } catch { setToolUsage({}); }
    setLastTool(localStorage.getItem(lastKey) ?? localStorage.getItem("abuti_last_tool"));
  }, [usageKey, lastKey]);

  const bumpTool = useCallback((key: string) => {
    setToolUsage(prev => {
      const next = { ...prev, [key]: (prev[key] ?? 0) + 1 };
      try { localStorage.setItem(usageKey, JSON.stringify(next)); } catch {}
      return next;
    });
    setLastTool(key);
    try { localStorage.setItem(lastKey, key); } catch {}
  }, [usageKey, lastKey]);

  const orderedTools = useMemo(() => {
    // Role-based priority weights
    const rolePriority: string[] =
      role === "seller" ? ["deals", "agents", "map", "permissions"]
      : role === "buyer" ? ["deals", "map", "agents", "permissions"]
      : ["agents", "map", "deals", "permissions"];
    return [...ORBITAL_BUTTONS].sort((a, b) => {
      const ua = toolUsage[a.key] ?? 0;
      const ub = toolUsage[b.key] ?? 0;
      if (ub !== ua) return ub - ua;
      return rolePriority.indexOf(a.key) - rolePriority.indexOf(b.key);
    });
  }, [toolUsage, role]);
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [caption, setCaption] = useState("");
  const [subtitle, setSubtitle] = useState('Tap the orb, say "Orb", or choose a tool.');
  const orbTapRef = useRef<(() => void) | null>(null);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [lastLogId, setLastLogId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
  const [weatherAlert, setWeatherAlert] = useState<WeatherAlertLevel>("none");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [weatherPopupVisible, setWeatherPopupVisible] = useState(false);
  const [marketPredictions, setMarketPredictions] = useState<MarketPrediction[] | null>(null);
  const [biosecurityData, setBiosecurityData] = useState<BiosecurityData | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem("abuti_hc") === "1");
  const [largeTargets, setLargeTargets] = useState(() => localStorage.getItem("abuti_lt") === "1");


  // Drawer state
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<string>("");

  useEffect(() => {
    const suggestions =
      role === "seller"
        ? ["See today's market prices", "Any new offers on my listings?", "Best time to sell maize?", "How's demand this week?"]
        : role === "buyer"
        ? [t("todayMaizePrice"), "Find fresh produce near me", "Compare seller ratings", "Any deals today?"]
        : [t("checkRain"), t("todayMaizePrice"), "Ask about pest control", "Check fertilizer tips"];
    setSuggestion(suggestions[0]);
    const interval = setInterval(() => {
      setSuggestion(prev => {
        const idx = suggestions.indexOf(prev);
        return suggestions[(idx + 1) % suggestions.length];
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [t, role]);


  // Agent crew
  const crew = useAgentCrew();

  // GeoAI state
  const [geoData, setGeoData] = useState<any>(null);
  const [farmNDVI, setFarmNDVI] = useState<NDVIData | null>(null);
  const [farmArea, setFarmArea] = useState<number>(0);

  const { weather, status: weatherStatus, requestLocation } = useWeather();
  const { permission: notifPermission, supported: notifSupported, requestPermission: requestNotifPermission } = useWeatherNotifications(weather, weatherAlert);
  useMultiLocationAlerts();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const [orbLookDirection, setOrbLookDirection] = useState<"none" | "weather">("none");
  useEffect(() => {
    if (weatherPopupVisible) {
      setOrbLookDirection("weather");
      const t = setTimeout(() => setOrbLookDirection("none"), 15000);
      return () => clearTimeout(t);
    } else setOrbLookDirection("none");
  }, [weatherPopupVisible]);

  const handleWeatherPopup = useCallback(() => setWeatherPopupVisible(true), []);
  const handleToggleHighContrast = useCallback((on: boolean) => { setHighContrast(on); localStorage.setItem("abuti_hc", on ? "1" : "0"); }, []);
  const handleToggleLargeTargets = useCallback((on: boolean) => { setLargeTargets(on); localStorage.setItem("abuti_lt", on ? "1" : "0"); }, []);

  useEffect(() => {
    if (caption) { setCaptionVisible(true); setFeedbackGiven(null); } else setCaptionVisible(false);
  }, [caption]);

  const handleFeedback = useCallback(async (type: "up" | "down") => {
    if (!lastLogId || feedbackGiven) return;
    setFeedbackGiven(type);
    try {
      await (supabase as any).from("conversation_logs").update({ feedback: type, feedback_at: new Date().toISOString() }).eq("id", lastLogId);
    } catch (err) { console.error("Feedback error:", err); }
  }, [lastLogId, feedbackGiven]);

  const handleOrbTap = useCallback(() => { orbTapRef.current?.(); }, []);
  const handleRegisterTap = useCallback((handler: () => void) => { orbTapRef.current = handler; }, []);
  const openDrawer = useCallback((drawer: DrawerKey) => {
    if (!session) {
      navigate("/auth", { state: { from: "/" } });
      return;
    }
    bumpTool(drawer);
    setActiveDrawer(drawer);
  }, [session, navigate, bumpTool]);

  const isActive = ACTIVE_EMOTIONS.includes(emotion);
  const isSpeaking = emotion === "speaking";
  const isListening = emotion === "listening";
  const isThinking = emotion === "thinking";

  const aura = useMemo(() => {
    if (weatherAlert === "severe") return { color: "hsla(0, 70%, 50%,", scale: 2.2, opacity: 0.45, blur: 50, anim: "auraDanger 1s ease-in-out infinite" };
    if (weatherAlert === "moderate") return { color: "hsla(30, 80%, 50%,", scale: 1.8, opacity: 0.35, blur: 45, anim: "auraWarning 1.5s ease-in-out infinite" };
    if (isSpeaking) return { color: "hsla(130, 55%, 50%,", scale: 1.8, opacity: 0.35, blur: 40, anim: "auraPulse 1.5s ease-in-out infinite" };
    if (isListening) return { color: "hsla(120, 50%, 55%,", scale: 2.0, opacity: 0.25, blur: 50, anim: "auraBreath 2s ease-in-out infinite" };
    if (isThinking) return { color: "hsla(140, 40%, 50%,", scale: 1.5, opacity: 0.18, blur: 35, anim: "auraThink 3s ease-in-out infinite" };
    if (emotion === "excited") return { color: "hsla(110, 60%, 55%,", scale: 2.0, opacity: 0.4, blur: 45, anim: "auraPulse 0.8s ease-in-out infinite" };
    if (emotion === "worried") return { color: "hsla(60, 40%, 50%,", scale: 1.4, opacity: 0.15, blur: 30, anim: "auraBreath 2.5s ease-in-out infinite" };
    return { color: "hsla(130, 35%, 55%,", scale: 1.3, opacity: 0.08, blur: 30, anim: "none" };
  }, [emotion, isSpeaking, isListening, isThinking, weatherAlert]);

  const bgGradient = useMemo(() => {
    if (weatherAlert === "severe") return "linear-gradient(180deg, hsl(0, 15%, 96%) 0%, hsl(5, 18%, 93%) 40%, hsl(0, 22%, 89%) 100%)";
    if (weatherAlert === "moderate") return "linear-gradient(180deg, hsl(30, 18%, 96%) 0%, hsl(25, 16%, 93%) 40%, hsl(20, 22%, 89%) 100%)";
    if (isSpeaking) return "linear-gradient(180deg, hsl(85, 18%, 96%) 0%, hsl(110, 16%, 93%) 40%, hsl(100, 22%, 89%) 100%)";
    if (isListening) return "linear-gradient(180deg, hsl(90, 20%, 96%) 0%, hsl(115, 18%, 93%) 40%, hsl(105, 24%, 88%) 100%)";
    if (isThinking) return "linear-gradient(180deg, hsl(80, 12%, 97%) 0%, hsl(100, 10%, 94%) 40%, hsl(90, 15%, 92%) 100%)";
    return "linear-gradient(180deg, hsl(80, 15%, 97%) 0%, hsl(100, 12%, 94%) 40%, hsl(90, 18%, 91%) 100%)";
  }, [emotion, isSpeaking, isListening, isThinking, weatherAlert]);

  // Determine active tab name for MiniOrbGuide context
  const activeTab = activeDrawer || "agents";

  return (
    <div
      className="relative flex flex-col items-center select-none overflow-x-hidden mx-auto w-full"
      style={{
        background: bgGradient,
        transition: "background 1.2s ease",
        minHeight: "100dvh",
        maxWidth: 720,
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <FloatingParticles />

      {weather && (
        <WeatherPopup weather={weather} visible={weatherPopupVisible} onDismiss={() => setWeatherPopupVisible(false)} />
      )}

      {/* Top glass header bar — unifies accessibility + brand */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between mx-auto"
        style={{
          maxWidth: 720,
          height: "calc(56px + env(safe-area-inset-top, 0px))",
          padding: "env(safe-area-inset-top, 0px) 16px 0",
          background: "linear-gradient(180deg, hsla(90, 20%, 98%, 0.78) 0%, hsla(90, 20%, 98%, 0) 100%)",
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
          pointerEvents: "none",
          borderBottom: "0.5px solid rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex gap-2" style={{ pointerEvents: "auto" }}>
          <button
            onClick={() => setShowAccessibility(true)}
            style={{
              width: largeTargets ? 44 : 36, height: largeTargets ? 44 : 36,
              borderRadius: 12, border: "1px solid hsla(130, 25%, 60%, 0.18)",
              background: "hsla(0, 0%, 100%, 0.7)",
              backdropFilter: "blur(20px) saturate(1.4)",
              WebkitBackdropFilter: "blur(20px) saturate(1.4)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 10px hsla(130, 20%, 30%, 0.05)",
              transition: "transform 0.2s ease",
            }}
            aria-label="Accessibility settings"
          >
            <svg width={largeTargets ? 18 : 15} height={largeTargets ? 18 : 15} viewBox="0 0 24 24" fill="none" stroke="hsl(130, 30%, 38%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="4.5" r="2.5" /><path d="m4.5 9 3-1.5h9L20 9" /><path d="M12 11v4" /><path d="m8 21 4-6 4 6" />
            </svg>
          </button>
          <button
            onClick={toggleLanguage}
            style={{
              width: largeTargets ? 44 : 36, height: largeTargets ? 44 : 36,
              borderRadius: 12, border: "1px solid hsla(130, 25%, 60%, 0.18)",
              background: "hsla(0, 0%, 100%, 0.7)",
              backdropFilter: "blur(20px) saturate(1.4)",
              WebkitBackdropFilter: "blur(20px) saturate(1.4)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 10px hsla(130, 20%, 30%, 0.05)",
              fontSize: 11, fontWeight: 700, color: "hsl(130, 30%, 38%)",
              transition: "transform 0.2s ease",
            }}
          >
            {lang.toUpperCase()}
          </button>
          {notifSupported && (
            <button
              onClick={() => setShowNotifSettings(true)}
              title="Weather alert settings"
              aria-label="Weather alert settings"
              style={{
                position: "relative",
                width: largeTargets ? 44 : 36, height: largeTargets ? 44 : 36,
                borderRadius: 12,
                border: notifPermission === "granted"
                  ? "1px solid hsla(130, 40%, 55%, 0.3)"
                  : "1px solid hsla(15, 70%, 55%, 0.35)",
                background: notifPermission === "granted"
                  ? "hsla(130, 50%, 96%, 0.9)"
                  : "hsla(15, 80%, 96%, 0.9)",
                backdropFilter: "blur(20px) saturate(1.4)",
                WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 10px hsla(15, 60%, 40%, 0.08)",
                transition: "transform 0.2s ease",
              }}
            >
              <svg width={largeTargets ? 18 : 15} height={largeTargets ? 18 : 15} viewBox="0 0 24 24" fill="none"
                stroke={notifPermission === "granted" ? "hsl(130, 45%, 30%)" : "hsl(15, 70%, 45%)"}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {notifPermission !== "granted" && (
                <span style={{
                  position: "absolute", top: 6, right: 6,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "hsl(0, 75%, 55%)",
                  boxShadow: "0 0 0 2px hsla(15, 80%, 96%, 1)",
                  animation: "liveDotPulse 2s ease-in-out infinite",
                }} />
              )}
            </button>
          )}

        </div>


        <div className="flex items-center gap-2" style={{ pointerEvents: "auto" }}>
          <span style={{
            fontSize: 14, fontWeight: 600, letterSpacing: "0.04em",
            color: "#1a1a1a", fontFamily: FONT, textTransform: "uppercase",
          }}>Abuti Spinach</span>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, hsl(130, 70%, 65%), hsl(130, 55%, 42%))",
            boxShadow: "0 0 8px hsla(130, 55%, 50%, 0.65)",
            animation: "liveDotPulse 2s ease-in-out infinite",
          }} />
          {role !== "buyer" && (
            <button
              onClick={() => navigate("/toolkit")}
              style={{
                marginLeft: 8, padding: "0 14px", borderRadius: 24,
                border: "1px solid rgba(45,122,58,0.25)",
                background: "hsla(130, 30%, 96%, 0.9)",
                fontSize: 13, fontWeight: 500, color: "#2D7A3A",
                fontFamily: FONT, cursor: "pointer",
                height: 36,
                transition: "all 150ms ease",
              }}
              aria-label="Farmer toolkit"
            >{role === "seller" ? "Seller" : "Toolkit"}</button>
          )}
          <button
            onClick={() => navigate("/marketplace")}
            className="market-btn"
            style={{
              marginLeft: 8, padding: "0 16px", borderRadius: 24,
              border: "1.5px solid #2D7A3A",
              background: "#ffffff",
              fontSize: 13, fontWeight: 500, color: "#2D7A3A",
              fontFamily: FONT, cursor: "pointer",
              height: 36,
              transition: "all 150ms ease",
            }}
            aria-label="Marketplace"
          >{t("market")}</button>
        </div>
      </div>

      {isOffline && (
        <div className="fixed top-16 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg animate-fadeUp">
            <WifiOff size={10} />
            {t("offline")}
          </div>
        </div>
      )}

      {showAccessibility && (
        <AccessibilityPanel onClose={() => setShowAccessibility(false)}
          onToggleHighContrast={handleToggleHighContrast} onToggleLargeTargets={handleToggleLargeTargets}
          highContrast={highContrast} largeTargets={largeTargets} />
      )}

      <NotificationSettingsPanel
        open={showNotifSettings}
        onOpenChange={setShowNotifSettings}
        permission={notifPermission}
        supported={notifSupported}
        onRequestPermission={() => requestNotifPermission()}
      />

      <TodayDashboard
        name={firstName}
        weather={weather}
        weatherStatus={weatherStatus}
        onAsk={(prompt) => { setSuggestion(prompt); handleOrbTap(); }}
        onWeather={() => weather ? handleWeatherPopup() : requestLocation()}
        onOpenMap={() => openDrawer("map")}
        onOpenToolkit={() => navigate(session ? "/toolkit" : "/auth", session ? undefined : { state: { from: "/toolkit" } })}
        onOpenMarket={() => navigate("/marketplace")}
        onOpenSellingAssistant={() => navigate(session ? "/agents" : "/auth", session ? undefined : { state: { from: "/agents" } })}
      />


      {/* Ambient sky light */}
      <div className="absolute pointer-events-none" style={{
        top: "-20%", left: "50%", transform: "translateX(-50%)",
        width: "140%", height: "50%",
        background: "radial-gradient(ellipse, hsla(120, 30%, 80%, 0.25) 0%, transparent 70%)",
        filter: "blur(60px)",
      }} />

      {/* Secondary ambient glow */}
      <div className="absolute pointer-events-none" style={{
        bottom: "10%", left: "50%",
        transform: `translateX(${isSpeaking ? "-45%" : isListening ? "-55%" : "-50%"})`,
        width: "120%", height: "40%",
        background: isActive
          ? "radial-gradient(ellipse, hsla(130, 35%, 75%, 0.12) 0%, transparent 60%)"
          : "radial-gradient(ellipse, hsla(130, 25%, 80%, 0.06) 0%, transparent 60%)",
        filter: "blur(80px)", transition: "all 1.5s ease",
      }} />

      {/* Hero — compact, mobile-first */}
      <div className="relative z-20 flex flex-col items-center w-full" style={{ paddingTop: 4 }}>
        <div style={{ maxWidth: 560, textAlign: "center", display: "none" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 20,
            background: "#EAF3DE",
            marginBottom: 12,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#2D7A3A",
            }} />
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
              color: "#2D7A3A", fontFamily: FONT, textTransform: "uppercase",
            }}>
              {role === "seller" ? "Seller" : role === "buyer" ? "Buyer" : "Farmer"} · {profile?.province ?? "South Africa"}
            </span>
          </div>
          {firstName && (
            <div style={{
              fontSize: 12, fontWeight: 500, color: "#6b7c6b",
              fontFamily: FONT, marginBottom: 4, letterSpacing: "0.01em",
            }}>
              {timeGreeting}, <span style={{ color: "#2D7A3A", fontWeight: 600 }}>{firstName}</span>
            </div>
          )}
          <h1 style={{
            fontSize: 28,
            lineHeight: 1.2,
            color: "#0f1a0f",
            fontFamily: FONT,
            fontWeight: 700,
            margin: 0,
            letterSpacing: "-0.4px",
          }}>
            {roleCopy.title}
          </h1>
          <p style={{
            fontSize: 15,
            lineHeight: 1.5,
            color: "#6b7c6b",
            fontFamily: FONT,
            margin: "10px auto 0",
            maxWidth: 380,
            fontWeight: 400,
          }}>
            Tap the orb or say <strong style={{ color: "#2D7A3A", fontWeight: 600 }}>"Orb"</strong> — {roleCopy.sub}
          </p>
        </div>
      </div>

      {/* Main orb area — responsive sizing so orbital buttons stay on-screen */}
      <div className="relative flex flex-col items-center w-full" style={{ marginTop: 12, flex: "1 1 auto", justifyContent: "center", minHeight: 0 }}>
        <div
          className="relative"
          style={{
            width: "min(160px, 42vw, 24vh)",
            height: "min(160px, 42vw, 24vh)",
            maxWidth: "100vw",
            overflow: "visible",
          }}
        >
          {/* Outer ambient ring */}
          <div className="absolute pointer-events-none" style={{
            top: "50%", left: "50%", width: "66%", height: "66%",
            transform: "translate(-50%, -50%)", borderRadius: "50%",
            background: `radial-gradient(circle, ${aura.color} ${aura.opacity * 0.3}) 0%, transparent 70%)`,
            filter: "blur(30px)",
            animation: isActive ? "ambientRing 4s ease-in-out infinite" : "none",
          }} />

          <div className="absolute pointer-events-none" style={{
            top: "50%", left: "50%", width: "44%", height: "44%",
            transform: `translate(-50%, -50%) scale(${aura.scale})`,
            background: `radial-gradient(circle, ${aura.color} ${aura.opacity}) 0%, ${aura.color} ${aura.opacity * 0.4}) 40%, transparent 70%)`,
            filter: `blur(${aura.blur}px)`, animation: aura.anim, transition: "all 0.6s ease",
          }} />

          {/* Speaking sound waves */}
          {isSpeaking && (
            <>
              {[0, 0.6, 1.2].map((delay, i) => (
                <div key={i} className="absolute pointer-events-none" style={{
                  top: "50%", left: "50%", width: "55%", height: "55%",
                  transform: "translate(-50%, -50%)", borderRadius: "50%",
                  border: `${1.5 - i * 0.25}px solid hsla(130, 50%, 55%, ${0.2 - i * 0.05})`,
                  animation: `soundWave 1.8s ease-out ${delay}s infinite`,
                }} />
              ))}
            </>
          )}

          {/* Listening radar sweep */}
          {isListening && (
            <div className="absolute pointer-events-none" style={{
              top: "50%", left: "50%", width: "60%", height: "60%",
              transform: "translate(-50%, -50%)", borderRadius: "50%",
              background: "conic-gradient(from 0deg, transparent 0%, hsla(130, 50%, 55%, 0.12) 15%, transparent 30%)",
              animation: "radarSweep 2.5s linear infinite",
            }} />
          )}

          {/* Thinking orbit dots */}
          {isThinking && (
            <div className="absolute pointer-events-none" style={{
              top: "50%", left: "50%", width: "55%", height: "55%",
              transform: "translate(-50%, -50%)", animation: "radarSweep 3s linear infinite",
            }}>
              {[0, 120, 240].map((deg, i) => (
                <div key={i} style={{
                  position: "absolute", width: 5, height: 5, borderRadius: "50%",
                  background: `hsla(140, 40%, 55%, ${0.4 - i * 0.1})`,
                  top: "50%", left: "50%",
                  transform: `rotate(${deg}deg) translateY(-100px) translate(-50%, -50%)`,
                }} />
              ))}
            </div>
          )}


          <div className="absolute" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
            <div style={{ filter: "drop-shadow(0 12px 24px rgba(45,122,58,0.25))", transform: "scale(0.92)" }}>
              <div style={{ animation: !isActive ? "orbBreath 3.5s ease-in-out infinite" : "none" }}>
                <GreenOrb emotion={emotion} onTap={handleOrbTap} isSpeaking={isSpeaking} weatherAlert={weatherAlert} />
              </div>
            </div>
          </div>

          {/* Orbital buttons moved to dropdown below */}
        </div>

        <div className="flex flex-col items-center gap-1 mt-1" style={{ pointerEvents: "none" }}>
          <Mic size={14} color="#9aab9a" />
          <span style={{ fontSize: 11, color: "#9aab9a", fontWeight: 400, fontFamily: FONT }}>or say "Orb"</span>
        </div>

        {suggestion && (
          <button
            onClick={() => handleOrbTap()}
            style={{
              marginTop: 12, padding: "6px 14px", borderRadius: 18,
              background: "hsla(130, 30%, 95%, 0.7)",
              border: "1px solid hsla(130, 40%, 48%, 0.15)",
              color: "#2D7A3A", fontSize: 12, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 6,
              animation: "fadeUp 0.5s ease",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            <Sparkles size={12} />
            {suggestion}
          </button>
        )}

        {/* Tools Button — Opens Bottom Sheet */}
        <div className="w-full flex flex-col items-center mt-3" style={{ maxWidth: 400 }}>
          <button
            onClick={() => setToolsOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 20px", borderRadius: 24,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(12px)",
              fontSize: 14, fontWeight: 600, color: "#2D7A3A",
              fontFamily: FONT, cursor: "pointer",
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
              transition: "all 0.2s ease",
            }}
          >
            <LayoutGrid size={16} />
            {t("tools")}
          </button>

          <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
            <SheetContent
              side="right"
              className="w-[320px] sm:w-[380px] p-0 border-l"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,252,247,0.96))",
                backdropFilter: "blur(50px) saturate(1.3)",
                WebkitBackdropFilter: "blur(50px) saturate(1.3)",
                borderLeft: "1px solid hsla(130, 30%, 60%, 0.15)",
              }}
            >
              <SheetHeader style={{ padding: "20px 20px 12px" }}>
                <SheetTitle style={{ fontSize: 16, fontWeight: 700, color: "hsl(0,0%,18%)", fontFamily: FONT }}>
                  {t("tools")}
                </SheetTitle>
              </SheetHeader>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, padding: "8px 20px 20px",
              }}>
                {orderedTools.map(btn => {
                  const BtnIcon = btn.icon;
                  const isRecent = lastTool === btn.key;
                  const useCount = toolUsage[btn.key] ?? 0;
                  return (
                    <button
                      key={btn.key}
                      onClick={() => {
                        if (!session) {
                          navigate("/auth", { state: { from: "/" } });
                          return;
                        }
                        bumpTool(btn.key);
                        setActiveDrawer(btn.key);
                        setToolsOpen(false);
                      }}
                      style={{
                        position: "relative",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: 10, padding: "20px 12px", borderRadius: 18,
                        border: isRecent ? "1px solid rgba(45,122,58,0.35)" : "1px solid rgba(0,0,0,0.05)",
                        background: isRecent ? "linear-gradient(180deg,#ffffff,#f2faf3)" : "#ffffff",
                        boxShadow: isRecent ? "0 4px 16px rgba(45,122,58,0.10)" : "0 2px 12px rgba(0,0,0,0.03)",
                        cursor: "pointer",
                        fontFamily: FONT,
                      }}
                    >
                      {isRecent && (
                        <span style={{
                          position: "absolute", top: 8, right: 8,
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                          color: "#2D7A3A", textTransform: "uppercase",
                          background: "#EAF3DE", padding: "2px 6px", borderRadius: 6,
                        }}>Recent</span>
                      )}
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: "hsla(130, 40%, 48%, 0.08)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <BtnIcon size={24} strokeWidth={1.8} style={{ color: "#2D7A3A" }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#3d3d3d" }}>{btn.label}</span>
                      {useCount > 0 && (
                        <span style={{ fontSize: 10, color: "#9aab9a", marginTop: -6 }}>
                          Used {useCount}×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Caption */}
        <div className="w-full mt-4" style={{ maxWidth: 380, minHeight: 36 }}>
          <div style={{
            fontSize: 14, lineHeight: 1.65, color: "hsl(0, 0%, 16%)", fontFamily: FONT,
            textAlign: "center", fontWeight: 400,
            background: captionVisible ? "linear-gradient(180deg, hsla(0,0%,100%,0.78), hsla(120,25%,98%,0.7))" : "transparent",
            backdropFilter: captionVisible ? "blur(34px) saturate(1.4)" : "none",
            WebkitBackdropFilter: captionVisible ? "blur(34px) saturate(1.4)" : "none",
            padding: captionVisible ? "14px 20px" : "0 20px",
            borderRadius: 20,
            border: captionVisible ? "1px solid hsla(130, 25%, 60%, 0.18)" : "1px solid transparent",
            boxShadow: captionVisible ? "0 10px 32px hsla(130, 30%, 25%, 0.09), inset 0 1px 0 hsla(0,0%,100%,0.6)" : "none",
            maxHeight: captionVisible ? 200 : 0,
            opacity: captionVisible ? 1 : 0,
            overflow: "hidden",
            transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>

            {caption && (() => {
              const text = caption.length > 240 ? caption.slice(-240) : caption;
              const parts = text.split(/(\*\*[^*]+\*\*)/g);
              return parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                return <span key={i}>{part}</span>;
              });
            })()}
          </div>

          {captionVisible && lastLogId && !isSpeaking && (
            <div style={{
              display: "flex", gap: 8, justifyContent: "center", marginTop: 8,
              opacity: feedbackGiven ? 0.5 : 1, transition: "opacity 0.3s ease",
            }}>
              <button onClick={() => handleFeedback("up")} disabled={!!feedbackGiven} style={{
                width: 30, height: 30, borderRadius: "50%", border: "none",
                background: feedbackGiven === "up" ? "hsla(130, 40%, 48%, 0.2)" : "hsla(0, 0%, 100%, 0.55)",
                backdropFilter: "blur(12px)", cursor: feedbackGiven ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 6px hsla(0, 0%, 0%, 0.04)",
              }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
              </button>
              <button onClick={() => handleFeedback("down")} disabled={!!feedbackGiven} style={{
                width: 30, height: 30, borderRadius: "50%", border: "none",
                background: feedbackGiven === "down" ? "hsla(0, 50%, 55%, 0.15)" : "hsla(0, 0%, 100%, 0.55)",
                backdropFilter: "blur(12px)", cursor: feedbackGiven ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 6px hsla(0, 0%, 0%, 0.04)",
              }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
              </button>
            </div>
          )}
        </div>

        <p style={{
          fontSize: 11, color: isListening ? "hsl(130, 35%, 42%)" : "hsl(0, 0%, 50%)",
          fontFamily: FONT, textAlign: "center", letterSpacing: "0.06em",
          marginTop: 6, opacity: subtitle ? (isListening ? 1 : 0.7) : 0,
          transition: "all 0.5s ease", fontWeight: isListening ? 500 : 400, textTransform: "uppercase",
        }}>
          {isListening && (
            <span style={{
              display: "inline-block", width: 6, height: 6, borderRadius: "50%",
              background: "hsl(130, 50%, 50%)", marginRight: 6, verticalAlign: "middle",
              animation: "subtitlePulse 1s ease-in-out infinite",
            }} />
          )}
          {subtitle}
        </p>
      </div>

      {/* Floating cards stack — above the bottom controller, clear of mini orb */}
      <div
        className="fixed left-0 right-0 flex flex-col items-center gap-2 px-3 pointer-events-none"
        style={{
          bottom: "calc(clamp(96px, 16vh, 140px) + env(safe-area-inset-bottom, 0px))",
          zIndex: 35,
        }}
      >
        {products && products.length > 0 && (
          <div className="w-full flex justify-center pointer-events-auto" style={{ animation: "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <ProductCarousel products={products} onDismiss={() => setProducts(null)} />
          </div>
        )}
        {marketLoading && !marketPredictions && (
          <div className="w-full flex justify-center pointer-events-auto">
            <MarketSkeleton />
          </div>
        )}
        {marketPredictions && marketPredictions.length > 0 && (
          <div className="w-full flex justify-center pointer-events-auto" style={{ animation: "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <MarketPredictionCard predictions={marketPredictions} onDismiss={() => setMarketPredictions(null)} />
          </div>
        )}
        {bioLoading && !biosecurityData && (
          <div className="w-full flex justify-center pointer-events-auto">
            <BiosecuritySkeleton />
          </div>
        )}
        {biosecurityData && (
          <div className="w-full flex justify-center pointer-events-auto" style={{ animation: "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <BiosecurityCard data={biosecurityData} onDismiss={() => setBiosecurityData(null)} />
          </div>
        )}
      </div>

      {/* OrbController — anchored bottom dock */}
      <div className="w-full flex justify-center px-3" style={{
        paddingTop: 12,
        paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
        paddingRight: "max(12px, calc(72px + env(safe-area-inset-right, 0px)))",
        paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
        flexShrink: 0,
      }}>
        <OrbController
          onEmotionChange={setEmotion} onCaptionChange={setCaption} onSubtitleChange={setSubtitle}
          onRegisterTap={handleRegisterTap} weather={weather} weatherStatus={weatherStatus}
          onRequestLocation={requestLocation} onLastLogIdChange={setLastLogId}
          onWeatherAlertChange={setWeatherAlert} onProductsChange={setProducts}
          onMarketPredictions={setMarketPredictions} onBiosecurityData={setBiosecurityData}
          onMarketLoading={setMarketLoading} onBioLoading={setBioLoading}
          onWeatherPopup={handleWeatherPopup}
        />
      </div>

      {/* ── DRAWERS ── */}
      {([
        { key: "agents", title: "Agent Crew", icon: Zap, height: "72dvh", content: <AgentsContent crew={crew} /> },
        { key: "map", title: "GeoAI Precision", icon: Map, height: "95dvh", content: <GeoAIContent geoData={geoData} setGeoData={setGeoData} onFarmArea={setFarmArea} onFarmNDVI={setFarmNDVI} /> },
        { key: "permissions", title: "Agent Rules", icon: Shield, height: "72dvh", content: <PermissionsContent crew={crew} /> },
        { key: "deals", title: "Deals", icon: Package, height: "72dvh", content: <DealsContent crew={crew} /> },
      ] as const).map(drawer => {
        const DrawerIcon = drawer.icon;
        return (
          <Drawer key={drawer.key} open={activeDrawer === drawer.key} onOpenChange={(open) => { if (!open) setActiveDrawer(null); }}>
            <DrawerContent style={{
              maxHeight: drawer.height,
              background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,252,247,0.96))",
              backdropFilter: "blur(50px) saturate(1.3)",
              WebkitBackdropFilter: "blur(50px) saturate(1.3)",
              borderTop: "1px solid hsla(130, 30%, 60%, 0.15)",
              boxShadow: "0 -18px 50px hsla(130, 30%, 20%, 0.08)",
              borderRadius: "22px 22px 0 0",
            }}>
              <DrawerHeader className="pb-0 pt-3">
                <DrawerTitle className="flex items-center gap-2" style={{
                  fontSize: 15, fontWeight: 700, color: "hsl(0,0%,18%)", fontFamily: FONT,
                  letterSpacing: "0.03em",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: "hsla(130, 40%, 48%, 0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <DrawerIcon size={14} style={{ color: "hsl(130, 40%, 38%)" }} />
                  </div>
                  {drawer.title}
                </DrawerTitle>
              </DrawerHeader>
              <div style={{
                padding: "8px 16px 28px",
                overflowY: "auto",
                maxHeight: `calc(${drawer.height} - 64px)`,
              }}>
                {drawer.content}
              </div>
            </DrawerContent>
          </Drawer>
        );
      })}

      {/* MiniOrbGuide */}
      <MiniOrbGuide
        activeTab={activeTab}
        permissions={crew.permissions}
        hasDeals={crew.deals.length > 0}
        hasCrew={!!crew.crewResult}
        farmNDVI={farmNDVI}
        farmArea={farmArea}
        geoData={geoData}
      />

      <style>{`
        @keyframes auraPulse {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(var(--aura-scale, 1.8)); }
          50% { opacity: 0.6; transform: translate(-50%, -50%) scale(calc(var(--aura-scale, 1.8) * 1.15)); }
        }
        @keyframes auraBreath {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(var(--aura-scale, 1.6)); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(calc(var(--aura-scale, 1.6) * 1.1)); }
        }
        @keyframes auraThink {
          0%, 100% { opacity: 0.8; transform: translate(-50%, -50%) scale(var(--aura-scale, 1.5)); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(calc(var(--aura-scale, 1.5) * 1.05)); }
        }
        @keyframes soundWave {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.4; }
          100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
        }
        @keyframes radarSweep {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: var(--particle-opacity, 0.12); }
          25% { transform: translateY(-30px) translateX(15px); opacity: calc(var(--particle-opacity, 0.12) * 1.5); }
          50% { transform: translateY(-15px) translateX(-10px); opacity: var(--particle-opacity, 0.12); }
          75% { transform: translateY(-40px) translateX(8px); opacity: calc(var(--particle-opacity, 0.12) * 0.6); }
        }
        @keyframes ambientRing {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes subtitlePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes auraWarning {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1.8); }
          50% { opacity: 0.5; transform: translate(-50%, -50%) scale(2.1); }
        }
        @keyframes auraDanger {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(2.0); }
          25% { opacity: 0.4; transform: translate(-50%, -50%) scale(2.4); }
          50% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.8); }
          75% { opacity: 0.5; transform: translate(-50%, -50%) scale(2.3); }
        }
        @keyframes orbitalFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes liveDotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes orbBreath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.025); }
        }
        .market-btn:active {
          background: #2D7A3A !important;
          color: #ffffff !important;
        }
        .orbital-card:hover {
          box-shadow: 0 4px 12px rgba(45,122,58,0.15) !important;
        }
        .orbital-card:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};

export default Index;
