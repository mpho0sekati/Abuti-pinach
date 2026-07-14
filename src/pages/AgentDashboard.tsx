import { useState, useEffect, useCallback, useMemo } from "react";
import MiniOrbGuide from "@/components/MiniOrbGuide";
import FarmBoundaryMap, { type NDVIData } from "@/components/FarmBoundaryMap";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Search, Handshake, Truck, Shield, Lock, Gauge, Wheat,
  TrendingUp, Zap, ChevronRight, Check, X, Play, Loader2, BarChart3,
  Package, CircleDollarSign, Eye, AlertTriangle, Activity,
  Globe, Target, Network, CheckCircle2, Map, Layers, MapPin, Droplets,
  Thermometer, Wind, Leaf, ShieldCheck, ArrowUpRight, ArrowDownRight,
  CloudRain, Sun, Sprout, BarChart, Heart, Timer,
} from "lucide-react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";
const AGENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-negotiate`;

interface AgentPermissions {
  auto_negotiate: boolean;
  min_price_per_kg: number | null;
  crops: string[];
  max_deal_value: number | null;
  allow_logistics: boolean;
}

interface Deal {
  id: string;
  crop: string;
  quantity_kg: number;
  asking_price: number;
  negotiated_price: number | null;
  buyer_name: string | null;
  status: string;
  logistics_status: string;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
}

interface CrewAgent {
  name: string;
  code: string;
  icon: typeof Search;
  status: "standby" | "active" | "complete" | "error";
  color: string;
}

const makeCrewAgents = (): CrewAgent[] => [
  { name: "Market Analyst", code: "MKT", icon: TrendingUp, status: "standby", color: "hsl(130, 40%, 45%)" },
  { name: "Quality", code: "QAI", icon: Eye, status: "standby", color: "hsl(200, 50%, 50%)" },
  { name: "Negotiator", code: "NEG", icon: Handshake, status: "standby", color: "hsl(45, 70%, 50%)" },
  { name: "Risk", code: "RSK", icon: AlertTriangle, status: "standby", color: "hsl(15, 70%, 55%)" },
  { name: "Supply Chain", code: "SCO", icon: Network, status: "standby", color: "hsl(270, 40%, 55%)" },
  { name: "Logistics", code: "LOG", icon: Truck, status: "standby", color: "hsl(180, 45%, 45%)" },
];

const AgentDashboard = () => {
  const navigate = useNavigate();
  const [farmerName] = useState(() => localStorage.getItem("abuti_farmer") || "Farmer");
  const [permissions, setPermissions] = useState<AgentPermissions>({
    auto_negotiate: false, min_price_per_kg: null, crops: [], max_deal_value: null, allow_logistics: false,
  });
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [negotiating, setNegotiating] = useState(false);
  const [crewResult, setCrewResult] = useState<any>(null);
  const [crewAgents, setCrewAgents] = useState<CrewAgent[]>(makeCrewAgents());
  const [scanCrop, setScanCrop] = useState("");
  const [scanQty, setScanQty] = useState("");
  const [newCrop, setNewCrop] = useState("");
  const [activeTab, setActiveTab] = useState<"agents" | "permissions" | "deals" | "map">("agents");
  const [geoData, setGeoData] = useState<any>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [farmNDVI, setFarmNDVI] = useState<NDVIData | null>(null);
  const [farmArea, setFarmArea] = useState<number>(0);

  const callAgent = useCallback(async (body: any) => {
    const resp = await fetch(AGENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ farmer_name: farmerName, ...body }),
    });
    return resp.json();
  }, [farmerName]);

  useEffect(() => {
    const load = async () => {
      try {
        const [permsRes, dealsRes] = await Promise.all([
          callAgent({ action: "get_permissions" }),
          callAgent({ action: "get_deals" }),
        ]);
        if (permsRes.permissions) setPermissions(permsRes.permissions);
        if (dealsRes.deals) setDeals(dealsRes.deals);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [callAgent]);

  const savePermissions = async () => {
    const res = await callAgent({ action: "update_permissions", ...permissions });
    if (res.success) toast.success("Permissions saved");
    else toast.error(res.error || "Failed to update");
  };

  const launchFullCrew = async () => {
    if (!scanCrop.trim()) { toast.error("Enter a crop name"); return; }
    if (!permissions.auto_negotiate) { toast.error("Enable auto-negotiate in Permissions first"); return; }
    setNegotiating(true);
    setCrewResult(null);
    const agents = makeCrewAgents();
    setCrewAgents(agents);

    setCrewAgents(prev => prev.map(a =>
      a.code === "MKT" || a.code === "QAI" ? { ...a, status: "active" } : a
    ));
    setTimeout(() => {
      setCrewAgents(prev => prev.map(a => {
        if (a.code === "MKT" || a.code === "QAI") return { ...a, status: "complete" };
        if (a.code === "NEG" || a.code === "RSK") return { ...a, status: "active" };
        return a;
      }));
    }, 3000);
    setTimeout(() => {
      setCrewAgents(prev => prev.map(a => {
        if (a.code === "NEG" || a.code === "RSK") return { ...a, status: "complete" };
        if (a.code === "SCO") return { ...a, status: "active" };
        return a;
      }));
    }, 6000);

    try {
      const res = await callAgent({ action: "find_buyers", crop: scanCrop, quantity_kg: parseFloat(scanQty) || 100 });
      if (res.success) {
        setCrewResult(res.crew);
        setCrewAgents(prev => prev.map(a => ({ ...a, status: "complete" as const })));
        const dealsRes = await callAgent({ action: "get_deals" });
        if (dealsRes.deals) setDeals(dealsRes.deals);
        toast.success("Crew pipeline complete");
      } else {
        toast.error(res.error || "Pipeline failed");
        setCrewAgents(prev => prev.map(a => a.status === "active" ? { ...a, status: "error" as const } : a));
      }
    } catch {
      toast.error("Pipeline failed");
      setCrewAgents(makeCrewAgents());
    }
    setNegotiating(false);
  };

  const scanMarketOnly = async () => {
    if (!scanCrop.trim()) { toast.error("Enter a crop"); return; }
    if (!permissions.auto_negotiate) { toast.error("Enable auto-negotiate first"); return; }
    setScanning(true);
    setCrewAgents(prev => prev.map(a => a.code === "MKT" ? { ...a, status: "active" } : a));
    try {
      const res = await callAgent({ action: "scan_market", crop: scanCrop, quantity_kg: parseFloat(scanQty) || 100 });
      if (res.success) {
        setCrewResult({ market_analysis: res.analysis });
        setCrewAgents(prev => prev.map(a => a.code === "MKT" ? { ...a, status: "complete" } : a));
      } else {
        toast.error(res.error || "Scan failed");
        setCrewAgents(makeCrewAgents());
      }
    } catch { toast.error("Scan failed"); setCrewAgents(makeCrewAgents()); }
    setScanning(false);
  };

  const arrangeLogi = async (dealId: string) => {
    setCrewAgents(prev => prev.map(a => a.code === "LOG" ? { ...a, status: "active" } : a));
    const res = await callAgent({ action: "arrange_logistics", deal_id: dealId });
    if (res.success) {
      toast.success("Logistics arranged");
      setCrewAgents(prev => prev.map(a => a.code === "LOG" ? { ...a, status: "complete" } : a));
      const dealsRes = await callAgent({ action: "get_deals" });
      if (dealsRes.deals) setDeals(dealsRes.deals);
    } else {
      toast.error(res.error || "Failed");
      setCrewAgents(prev => prev.map(a => a.code === "LOG" ? { ...a, status: "standby" } : a));
    }
  };

  const addCrop = () => { if (!newCrop.trim()) return; setPermissions(p => ({ ...p, crops: [...p.crops, newCrop.trim()] })); setNewCrop(""); };
  const removeCrop = (i: number) => { setPermissions(p => ({ ...p, crops: p.crops.filter((_, idx) => idx !== i) })); };
  const summary = useMemo(() => crewResult?.intelligence_summary, [crewResult]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]" style={{
        background: "linear-gradient(180deg, hsl(80, 15%, 97%) 0%, hsl(100, 12%, 94%) 100%)",
        fontFamily: FONT,
      }}>
        <div className="flex items-center gap-3" style={{ color: "hsl(130, 35%, 42%)" }}>
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Loading your crew...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-hidden" style={{
      background: "linear-gradient(180deg, hsl(80, 15%, 97%) 0%, hsl(100, 12%, 94%) 40%, hsl(90, 18%, 91%) 100%)",
      fontFamily: FONT,
      color: "hsl(0, 0%, 18%)",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 10,
        background: "hsla(0, 0%, 100%, 0.5)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid hsla(130, 20%, 60%, 0.1)",
      }}>
        <button onClick={() => navigate("/")} style={{
          width: 36, height: 36, borderRadius: 12, border: "none",
          background: "hsla(0, 0%, 100%, 0.6)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: "hsl(130, 30%, 42%)",
        }}>
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, hsl(130, 45%, 48%), hsl(140, 40%, 42%))",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px hsla(130, 40%, 45%, 0.3)",
          }}>
            <Leaf size={14} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "hsl(0, 0%, 15%)" }}>Abuti Agent Crew</h1>
            <p style={{ fontSize: 10, color: "hsl(0, 0%, 50%)", margin: 0, fontWeight: 500 }}>
              {permissions.auto_negotiate ? "Active" : "Standby"} — {deals.length} deals
            </p>
          </div>
        </div>
      </div>

      {/* Agent Status Orbs */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 10, padding: "16px 12px 8px",
      }}>
        {crewAgents.map(agent => {
          const AgentIcon = agent.icon;
          const isActive = agent.status === "active";
          const isDone = agent.status === "complete";
          const isError = agent.status === "error";
          return (
            <div key={agent.code} className="flex flex-col items-center gap-1">
              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: isDone
                  ? `linear-gradient(135deg, ${agent.color}, ${agent.color}dd)`
                  : isActive
                  ? "hsla(0, 0%, 100%, 0.8)"
                  : isError
                  ? "hsla(0, 70%, 95%, 0.8)"
                  : "hsla(0, 0%, 100%, 0.5)",
                border: isActive ? `2px solid ${agent.color}` : isDone ? "none" : "1px solid hsla(0, 0%, 0%, 0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isDone
                  ? `0 3px 12px ${agent.color}40`
                  : isActive
                  ? `0 0 12px ${agent.color}30`
                  : "0 1px 4px hsla(0, 0%, 0%, 0.04)",
                transition: "all 0.4s ease",
                backdropFilter: "blur(10px)",
              }}>
                {isActive ? (
                  <Loader2 size={16} className="animate-spin" style={{ color: agent.color }} />
                ) : isDone ? (
                  <Check size={16} color="white" />
                ) : (
                  <AgentIcon size={16} style={{ color: isDone ? "white" : isError ? "hsl(0, 60%, 55%)" : "hsl(0, 0%, 55%)" }} />
                )}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: "0.04em",
                color: isDone ? agent.color : isActive ? agent.color : "hsl(0, 0%, 50%)",
                transition: "color 0.3s",
              }}>
                {agent.code}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 2, padding: "0 12px", margin: "8px 0",
      }}>
        {([
          { key: "agents" as const, label: "Agents", icon: Zap },
          { key: "map" as const, label: "GeoAI", icon: Map },
          { key: "permissions" as const, label: "Permissions", icon: Shield },
          { key: "deals" as const, label: "Deals", icon: Package },
        ]).map(tab => {
          const TabIcon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              flex: 1, padding: "10px 6px", border: "none",
              fontSize: 11, fontWeight: active ? 600 : 500,
              background: active ? "hsla(0, 0%, 100%, 0.7)" : "transparent",
              color: active ? "hsl(130, 35%, 38%)" : "hsl(0, 0%, 50%)",
              borderRadius: 12,
              cursor: "pointer", transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              backdropFilter: active ? "blur(16px)" : "none",
              boxShadow: active ? "0 1px 6px hsla(0, 0%, 0%, 0.04)" : "none",
            }}>
              <TabIcon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding: "4px 12px 24px", maxWidth: 640, margin: "0 auto", overflowY: "auto", maxHeight: "calc(100vh - 220px)" }}>

        {/* AGENTS TAB */}
        {activeTab === "agents" && (
          <div className="flex flex-col gap-3">
            {/* Mission Input */}
            <GlassPanel title="What are you selling?">
              <div className="flex gap-2 mb-2">
                <input value={scanCrop} onChange={e => setScanCrop(e.target.value)}
                  placeholder="e.g. Spinach, Tomatoes..." style={inputGlass} />
                <input value={scanQty} onChange={e => setScanQty(e.target.value)}
                  type="number" placeholder="Kg" style={{ ...inputGlass, maxWidth: 80 }} />
              </div>
              <div className="flex gap-2">
                <button onClick={scanMarketOnly} disabled={scanning} style={btnOutline}>
                  {scanning ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                  {scanning ? "Scanning..." : "Quick Scan"}
                </button>
                <button onClick={launchFullCrew} disabled={negotiating} style={btnPrimary}>
                  {negotiating ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                  {negotiating ? "Working..." : "Deploy Crew"}
                </button>
              </div>
            </GlassPanel>

            {/* Intelligence Summary */}
            {summary && (
              <GlassPanel title="Intelligence Summary" accent>
                <div className="grid grid-cols-2 gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                  <MetricPill label="Best Price" value={`R${summary.best_price}/kg`} icon={<TrendingUp size={12} />} color="hsl(130, 40%, 45%)" />
                  <MetricPill label="Quality" value={`${summary.quality_score || "--"}/100`} icon={<Eye size={12} />} color="hsl(200, 50%, 50%)" />
                  <MetricPill label="Risk" value={summary.risk_level?.toUpperCase() || "--"} icon={<AlertTriangle size={12} />}
                    color={summary.risk_level === "red" ? "hsl(0, 60%, 55%)" : summary.risk_level === "amber" ? "hsl(40, 70%, 50%)" : "hsl(130, 40%, 45%)"} />
                  <MetricPill label="Revenue" value={`R${summary.total_revenue || "--"}`} icon={<CircleDollarSign size={12} />} color="hsl(130, 40%, 45%)" />
                  <MetricPill label="Confidence" value={`${Math.round((summary.confidence || 0) * 100)}%`} icon={<Target size={12} />} color="hsl(200, 50%, 50%)" />
                  <MetricPill label="Channel" value={summary.recommended_channel || "--"} icon={<Globe size={12} />} color="hsl(270, 40%, 55%)" />
                </div>
              </GlassPanel>
            )}

            {/* Market Analysis */}
            {crewResult?.market_analysis && (
              <GlassPanel title="Market Analysis">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <DataPill label="Recommended Price" value={`R${crewResult.market_analysis.recommended_price}/kg`} highlight />
                  <DataPill label="Demand" value={crewResult.market_analysis.demand_level} />
                  <DataPill label="Price Range" value={`R${crewResult.market_analysis.current_price_range?.min} — R${crewResult.market_analysis.current_price_range?.max}`} />
                  <DataPill label="Supply" value={crewResult.market_analysis.supply_level || "balanced"} />
                </div>
                {crewResult.market_analysis.price_forecast_30d && (
                  <div style={{
                    padding: 10, borderRadius: 12, marginBottom: 8,
                    background: "hsla(200, 50%, 95%, 0.6)",
                    border: "1px solid hsla(200, 50%, 70%, 0.2)",
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "hsl(200, 50%, 40%)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>30-Day Forecast</p>
                    <div className="flex items-center gap-2">
                      {crewResult.market_analysis.price_forecast_30d.direction === "up" ? <ArrowUpRight size={14} color="hsl(130, 40%, 45%)" /> : <ArrowDownRight size={14} color="hsl(0, 60%, 55%)" />}
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{crewResult.market_analysis.price_forecast_30d.direction?.toUpperCase()} {crewResult.market_analysis.price_forecast_30d.magnitude_pct}%</span>
                    </div>
                    <p style={{ fontSize: 11, color: "hsl(0, 0%, 45%)", margin: "4px 0 0", lineHeight: 1.4 }}>{crewResult.market_analysis.price_forecast_30d.reasoning}</p>
                  </div>
                )}
                {crewResult.market_analysis.best_markets?.map((m: any, i: number) => (
                  <div key={i} className="flex justify-between" style={{ padding: "5px 0", borderBottom: "1px solid hsla(0, 0%, 0%, 0.04)", fontSize: 12 }}>
                    <span style={{ color: "hsl(0, 0%, 45%)" }}>{m.name}</span>
                    <span style={{ color: "hsl(130, 40%, 40%)", fontWeight: 600 }}>R{m.avg_price}/kg</span>
                  </div>
                ))}
              </GlassPanel>
            )}

            {/* Negotiation Results */}
            {crewResult?.negotiation?.best_deal && (
              <GlassPanel title="Best Deal Secured" accent>
                <div style={{
                  padding: 14, borderRadius: 14,
                  background: "linear-gradient(135deg, hsla(130, 40%, 48%, 0.08), hsla(130, 40%, 48%, 0.02))",
                  border: "1px solid hsla(130, 40%, 48%, 0.15)",
                  textAlign: "center", marginBottom: 8,
                }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "hsl(130, 35%, 42%)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Final Price</p>
                  <p style={{ fontSize: 28, fontWeight: 800, color: "hsl(130, 40%, 38%)", margin: "4px 0" }}>R{crewResult.negotiation.best_deal.final_price}/kg</p>
                  <p style={{ fontSize: 12, color: "hsl(0, 0%, 40%)", margin: 0 }}>{crewResult.negotiation.best_deal.buyer_name}</p>
                  {crewResult.negotiation.best_deal.total_value && (
                    <p style={{ fontSize: 11, color: "hsl(0, 0%, 55%)", margin: "2px 0 0" }}>Total: R{crewResult.negotiation.best_deal.total_value}</p>
                  )}
                </div>
              </GlassPanel>
            )}

            {/* Risk + Quality summary */}
            {crewResult?.risk_analysis && (
              <GlassPanel title="Risk Assessment">
                <div className="flex items-center gap-3 mb-2">
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: crewResult.risk_analysis.threat_level === "red" ? "hsla(0, 60%, 55%, 0.1)" : crewResult.risk_analysis.threat_level === "amber" ? "hsla(40, 70%, 50%, 0.1)" : "hsla(130, 40%, 45%, 0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{
                      fontSize: 20, fontWeight: 800,
                      color: crewResult.risk_analysis.threat_level === "red" ? "hsl(0, 60%, 55%)" : crewResult.risk_analysis.threat_level === "amber" ? "hsl(40, 70%, 50%)" : "hsl(130, 40%, 45%)",
                    }}>{crewResult.risk_analysis.overall_risk_score}/10</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>Threat Level: {crewResult.risk_analysis.threat_level?.toUpperCase()}</p>
                    <p style={{ fontSize: 11, color: "hsl(0, 0%, 50%)", margin: 0 }}>{crewResult.risk_analysis.risk_factors?.length || 0} factors identified</p>
                  </div>
                </div>
              </GlassPanel>
            )}

            {/* Empty state */}
            {!crewResult && (
              <div className="flex flex-col items-center" style={{ padding: "40px 20px", textAlign: "center" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "hsla(130, 30%, 48%, 0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 12,
                }}>
                  <Zap size={28} style={{ color: "hsl(130, 25%, 60%)" }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "hsl(0, 0%, 35%)", margin: "0 0 4px" }}>Your crew is ready</p>
                <p style={{ fontSize: 12, color: "hsl(0, 0%, 55%)", margin: 0 }}>Enter a crop above and deploy 6 AI agents to find you the best deal</p>
              </div>
            )}
          </div>
        )}

        {/* GeoAI SMART FARMING TAB */}
        {activeTab === "map" && <GeoAITab userLocation={userLocation} setUserLocation={setUserLocation} geoData={geoData} setGeoData={setGeoData} geoLoading={geoLoading} setGeoLoading={setGeoLoading} onFarmArea={(a) => setFarmArea(a)} onFarmNDVI={(d) => setFarmNDVI(d)} />}

        {/* PERMISSIONS TAB */}
        {activeTab === "permissions" && (
          <div className="flex flex-col gap-3">
            <GlassPanel title="Agent Authorization">
              <Toggle label="Auto-Negotiate" desc="Allow crew to find buyers and close deals"
                value={permissions.auto_negotiate} onChange={v => setPermissions(p => ({ ...p, auto_negotiate: v }))} />
              <Toggle label="Arrange Logistics" desc="Allow logistics agent to coordinate delivery"
                value={permissions.allow_logistics} onChange={v => setPermissions(p => ({ ...p, allow_logistics: v }))} />
            </GlassPanel>

            <GlassPanel title="Price Floor">
              <p style={{ fontSize: 12, color: "hsl(0, 0%, 50%)", margin: "0 0 8px" }}>Negotiator will never accept below this price</p>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16, fontWeight: 700, color: "hsl(130, 35%, 42%)" }}>R</span>
                <input type="number" value={permissions.min_price_per_kg || ""}
                  onChange={e => setPermissions(p => ({ ...p, min_price_per_kg: parseFloat(e.target.value) || null }))}
                  placeholder="15" style={inputGlass} />
                <span style={{ fontSize: 12, color: "hsl(0, 0%, 50%)" }}>/kg</span>
              </div>
            </GlassPanel>

            <GlassPanel title="Max Deal Value">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16, fontWeight: 700, color: "hsl(130, 35%, 42%)" }}>R</span>
                <input type="number" value={permissions.max_deal_value || ""}
                  onChange={e => setPermissions(p => ({ ...p, max_deal_value: parseFloat(e.target.value) || null }))}
                  placeholder="50000" style={inputGlass} />
              </div>
            </GlassPanel>

            <GlassPanel title="Authorized Crops">
              <div className="flex flex-wrap gap-2 mb-2">
                {permissions.crops.map((c, i) => (
                  <span key={i} style={{
                    padding: "5px 10px", borderRadius: 10, fontSize: 12,
                    fontWeight: 500,
                    background: "hsla(130, 40%, 48%, 0.08)",
                    color: "hsl(130, 35%, 38%)",
                    border: "1px solid hsla(130, 40%, 48%, 0.15)",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    {c}
                    <button onClick={() => removeCrop(i)} style={{ border: "none", background: "none", cursor: "pointer", color: "hsl(0, 50%, 55%)", padding: 0, display: "flex" }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newCrop} onChange={e => setNewCrop(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCrop()}
                  placeholder="Add crop..." style={inputGlass} />
                <button onClick={addCrop} style={btnOutline}>Add</button>
              </div>
            </GlassPanel>

            <button onClick={savePermissions} style={btnPrimary}>
              <ShieldCheck size={14} /> Save Permissions
            </button>
          </div>
        )}

        {/* DEALS TAB */}
        {activeTab === "deals" && (
          <div className="flex flex-col gap-3">
            {deals.length === 0 ? (
              <div className="flex flex-col items-center" style={{ padding: "40px 20px", textAlign: "center" }}>
                <Package size={32} style={{ color: "hsl(0, 0%, 70%)", marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: "hsl(0, 0%, 50%)", margin: 0 }}>No deals yet. Deploy agents to start closing deals.</p>
              </div>
            ) : deals.map(deal => (
              <GlassPanel key={deal.id} title={`${deal.crop} — ${deal.status}`}>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <DataPill label="Quantity" value={`${deal.quantity_kg}kg`} />
                  <DataPill label="Floor" value={`R${deal.asking_price}/kg`} />
                  {deal.negotiated_price && <DataPill label="Negotiated" value={`R${deal.negotiated_price}/kg`} highlight />}
                  {deal.buyer_name && <DataPill label="Buyer" value={deal.buyer_name} />}
                </div>
                <div className="flex justify-between items-center">
                  <span style={{
                    padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 500,
                    background: deal.logistics_status === "arranged" ? "hsla(130, 40%, 48%, 0.08)" : "hsla(40, 70%, 50%, 0.08)",
                    color: deal.logistics_status === "arranged" ? "hsl(130, 35%, 42%)" : "hsl(40, 60%, 40%)",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Truck size={11} /> {deal.logistics_status?.toUpperCase()}
                  </span>
                  {deal.logistics_status === "pending" && permissions.allow_logistics && (
                    <button onClick={() => arrangeLogi(deal.id)} style={btnOutline}>Arrange</button>
                  )}
                </div>
              </GlassPanel>
            ))}
          </div>
        )}
      </div>
      <MiniOrbGuide
        activeTab={activeTab}
        permissions={permissions}
        hasDeals={deals.length > 0}
        hasCrew={!!crewResult}
        farmNDVI={farmNDVI}
        farmArea={farmArea}
        geoData={geoData}
      />
    </div>
  );
};

// ── GeoAI Smart Farming Tab ──────────────────────────────

interface GeoAITabProps {
  userLocation: { lat: number; lng: number } | null;
  setUserLocation: (loc: { lat: number; lng: number } | null) => void;
  geoData: any;
  setGeoData: (d: any) => void;
  geoLoading: boolean;
  setGeoLoading: (l: boolean) => void;
  onNDVIValue?: (v: number) => void;
  onFarmArea?: (a: number) => void;
  onFarmNDVI?: (d: any) => void;
}

const GEO_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geo-intelligence`;

