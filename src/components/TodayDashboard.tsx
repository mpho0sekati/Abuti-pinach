import { Camera, CheckCircle2, CloudRain, Map, MessageCircle, ShoppingBasket, Sprout, TrendingUp, WalletCards } from "lucide-react";
import type { WeatherData } from "@/hooks/useWeather";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

type Props = {
  name: string;
  weather: WeatherData | null;
  weatherStatus: string;
  onAsk: (prompt: string) => void;
  onWeather: () => void;
  onOpenMap: () => void;
  onOpenToolkit: () => void;
  onOpenMarket: () => void;
  onOpenSellingAssistant: () => void;
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.94)", border: "1px solid hsla(130, 25%, 55%, 0.16)",
  borderRadius: 20, boxShadow: "0 8px 24px hsla(130, 25%, 25%, 0.06)",
};

export default function TodayDashboard({ name, weather, weatherStatus, onAsk, onWeather, onOpenMap, onOpenToolkit, onOpenMarket, onOpenSellingAssistant }: Props) {
  const rainRisk = weather?.daily.precipitationProbability ?? 0;
  const weatherSummary = weather
    ? rainRisk >= 50
      ? `Rain is likely today (${rainRisk}%). Protect harvested produce and avoid spraying before the rain.`
      : "Dry conditions are expected. Check soil moisture before midday, especially for leafy crops."
    : "Add your location to receive a practical weather plan for your farm.";

  const shortcuts = [
    { label: "Ask Abuti", icon: MessageCircle, action: () => onAsk("What is the most important thing I should do on my farm today?") },
    { label: "My field", icon: Map, action: onOpenMap },
    { label: "Selling help", icon: ShoppingBasket, action: onOpenSellingAssistant },
    { label: "Farm money", icon: WalletCards, action: onOpenToolkit },
    { label: "Crop plan", icon: Sprout, action: onOpenToolkit },
    { label: weatherStatus === "granted" ? "Weather ready" : "Set location", icon: CloudRain, action: onWeather },
  ];

  return <section className="relative z-20 w-full" style={{ maxWidth: 560, paddingTop: "calc(env(safe-area-inset-top, 0px) + 76px)" }}>
    <div style={{ padding: "0 4px 16px" }}>
      <p style={{ margin: 0, color: "#6b7c6b", fontSize: 14, fontFamily: FONT }}>{name ? `Good to see you, ${name}.` : "Your farm, one clear step at a time."}</p>
      <h1 style={{ margin: "4px 0 0", color: "#112414", fontSize: 28, lineHeight: 1.12, letterSpacing: "-0.6px", fontFamily: FONT, fontWeight: 750 }}>Today on your farm</h1>
      <p style={{ margin: "8px 0 0", color: "#58705b", fontSize: 14, lineHeight: 1.45, fontFamily: FONT }}>The few things that can protect your crop, time, and income today.</p>
    </div>

    <div style={{ ...card, padding: 16, borderLeft: `4px solid ${rainRisk >= 50 ? "#d97706" : "#2d7a3a"}` }}>
      <div className="flex items-start gap-3"><div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, background: rainRisk >= 50 ? "#fff5df" : "#eaf5e8", display: "grid", placeItems: "center" }}><CloudRain size={19} color={rainRisk >= 50 ? "#b45309" : "#2d7a3a"} /></div>
        <div className="min-w-0 flex-1"><div style={{ color: "#213b25", fontFamily: FONT, fontSize: 14, fontWeight: 700 }}>Farm alert</div><p style={{ margin: "3px 0 10px", color: "#58705b", fontFamily: FONT, fontSize: 13, lineHeight: 1.45 }}>{weatherSummary}</p><button onClick={onWeather} style={{ border: 0, background: "transparent", padding: 0, color: "#247036", fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{weather ? (rainRisk >= 50 ? "Prepare for rain" : "Plan watering") : "Set my location"} →</button></div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 mt-3">
      <button onClick={() => onAsk("I want to diagnose a crop problem. Please ask me for a photo and the crop details.")} style={{ ...card, padding: 15, textAlign: "left", cursor: "pointer" }}><div style={{ width: 36, height: 36, borderRadius: 11, background: "#e8f4e5", display: "grid", placeItems: "center", marginBottom: 10 }}><Camera size={18} color="#2d7a3a" /></div><div style={{ color: "#203823", fontFamily: FONT, fontWeight: 700, fontSize: 14 }}>Check a crop</div><div style={{ color: "#667a68", fontFamily: FONT, fontSize: 12, marginTop: 3, lineHeight: 1.35 }}>Take a photo and get a next step.</div></button>
      <button onClick={onOpenMarket} style={{ ...card, padding: 15, textAlign: "left", cursor: "pointer" }}><div style={{ width: 36, height: 36, borderRadius: 11, background: "#eef4ff", display: "grid", placeItems: "center", marginBottom: 10 }}><TrendingUp size={18} color="#245b9f" /></div><div style={{ color: "#203823", fontFamily: FONT, fontWeight: 700, fontSize: 14 }}>Sell smarter</div><div style={{ color: "#667a68", fontFamily: FONT, fontSize: 12, marginTop: 3, lineHeight: 1.35 }}>Check prices and trusted local listings.</div></button>
    </div>

    <div style={{ ...card, padding: 16, marginTop: 12 }}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div style={{ width: 38, height: 38, borderRadius: 12, background: "#f2f7e9", display: "grid", placeItems: "center" }}><CheckCircle2 size={19} color="#5b7d27" /></div><div><div style={{ color: "#213b25", fontFamily: FONT, fontSize: 14, fontWeight: 700 }}>Your next farm task</div><div style={{ color: "#667a68", fontFamily: FONT, fontSize: 12, marginTop: 2 }}>Plan planting, harvests, and spending in one place.</div></div></div><button onClick={onOpenToolkit} style={{ border: 0, borderRadius: 10, background: "#eaf3de", color: "#2d7a3a", padding: "8px 10px", fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Open</button></div></div>

    <div className="grid grid-cols-3 gap-2 mt-3" style={{ paddingBottom: 12 }}>{shortcuts.map(({ label, icon: Icon, action }) => <button key={label} onClick={action} style={{ ...card, minHeight: 78, padding: "10px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon size={18} color="#367642" /><span style={{ color: "#35533a", fontFamily: FONT, fontSize: 11, fontWeight: 650, textAlign: "center" }}>{label}</span></button>)}</div>
  </section>;
}