const GeoAITab = ({ userLocation, setUserLocation, geoData, setGeoData, geoLoading, setGeoLoading, onNDVIValue, onFarmArea, onFarmNDVI }: GeoAITabProps) => {
  const [showRehab, setShowRehab] = useState(false);

  const fetchRealData = async (lat: number, lng: number) => {
    setGeoLoading(true);
    setUserLocation({ lat, lng });
    try {
      const resp = await fetch(GEO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ lat, lng, action: "climate" }),
      });
      const data = await resp.json();
      if (data.success) {
        setGeoData({ ...data, lat, lng });
        onNDVIValue?.(data.ndvi?.estimated ?? 0.5);
      } else {
        // fallback
        setGeoData({ fallback: true, lat, lng });
      }
    } catch (e) {
      console.error("geo-intelligence error:", e);
      setGeoData({ fallback: true, lat, lng });
    }
    setGeoLoading(false);
  };

  const fetchLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchRealData(pos.coords.latitude, pos.coords.longitude),
        () => fetchRealData(-26.2, 28.05),
        { timeout: 5000 }
      );
    } else {
      fetchRealData(-26.2, 28.05);
    }
  };

  useEffect(() => { if (!geoData && !geoLoading) fetchLocation(); }, []);

  if (geoLoading || !geoData) {
    return (
      <div className="flex flex-col items-center" style={{ padding: "40px 20px" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "hsl(130, 35%, 48%)", marginBottom: 12 }} />
        <p style={{ fontSize: 13, color: "hsl(0, 0%, 50%)" }}>Fetching satellite data from NASA POWER...</p>
        <p style={{ fontSize: 10, color: "hsl(0, 0%, 65%)", marginTop: 4 }}>Analyzing climate, soil & vegetation</p>
      </div>
    );
  }

  const climate = geoData.climate || {};
  const soil = geoData.soil || {};
  const ndvi = geoData.ndvi || {};
  const irrigation = geoData.irrigation || {};
  const crops = geoData.crops || [];
  const rehab = geoData.rehabilitation || {};
  const forecast = geoData.forecast7d;

  const healthScore = ndvi.healthScore ?? 50;
  const healthColor = healthScore >= 60 ? "hsl(130, 40%, 45%)" : healthScore >= 40 ? "hsl(45, 65%, 48%)" : "hsl(0, 55%, 50%)";

  return (
    <div className="flex flex-col gap-3">
      {/* Farm Boundary Map */}
      <GlassPanel title="Your Farm Boundary" accent>
        <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", margin: "0 0 8px", lineHeight: 1.4 }}>
          Mark your farm boundary, then switch layers to see NDVI, terrain, or street views.
        </p>
        <FarmBoundaryMap
          center={[geoData.lat, geoData.lng]}
          ndviValue={ndvi.estimated}
          onBoundaryChange={(pts, area) => {
            (window as any).__farmBoundary = pts;
            (window as any).__farmArea = area;
            onFarmArea?.(area);
          }}
          onNDVIData={(ndviData) => {
            (window as any).__farmNDVI = ndviData;
            onFarmNDVI?.(ndviData);
          }}
        />
      </GlassPanel>

      {/* Data source badge */}
      <div className="flex items-center gap-2 flex-wrap" style={{ padding: "0 4px" }}>
        <MapPin size={12} style={{ color: "hsl(130, 40%, 45%)" }} />
        <span style={{ fontSize: 11, color: "hsl(0, 0%, 45%)" }}>
          {geoData.lat.toFixed(4)}, {geoData.lng.toFixed(4)}
        </span>
        {geoData.source && (
          <span style={{
            fontSize: 8, padding: "2px 6px", borderRadius: 6,
            background: "hsla(200, 50%, 48%, 0.1)",
            color: "hsl(200, 45%, 42%)", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            {geoData.source}
          </span>
        )}
        <button onClick={() => { setGeoData(null); setGeoLoading(false); }} style={{ ...btnOutline, padding: "4px 10px", fontSize: 10, marginLeft: "auto" }}>
          Refresh
        </button>
      </div>

      {/* Field Health Score */}
      <GlassPanel title="Field Health Score" accent>
        <div className="flex items-center gap-4 mb-3">
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: `conic-gradient(${healthColor} ${healthScore * 3.6}deg, hsla(0,0%,90%,0.3) 0deg)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "hsla(0, 0%, 100%, 0.9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column",
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: healthColor }}>{healthScore}</span>
              <span style={{ fontSize: 8, fontWeight: 600, color: "hsl(0,0%,55%)" }}>/100</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Heart size={12} style={{ color: healthColor }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: healthColor }}>{ndvi.healthClass || "—"}</span>
            </div>
            <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", margin: 0 }}>NDVI: {ndvi.estimated ?? "—"}</p>
            <p style={{ fontSize: 10, color: "hsl(0,0%,60%)", margin: "2px 0 0" }}>GDD: {climate.gdd ?? "—"}°C·days</p>
          </div>
        </div>
      </GlassPanel>

      {/* Climate Overview */}
      <GlassPanel title="Climate Data (30-day)">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <MiniMetric label="Max Temp" value={climate.avgTempMax != null ? `${climate.avgTempMax}°C` : "—"} color="hsl(0, 55%, 55%)" />
          <MiniMetric label="Min Temp" value={climate.avgTempMin != null ? `${climate.avgTempMin}°C` : "—"} color="hsl(200, 55%, 50%)" />
          <MiniMetric label="Now" value={climate.currentTemp != null ? `${climate.currentTemp}°C` : "—"} color="hsl(45, 65%, 48%)" />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <MiniMetric label="Rain 30d" value={climate.totalPrecipitation30d != null ? `${climate.totalPrecipitation30d}mm` : "—"} color="hsl(200, 60%, 48%)" />
          <MiniMetric label="Humidity" value={climate.avgHumidity != null ? `${climate.avgHumidity}%` : "—"} color="hsl(180, 50%, 45%)" />
          <MiniMetric label="Wind" value={climate.avgWind != null ? `${climate.avgWind}m/s` : "—"} color="hsl(0, 0%, 55%)" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Solar Radiation" value={climate.avgSolar != null ? `${climate.avgSolar} MJ/m²` : "—"} color="hsl(45, 70%, 48%)" />
          <MiniMetric label="Evapotranspiration" value={climate.avgET != null ? `${climate.avgET} mm/d` : "—"} color="hsl(130, 40%, 45%)" />
        </div>
      </GlassPanel>

      {/* Soil Moisture — real data */}
      <GlassPanel title="Soil Moisture">
        <div className="flex items-center gap-3 mb-3">
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "hsla(200, 55%, 50%, 0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Droplets size={22} style={{ color: "hsl(200, 55%, 50%)" }} />
          </div>
          <div>
            <span style={{ fontSize: 28, fontWeight: 800, color: "hsl(200, 55%, 50%)" }}>
              {soil.moistureRealtime ?? soil.moisture30dAvg ?? "—"}%
            </span>
            <p style={{ fontSize: 10, color: "hsl(0,0%,50%)", margin: 0 }}>
              {soil.moistureRealtime ? "Real-time" : "30-day avg"} · Soil temp: {soil.soilTemp != null ? `${soil.soilTemp}°C` : "—"}
            </p>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "hsla(0,0%,0%,0.06)", overflow: "hidden" }}>
          <div style={{
            width: `${Math.min(100, soil.moistureRealtime ?? soil.moisture30dAvg ?? 0)}%`,
            height: "100%", borderRadius: 3, background: "hsl(200, 55%, 50%)",
            transition: "width 0.6s ease",
          }} />
        </div>
      </GlassPanel>

      {/* Smart Irrigation — real ET-based */}
      <GlassPanel title="Smart Irrigation">
        <div style={{
          padding: 12, borderRadius: 14,
          background: irrigation.recommendedLiters <= 0.5 ? "hsla(130, 40%, 48%, 0.06)" : irrigation.recommendedLiters < 3 ? "hsla(45, 70%, 50%, 0.06)" : "hsla(0, 60%, 55%, 0.06)",
          border: `1px solid ${irrigation.recommendedLiters <= 0.5 ? "hsla(130, 40%, 48%, 0.12)" : irrigation.recommendedLiters < 3 ? "hsla(45, 70%, 50%, 0.12)" : "hsla(0, 60%, 55%, 0.12)"}`,
          marginBottom: 10,
        }}>
          <div className="flex items-center gap-2 mb-1">
            {irrigation.recommendedLiters <= 0.5
              ? <CheckCircle2 size={14} style={{ color: "hsl(130, 40%, 45%)" }} />
              : <CloudRain size={14} style={{ color: irrigation.recommendedLiters < 3 ? "hsl(45, 65%, 48%)" : "hsl(0, 55%, 50%)" }} />
            }
            <span style={{ fontSize: 14, fontWeight: 700, color: "hsl(0,0%,18%)" }}>{irrigation.advice || "—"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Timer size={10} style={{ color: "hsl(0,0%,50%)" }} />
            <span style={{ fontSize: 11, color: "hsl(0,0%,50%)" }}>{irrigation.nextCheck || "—"}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Deficit" value={irrigation.waterDeficitMM != null ? `${irrigation.waterDeficitMM}mm` : "—"} color="hsl(200, 55%, 50%)" />
          <MiniMetric label="ET₀ Today" value={irrigation.et0Today != null ? `${irrigation.et0Today}mm` : "—"} color="hsl(45, 65%, 48%)" />
          <MiniMetric label="Efficiency" value={irrigation.efficiency != null ? `${irrigation.efficiency}%` : "—"} color="hsl(130, 40%, 45%)" />
        </div>
      </GlassPanel>

      {/* 7-Day Forecast */}
      {forecast && (
        <GlassPanel title="7-Day Forecast">
          <div style={{ overflowX: "auto" }}>
            <div className="flex gap-2" style={{ minWidth: 420 }}>
              {forecast.dates?.map((d: string, i: number) => (
                <div key={d} style={{
                  flex: "0 0 56px", padding: "8px 4px", borderRadius: 12, textAlign: "center",
                  background: i === 0 ? "hsla(130, 40%, 48%, 0.08)" : "hsla(0,0%,100%,0.4)",
                  border: i === 0 ? "1px solid hsla(130, 40%, 48%, 0.15)" : "1px solid hsla(0,0%,0%,0.04)",
                }}>
                  <p style={{ fontSize: 9, fontWeight: 600, color: "hsl(0,0%,50%)", margin: 0 }}>
                    {new Date(d).toLocaleDateString("en", { weekday: "short" })}
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "hsl(0,0%,18%)", margin: "4px 0 0" }}>
                    {Math.round(forecast.temp_max?.[i])}°
                  </p>
                  <p style={{ fontSize: 10, color: "hsl(0,0%,55%)", margin: 0 }}>
                    {Math.round(forecast.temp_min?.[i])}°
                  </p>
                  <div style={{
                    margin: "4px auto 0", width: 24, height: 3, borderRadius: 2,
                    background: "hsla(200, 60%, 50%, 0.15)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${Math.min(100, (forecast.precipitation?.[i] || 0) * 10)}%`,
                      height: "100%", background: "hsl(200, 60%, 48%)",
                    }} />
                  </div>
                  <p style={{ fontSize: 8, color: "hsl(200, 50%, 48%)", margin: "2px 0 0", fontWeight: 600 }}>
                    {(forecast.precipitation?.[i] || 0).toFixed(1)}mm
                  </p>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Best Crops — data-driven */}
      <GlassPanel title="Best Crops for Your Area">
        {crops.map((crop: any, i: number) => (
          <div key={crop.name} style={{
            padding: "10px 0",
            borderBottom: i < crops.length - 1 ? "1px solid hsla(0,0%,0%,0.04)" : "none",
          }}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <Sprout size={13} style={{ color: "hsl(130, 40%, 45%)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "hsl(0,0%,18%)" }}>{crop.name}</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8,
                background: crop.suitability >= 75 ? "hsla(130, 40%, 48%, 0.1)" : "hsla(45, 65%, 50%, 0.1)",
                color: crop.suitability >= 75 ? "hsl(130, 35%, 40%)" : "hsl(45, 55%, 38%)",
              }}>
                {crop.suitability}% match
              </span>
            </div>
            <div className="flex gap-4" style={{ paddingLeft: 21 }}>
              <div>
                <span style={{ fontSize: 9, color: "hsl(0,0%,55%)", textTransform: "uppercase", fontWeight: 600 }}>Expected Yield</span>
                <p style={{ fontSize: 12, fontWeight: 600, color: "hsl(0,0%,30%)", margin: 0 }}>{crop.estimatedYield}</p>
              </div>
              <div>
                <span style={{ fontSize: 9, color: "hsl(0,0%,55%)", textTransform: "uppercase", fontWeight: 600 }}>Temp Score</span>
                <p style={{ fontSize: 12, fontWeight: 500, color: "hsl(0,0%,30%)", margin: 0 }}>{crop.tempScore}%</p>
              </div>
              <div>
                <span style={{ fontSize: 9, color: "hsl(0,0%,55%)", textTransform: "uppercase", fontWeight: 600 }}>Soil</span>
                <p style={{ fontSize: 12, fontWeight: 500, color: "hsl(0,0%,30%)", margin: 0 }}>{crop.soilPref}</p>
              </div>
            </div>
            <div style={{ paddingLeft: 21, marginTop: 6 }}>
              <div style={{ height: 4, borderRadius: 2, background: "hsla(0,0%,0%,0.05)", overflow: "hidden" }}>
                <div style={{ width: `${crop.suitability}%`, height: "100%", borderRadius: 2, background: crop.suitability >= 75 ? "hsl(130, 40%, 48%)" : "hsl(45, 65%, 50%)", transition: "width 0.5s ease" }} />
              </div>
            </div>
          </div>
        ))}
      </GlassPanel>

      {/* Land Rehabilitation */}
      <GlassPanel title="Land Assessment & Rehabilitation">
        <div className="flex items-center gap-3 mb-3">
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: rehab.degradationRisk === "high" ? "hsla(0, 60%, 55%, 0.1)" : rehab.degradationRisk === "moderate" ? "hsla(45, 65%, 50%, 0.1)" : "hsla(130, 40%, 48%, 0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Leaf size={22} style={{
              color: rehab.degradationRisk === "high" ? "hsl(0, 55%, 50%)" : rehab.degradationRisk === "moderate" ? "hsl(45, 60%, 45%)" : "hsl(130, 40%, 45%)",
            }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "hsl(0,0%,18%)" }}>{rehab.ndviClass || "—"}</p>
            <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", margin: "2px 0 0" }}>
              Degradation risk: <span style={{
                fontWeight: 700,
                color: rehab.degradationRisk === "high" ? "hsl(0, 55%, 50%)" : rehab.degradationRisk === "moderate" ? "hsl(45, 60%, 45%)" : "hsl(130, 40%, 45%)",
              }}>{(rehab.degradationRisk || "—").toUpperCase()}</span>
            </p>
            {rehab.restorationTimeline && (
              <p style={{ fontSize: 10, color: "hsl(0,0%,55%)", margin: "2px 0 0" }}>
                Restoration timeline: {rehab.restorationTimeline}
              </p>
            )}
          </div>
        </div>

        <button onClick={() => setShowRehab(!showRehab)} style={{ ...btnOutline, width: "100%", justifyContent: "center", marginBottom: showRehab ? 8 : 0 }}>
          {showRehab ? "Hide" : "Show"} Recommendations
        </button>

        {showRehab && rehab.recommendations && (
          <div style={{ marginTop: 4 }}>
            {rehab.recommendations.map((r: string, i: number) => (
              <div key={i} className="flex gap-2" style={{ padding: "6px 0", borderBottom: "1px solid hsla(0,0%,0%,0.04)" }}>
                <CheckCircle2 size={12} style={{ color: "hsl(130, 40%, 45%)", marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "hsl(0,0%,35%)", lineHeight: 1.4 }}>{r}</span>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
};

const MiniMetric = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{
    padding: "8px 6px", borderRadius: 10, textAlign: "center",
    background: "hsla(0,0%,100%,0.5)",
    border: "1px solid hsla(0,0%,0%,0.04)",
  }}>
    <p style={{ fontSize: 8, fontWeight: 600, color: "hsl(0,0%,55%)", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
    <p style={{ fontSize: 13, fontWeight: 700, color, margin: "2px 0 0" }}>{value}</p>
  </div>
);

const MiniBar = ({ label, pct, color, invert }: { label: string; pct: number; color: string; invert?: boolean }) => (
  <div style={{
    padding: "8px 10px", borderRadius: 12,
    background: "hsla(0,0%,100%,0.5)",
    border: "1px solid hsla(0,0%,0%,0.04)",
  }}>
    <div className="flex justify-between mb-1">
      <span style={{ fontSize: 10, fontWeight: 600, color: "hsl(0,0%,50%)" }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color }}>{pct}%</span>
    </div>
    <div style={{ height: 4, borderRadius: 2, background: "hsla(0,0%,0%,0.06)", overflow: "hidden" }}>
      <div style={{
        width: `${invert ? 100 - pct : pct}%`, height: "100%", borderRadius: 2,
        background: color, transition: "width 0.5s ease",
      }} />
    </div>
  </div>
);

// ── Shared Components ────────────────────────────────────

const GlassPanel = ({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) => (
  <div style={{
    padding: 16, borderRadius: 18,
    background: accent ? "hsla(130, 30%, 97%, 0.7)" : "hsla(0, 0%, 100%, 0.55)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: accent ? "1px solid hsla(130, 40%, 48%, 0.15)" : "1px solid hsla(0, 0%, 100%, 0.5)",
    boxShadow: accent
      ? "0 4px 20px hsla(130, 30%, 40%, 0.06), 0 1px 2px hsla(0, 0%, 0%, 0.02)"
      : "0 2px 12px hsla(0, 0%, 0%, 0.03), 0 1px 2px hsla(0, 0%, 0%, 0.02)",
  }}>
    <h3 style={{
      fontSize: 13, fontWeight: 600, color: "hsl(0, 0%, 22%)",
      margin: "0 0 10px", letterSpacing: "0.01em",
    }}>
      {title}
    </h3>
    {children}
  </div>
);

const MetricPill = ({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) => (
  <div style={{
    padding: "10px 12px", borderRadius: 14,
    background: "hsla(0, 0%, 100%, 0.5)",
    border: "1px solid hsla(0, 0%, 0%, 0.04)",
    textAlign: "center",
  }}>
    <div className="flex items-center justify-center gap-1 mb-1" style={{ color: `${color}90` }}>
      {icon}
      <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
    </div>
    <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
  </div>
);

const DataPill = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 500, color: "hsl(0, 0%, 55%)", letterSpacing: "0.02em" }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: highlight ? 700 : 500, color: highlight ? "hsl(130, 40%, 38%)" : "hsl(0, 0%, 22%)" }}>{value}</div>
  </div>
);

const Toggle = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex justify-between items-center" style={{ padding: "10px 0", borderBottom: "1px solid hsla(0, 0%, 0%, 0.04)" }}>
    <div>
      <p style={{ fontSize: 13, fontWeight: 500, color: "hsl(0, 0%, 22%)", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 11, color: "hsl(0, 0%, 55%)", margin: 0 }}>{desc}</p>
    </div>
    <button onClick={() => onChange(!value)} style={{
      width: 44, height: 24, borderRadius: 12, border: "none",
      background: value ? "hsl(130, 40%, 48%)" : "hsl(0, 0%, 85%)",
      cursor: "pointer", position: "relative", transition: "all 0.2s",
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: "white",
        position: "absolute", top: 3,
        left: value ? 23 : 3, transition: "left 0.2s",
        boxShadow: "0 1px 4px hsla(0, 0%, 0%, 0.15)",
      }} />
    </button>
  </div>
);

const InfoTile = ({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) => (
  <div style={{
    padding: 12, borderRadius: 14,
    background: "hsla(0, 0%, 100%, 0.5)",
    border: "1px solid hsla(0, 0%, 0%, 0.04)",
  }}>
    <div className="flex items-center gap-2 mb-1" style={{ color }}>
      {icon}
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
    </div>
    <div style={{ fontSize: 18, fontWeight: 700, color: "hsl(0, 0%, 18%)" }}>{value}</div>
    <div style={{ fontSize: 10, color: "hsl(0, 0%, 55%)" }}>{sub}</div>
  </div>
);

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-1">
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
    <span style={{ fontSize: 9, color: "hsl(0, 0%, 40%)" }}>{label}</span>
  </div>
);

// ── Shared Styles ────────────────────────────────────────

const inputGlass: React.CSSProperties = {
  flex: 1, padding: "10px 14px", borderRadius: 12, fontSize: 13,
  border: "1px solid hsla(130, 20%, 60%, 0.12)",
  background: "hsla(0, 0%, 100%, 0.6)",
  backdropFilter: "blur(10px)",
  outline: "none", color: "hsl(0, 0%, 18%)",
  fontFamily: "'SF Pro Text', -apple-system, system-ui, sans-serif",
};

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: "11px 16px", borderRadius: 14, border: "none",
  background: "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))",
  color: "white", fontSize: 13, fontWeight: 600,
  cursor: "pointer", transition: "all 0.2s",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  boxShadow: "0 3px 12px hsla(130, 35%, 40%, 0.2)",
  fontFamily: "'SF Pro Text', -apple-system, system-ui, sans-serif",
};

const btnOutline: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 12,
  border: "1px solid hsla(130, 30%, 48%, 0.2)",
  background: "hsla(130, 30%, 48%, 0.06)",
  color: "hsl(130, 35%, 38%)", fontSize: 12, fontWeight: 600,
  cursor: "pointer", transition: "all 0.2s",
  display: "flex", alignItems: "center", gap: 5,
  fontFamily: "'SF Pro Text', -apple-system, system-ui, sans-serif",
};

export default AgentDashboard;
