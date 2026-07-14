import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import FarmBoundaryMap, { type NDVIData } from "@/components/FarmBoundaryMap";
import MarketLink from "@/components/MarketLink";
import { toast } from "sonner";
import {
  Search, Handshake, Truck, Shield, Lock, Gauge, Wheat,
  TrendingUp, Zap, ChevronRight, Check, X, Play, Loader2, BarChart3,
  Package, CircleDollarSign, Eye, AlertTriangle, Activity,
  Globe, Target, Network, CheckCircle2, Map, Layers, MapPin, Droplets,
  Thermometer, Wind, Leaf, ShieldCheck, ArrowUpRight, ArrowDownRight,
  CloudRain, Sun, Sprout, BarChart, Heart, Timer,
} from "lucide-react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";
const AGENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-negotiate`;
const GEO_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geo-intelligence`;

// ── Types ────────────────────────────────────────────────

export interface AgentPermissions {
  auto_negotiate: boolean;
  min_price_per_kg: number | null;
  crops: string[];
  max_deal_value: number | null;
  allow_logistics: boolean;
}

export interface Deal {
  id: string;
  crop: string;
  quantity_kg: number;
  asking_price: number;
  negotiated_price: number | null;
  buyer_name: string | null;
  buyer_id?: string | null;
  status: string;
  approval_state?: string;
  logistics_status: string;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
  predicted_price?: number | null;
  recommendation?: string | null;
  confidence?: number | null;
  payment_status?: string;
  paid_amount?: number | null;
  paid_at?: string | null;
  payment_reference?: string | null;
  payment_method?: string | null;
  farmer_rating?: number | null;
  feedback_note?: string | null;
}

export interface Buyer {
  id: string;
  name: string;
  buyer_type: string;
  contact_phone: string | null;
  region: string | null;
  city: string | null;
  crops: string[];
  min_price_per_kg: number | null;
  max_price_per_kg: number | null;
  payment_terms: string | null;
  reliability_score: number;
  verified: boolean;
}

export interface FarmerStat {
  crop: string;
  deals_closed: number;
  deals_won: number;
  avg_achieved_price: number | null;
  avg_predicted_price: number | null;
  avg_rating: number | null;
  prediction_accuracy: number | null;
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

// ── Shared Styles ────────────────────────────────────────

export const inputGlass: React.CSSProperties = {
  flex: 1, padding: "10px 14px", borderRadius: 12, fontSize: 13,
  border: "1px solid hsla(130, 20%, 60%, 0.12)",
  background: "hsla(0, 0%, 100%, 0.6)",
  backdropFilter: "blur(10px)",
  outline: "none", color: "hsl(0, 0%, 18%)",
  fontFamily: FONT,
};

export const btnPrimary: React.CSSProperties = {
  flex: 1, padding: "11px 16px", borderRadius: 14, border: "none",
  background: "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))",
  color: "white", fontSize: 13, fontWeight: 600,
  cursor: "pointer", transition: "all 0.2s",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  boxShadow: "0 3px 12px hsla(130, 35%, 40%, 0.2)",
  fontFamily: FONT,
};

export const btnOutline: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 12,
  border: "1px solid hsla(130, 30%, 48%, 0.2)",
  background: "hsla(130, 30%, 48%, 0.06)",
  color: "hsl(130, 35%, 38%)", fontSize: 12, fontWeight: 600,
  cursor: "pointer", transition: "all 0.2s",
  display: "flex", alignItems: "center", gap: 5,
  fontFamily: FONT,
};

// ── Shared Components ────────────────────────────────────

export const GlassPanel = ({ title, children, accent }: { title: string; children: ReactNode; accent?: boolean }) => (
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
    <h3 style={{ fontSize: 13, fontWeight: 600, color: "hsl(0, 0%, 22%)", margin: "0 0 10px", letterSpacing: "0.01em" }}>{title}</h3>
    {children}
  </div>
);

export const MetricPill = ({ label, value, icon, color }: { label: string; value: string; icon: ReactNode; color: string }) => (
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

export const DataPill = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 500, color: "hsl(0, 0%, 55%)", letterSpacing: "0.02em" }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: highlight ? 700 : 500, color: highlight ? "hsl(130, 40%, 38%)" : "hsl(0, 0%, 22%)" }}>{value}</div>
  </div>
);

export const Toggle = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
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
        width: 18, height: 18, borderRadius: "50%", background: "white",
        position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s",
        boxShadow: "0 1px 4px hsla(0, 0%, 0%, 0.15)",
      }} />
    </button>
  </div>
);

const MiniMetric = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{
    padding: "8px 6px", borderRadius: 10, textAlign: "center",
    background: "hsla(0,0%,100%,0.5)", border: "1px solid hsla(0,0%,0%,0.04)",
  }}>
    <p style={{ fontSize: 8, fontWeight: 600, color: "hsl(0,0%,55%)", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
    <p style={{ fontSize: 13, fontWeight: 700, color, margin: "2px 0 0" }}>{value}</p>
  </div>
);

// ── useAgentCrew hook ────────────────────────────────────

export function useAgentCrew() {
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

  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [stats, setStats] = useState<FarmerStat[]>([]);

  const refreshDeals = useCallback(async () => {
    const dealsRes = await callAgent({ action: "get_deals" });
    if (dealsRes.deals) setDeals(dealsRes.deals);
  }, [callAgent]);

  const refreshOutcomes = useCallback(async () => {
    const res = await callAgent({ action: "get_outcomes" });
    if (res.success) setStats(res.stats || []);
  }, [callAgent]);

  useEffect(() => {
    const load = async () => {
      try {
        const [permsRes, dealsRes, buyersRes, outcomesRes] = await Promise.all([
          callAgent({ action: "get_permissions" }),
          callAgent({ action: "get_deals" }),
          callAgent({ action: "get_buyers" }),
          callAgent({ action: "get_outcomes" }),
        ]);
        if (permsRes.permissions) setPermissions(permsRes.permissions);
        if (dealsRes.deals) setDeals(dealsRes.deals);
        if (buyersRes.buyers) setBuyers(buyersRes.buyers);
        if (outcomesRes.stats) setStats(outcomesRes.stats);
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

  const markPaid = async (dealId: string, paidAmount: number, reference: string, method: string) => {
    const res = await callAgent({ action: "mark_paid", deal_id: dealId, paid_amount: paidAmount, payment_reference: reference, payment_method: method });
    if (res.success) { toast.success("Marked as paid — system learning updated"); await refreshDeals(); await refreshOutcomes(); }
    else toast.error(res.error || "Failed");
  };

  const rateDeal = async (dealId: string, rating: number, note: string) => {
    const res = await callAgent({ action: "rate_deal", deal_id: dealId, rating, feedback_note: note });
    if (res.success) { toast.success("Feedback saved — orchestrator will weight this next time"); await refreshDeals(); await refreshOutcomes(); }
    else toast.error(res.error || "Failed");
  };

  // Orchestrator Phase 1: Gather signals only. Negotiator + Logistics stay idle.
  const launchFullCrew = async () => {
    if (!scanCrop.trim()) { toast.error("Enter a crop name"); return; }
    if (!permissions.auto_negotiate) { toast.error("Enable auto-negotiate in Permissions first"); return; }
    setNegotiating(true);
    setCrewResult(null);
    const agents = makeCrewAgents();
    setCrewAgents(agents);
    // Only Market + Quality activate first (signal gathering)
    setCrewAgents(prev => prev.map(a => a.code === "MKT" || a.code === "QAI" ? { ...a, status: "active" } : a));
    setTimeout(() => {
      setCrewAgents(prev => prev.map(a => {
        if (a.code === "MKT" || a.code === "QAI") return { ...a, status: "complete" };
        if (a.code === "RSK") return { ...a, status: "active" }; // Risk modifies confidence
        return a;
      }));
    }, 3000);
    try {
      const res = await callAgent({ action: "orchestrator_analyze", crop: scanCrop, quantity_kg: parseFloat(scanQty) || 100 });
      if (res.success) {
        setCrewResult(res.crew);
        // Mark only the signal-gathering agents complete. Negotiator/SCO/Logistics remain standby
        // until orchestrator GO decision is approved by the farmer.
        setCrewAgents(prev => prev.map(a => {
          if (a.code === "MKT" || a.code === "QAI" || a.code === "RSK") return { ...a, status: "complete" as const };
          return { ...a, status: "standby" as const };
        }));
        const rec = res.crew?.decision?.recommendation;
        toast.success(`Orchestrator: ${rec} (confidence ${Math.round((res.crew?.decision?.confidence || 0) * 100)}%)`);
      } else {
        toast.error(res.error || "Analysis failed");
        setCrewAgents(prev => prev.map(a => a.status === "active" ? { ...a, status: "error" as const } : a));
      }
    } catch {
      toast.error("Analysis failed");
      setCrewAgents(makeCrewAgents());
    }
    setNegotiating(false);
  };

  // Orchestrator Phase 2: Farmer-approved decision dispatch.
  const executeDecision = async (decision: "GO" | "HOLD" | "NO_GO") => {
    if (!crewResult) return;
    if (decision !== "GO") {
      await callAgent({
        action: "execute_decision", decision, crop: scanCrop,
        quantity_kg: parseFloat(scanQty) || 100,
      });
      toast.message(decision === "HOLD" ? "Holding — no agents dispatched" : "Cancelled — no action taken");
      return;
    }
    setNegotiating(true);
    setCrewAgents(prev => prev.map(a => (a.code === "NEG" || a.code === "SCO") ? { ...a, status: "active" } : a));
    try {
      const res = await callAgent({
        action: "execute_decision",
        decision: "GO",
        crop: scanCrop,
        quantity_kg: parseFloat(scanQty) || 100,
        confidence: crewResult.decision?.confidence,
        market_analysis: crewResult.market_analysis,
        quality_assessment: crewResult.quality_assessment,
        risk_analysis: crewResult.risk_analysis,
      });
      if (res.success && res.execution) {
        setCrewResult((prev: any) => ({ ...prev, ...res.execution }));
        setCrewAgents(prev => prev.map(a => (a.code === "NEG" || a.code === "SCO") ? { ...a, status: "complete" } : a));
        const dealsRes = await callAgent({ action: "get_deals" });
        if (dealsRes.deals) setDeals(dealsRes.deals);
        toast.success("Deal negotiated and supply chain planned");
      } else {
        toast.error(res.error || "Execution failed");
      }
    } catch { toast.error("Execution failed"); }
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

  // Logistics only executes AFTER an orchestrator-approved deal exists.
  const arrangeLogi = async (dealId: string) => {
    setCrewAgents(prev => prev.map(a => a.code === "LOG" ? { ...a, status: "active" } : a));
    const res = await callAgent({ action: "arrange_logistics", deal_id: dealId });
    if (res.success) {
      toast.success("Logistics grouping executed");
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
  const summary = crewResult?.intelligence_summary;

  return {
    farmerName, permissions, setPermissions, deals, loading,
    scanning, negotiating, crewResult, crewAgents, scanCrop, setScanCrop,
    scanQty, setScanQty, newCrop, setNewCrop, savePermissions,
    launchFullCrew, executeDecision, scanMarketOnly, arrangeLogi, addCrop, removeCrop, summary,
    buyers, stats, markPaid, rateDeal,
  };
}

// ── Agents Content ───────────────────────────────────────

const AgentOrb = ({ agent }: { agent: CrewAgent }) => {
  const AgentIcon = agent.icon;
  const isActive = agent.status === "active";
  const isDone = agent.status === "complete";
  const isError = agent.status === "error";
  return (
    <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 44 }}>
      <div style={{
        width: 42, height: 42, borderRadius: 14,
        background: isDone
          ? `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`
          : isActive ? "hsla(0,0%,100%,0.9)" : isError ? "hsla(0,70%,95%,0.8)" : "hsla(0,0%,100%,0.55)",
        border: isActive ? `1.5px solid ${agent.color}` : isDone ? "none" : "1px solid hsla(0,0%,0%,0.05)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: isDone ? `0 4px 16px ${agent.color}35` : isActive ? `0 0 16px ${agent.color}25` : "0 2px 8px hsla(0,0%,0%,0.03)",
        transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        backdropFilter: "blur(12px)",
        transform: isActive ? "scale(1.08)" : isDone ? "scale(1.02)" : "scale(1)",
      }}>
        {isActive ? <Loader2 size={15} className="animate-spin" style={{ color: agent.color }} />
          : isDone ? <Check size={15} color="white" strokeWidth={2.5} />
          : <AgentIcon size={15} style={{ color: isError ? "hsl(0,60%,55%)" : "hsl(0,0%,45%)" }} />}
      </div>
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: "0.02em",
        color: isDone ? agent.color : isActive ? agent.color : "hsl(0,0%,52%)",
        transition: "color 0.3s",
      }}>{agent.name}</span>
    </div>
  );
};

const QuickCropChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button onClick={onClick} style={{
    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
    border: active ? "1.5px solid hsl(130, 40%, 48%)" : "1px solid hsla(0,0%,0%,0.06)",
    background: active ? "hsla(130, 40%, 48%, 0.1)" : "hsla(0,0%,100%,0.5)",
    color: active ? "hsl(130, 35%, 38%)" : "hsl(0,0%,45%)",
    cursor: "pointer", transition: "all 0.2s",
    backdropFilter: "blur(8px)", fontFamily: FONT,
  }}>
    {label}
  </button>
);

export const AgentsContent = ({ crew }: { crew: ReturnType<typeof useAgentCrew> }) => {
  const { scanCrop, setScanCrop, scanQty, setScanQty, scanning, negotiating,
    scanMarketOnly, launchFullCrew, executeDecision, crewResult, crewAgents, summary } = crew;

  const quickCrops = ["Spinach", "Tomatoes", "Maize", "Potatoes", "Cabbage"];
  const allStandby = crewAgents.every(a => a.status === "standby");
  const allDone = crewAgents.every(a => a.status === "complete");
  const activeCount = crewAgents.filter(a => a.status === "active").length;
  const doneCount = crewAgents.filter(a => a.status === "complete").length;

  return (
    <div className="flex flex-col gap-4" style={{ padding: "0 2px" }}>
      {/* Agent Pipeline - Horizontal Scroll */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 11, fontWeight: 600, color: "hsl(0,0%,40%)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
            Agent Pipeline
          </span>
          {!allStandby && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 10,
              background: allDone ? "hsla(130, 40%, 48%, 0.1)" : "hsla(40, 80%, 55%, 0.1)",
              color: allDone ? "hsl(130, 35%, 42%)" : "hsl(40, 60%, 42%)",
            }}>
              {allDone ? "Complete" : `${doneCount}/6 — ${activeCount} active`}
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div style={{
          height: 3, borderRadius: 2, background: "hsla(0,0%,0%,0.04)", marginBottom: 10, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: "linear-gradient(90deg, hsl(130, 40%, 48%), hsl(142, 45%, 55%))",
            width: `${(doneCount / 6) * 100}%`,
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
          {crewAgents.map(agent => <AgentOrb key={agent.code} agent={agent} />)}
        </div>
      </div>

      {/* Mission Input — streamlined */}
      <div style={{
        padding: 16, borderRadius: 20,
        background: "hsla(0,0%,100%,0.6)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: "1px solid hsla(0,0%,100%,0.5)",
        boxShadow: "0 2px 16px hsla(0,0%,0%,0.03)",
      }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "hsl(0,0%,18%)", margin: "0 0 3px" }}>What are you selling?</p>
        <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", margin: "0 0 12px" }}>Pick a crop or type your own, then deploy your AI crew</p>

        {/* Quick crop chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {quickCrops.map(c => (
            <QuickCropChip key={c} label={c} active={scanCrop === c} onClick={() => setScanCrop(c)} />
          ))}
        </div>

        <div className="flex gap-2 mb-3">
          <input value={scanCrop} onChange={e => setScanCrop(e.target.value)}
            placeholder="Or type a crop..."
            style={{ ...inputGlass, borderRadius: 14, padding: "12px 16px" }} />
          <input value={scanQty} onChange={e => setScanQty(e.target.value)} type="number" placeholder="Kg"
            style={{ ...inputGlass, maxWidth: 72, borderRadius: 14, padding: "12px 14px", textAlign: "center" as const }} />
        </div>

        <div className="flex gap-2">
          <button onClick={scanMarketOnly} disabled={scanning} style={{
            ...btnOutline, flex: 1, borderRadius: 14, padding: "12px 16px",
          }}>
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {scanning ? "Scanning..." : "Quick Scan"}
          </button>
          <button onClick={launchFullCrew} disabled={negotiating} style={{
            ...btnPrimary, flex: 2, borderRadius: 14, padding: "12px 16px",
            background: negotiating
              ? "hsl(0,0%,75%)"
              : "linear-gradient(135deg, hsl(130, 42%, 46%), hsl(155, 38%, 42%))",
          }}>
            {negotiating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {negotiating ? "Orchestrator working..." : "Run Orchestrator Analysis"}
          </button>
        </div>
      </div>

      {/* Orchestrator Decision Gate — farmer must approve before Negotiator/Logistics act */}
      {crewResult?.decision && !crewResult?.negotiation && (
        <div style={{
          padding: 16, borderRadius: 20,
          background: crewResult.decision.recommendation === "GO"
            ? "linear-gradient(135deg, hsla(130, 40%, 95%, 0.9), hsla(130, 40%, 92%, 0.6))"
            : crewResult.decision.recommendation === "HOLD"
            ? "linear-gradient(135deg, hsla(45, 80%, 95%, 0.9), hsla(45, 80%, 92%, 0.6))"
            : "linear-gradient(135deg, hsla(0, 60%, 95%, 0.9), hsla(0, 60%, 92%, 0.6))",
          backdropFilter: "blur(24px)",
          border: `1px solid ${crewResult.decision.recommendation === "GO" ? "hsla(130, 40%, 48%, 0.2)" : crewResult.decision.recommendation === "HOLD" ? "hsla(45, 70%, 50%, 0.2)" : "hsla(0, 60%, 55%, 0.2)"}`,
        }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
              color: crewResult.decision.recommendation === "GO" ? "hsl(130, 35%, 38%)" : crewResult.decision.recommendation === "HOLD" ? "hsl(40, 60%, 38%)" : "hsl(0, 55%, 45%)" }}>
              Orchestrator Recommendation
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 10,
              background: "hsla(0,0%,100%,0.6)", color: "hsl(0,0%,30%)" }}>
              {Math.round((crewResult.decision.confidence || 0) * 100)}% confidence
            </span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "4px 0",
            color: crewResult.decision.recommendation === "GO" ? "hsl(130, 40%, 35%)" : crewResult.decision.recommendation === "HOLD" ? "hsl(40, 60%, 35%)" : "hsl(0, 55%, 40%)" }}>
            {crewResult.decision.recommendation}
          </p>
          <p style={{ fontSize: 11, color: "hsl(0,0%,40%)", margin: "0 0 12px", lineHeight: 1.4 }}>
            {crewResult.decision.rationale}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <MiniMetric label="Demand" value={String(crewResult.decision.signals?.demand || "—")} color="hsl(130, 40%, 45%)" />
            <MiniMetric label="Risk" value={`${crewResult.decision.signals?.risk_score ?? "—"}/10`} color="hsl(15, 70%, 50%)" />
            <MiniMetric label="Quality" value={`${crewResult.decision.signals?.quality_score ?? "—"}`} color="hsl(200, 50%, 50%)" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => executeDecision("NO_GO")} disabled={negotiating}
              style={{ ...btnOutline, flex: 1, justifyContent: "center" }}>
              <X size={13} /> Cancel
            </button>
            <button onClick={() => executeDecision("HOLD")} disabled={negotiating}
              style={{ ...btnOutline, flex: 1, justifyContent: "center" }}>
              <Timer size={13} /> Hold
            </button>
            <button onClick={() => executeDecision("GO")} disabled={negotiating}
              style={{ ...btnPrimary, flex: 1.4 }}>
              {negotiating ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              Approve GO
            </button>
          </div>
          <p style={{ fontSize: 10, color: "hsl(0,0%,55%)", margin: "10px 0 0", textAlign: "center" }}>
            Negotiator and Logistics will only act after you approve.
          </p>
        </div>
      )}

      {/* Intelligence Summary */}
      {summary && (
        <div style={{
          padding: 16, borderRadius: 20,
          background: "linear-gradient(135deg, hsla(130, 30%, 97%, 0.8), hsla(130, 30%, 95%, 0.5))",
          backdropFilter: "blur(24px)",
          border: "1px solid hsla(130, 40%, 48%, 0.12)",
          boxShadow: "0 4px 24px hsla(130, 30%, 40%, 0.06)",
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "hsl(130, 30%, 42%)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Intelligence Report</p>
          <div className="grid grid-cols-2 gap-2">
            <MetricPill label="Best Price" value={`R${summary.best_price}/kg`} icon={<TrendingUp size={12} />} color="hsl(130, 40%, 45%)" />
            <MetricPill label="Quality" value={`${summary.quality_score || "--"}/100`} icon={<Eye size={12} />} color="hsl(200, 50%, 50%)" />
            <MetricPill label="Risk" value={summary.risk_level?.toUpperCase() || "--"} icon={<AlertTriangle size={12} />}
              color={summary.risk_level === "red" ? "hsl(0, 60%, 55%)" : summary.risk_level === "amber" ? "hsl(40, 70%, 50%)" : "hsl(130, 40%, 45%)"} />
            <MetricPill label="Revenue" value={`R${summary.total_revenue || "--"}`} icon={<CircleDollarSign size={12} />} color="hsl(130, 40%, 45%)" />
          </div>
        </div>
      )}

      {/* Market Analysis */}
      {crewResult?.market_analysis && (
        <GlassPanel title="Market Analysis">
          <div className="grid grid-cols-2 gap-2">
            <DataPill label="Recommended Price" value={`R${crewResult.market_analysis.recommended_price}/kg`} highlight />
            <DataPill label="Demand" value={crewResult.market_analysis.demand_level} />
          </div>
        </GlassPanel>
      )}

      {/* Best Deal */}
      {crewResult?.negotiation?.best_deal && (
        <div style={{
          padding: 20, borderRadius: 20, textAlign: "center" as const,
          background: "linear-gradient(135deg, hsla(130, 40%, 48%, 0.06), hsla(130, 40%, 48%, 0.02))",
          border: "1px solid hsla(130, 40%, 48%, 0.12)",
          backdropFilter: "blur(24px)",
        }}>
          <CheckCircle2 size={20} style={{ color: "hsl(130, 40%, 48%)", marginBottom: 6 }} />
          <p style={{ fontSize: 10, fontWeight: 600, color: "hsl(130, 35%, 42%)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Deal Secured</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: "hsl(130, 40%, 35%)", margin: "4px 0", letterSpacing: "-0.02em" }}>
            R{crewResult.negotiation.best_deal.final_price}<span style={{ fontSize: 14, fontWeight: 500 }}>/kg</span>
          </p>
          <p style={{ fontSize: 12, color: "hsl(0, 0%, 45%)", margin: 0 }}>{crewResult.negotiation.best_deal.buyer_name}</p>
        </div>
      )}

      {/* Empty State */}
      {!crewResult && (
        <div className="flex flex-col items-center" style={{ padding: "24px 20px", textAlign: "center" as const }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "linear-gradient(135deg, hsla(130, 40%, 48%, 0.08), hsla(130, 40%, 48%, 0.03))",
            border: "1px solid hsla(130, 40%, 48%, 0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <Zap size={22} style={{ color: "hsl(130, 30%, 55%)" }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "hsl(0,0%,28%)", margin: "0 0 4px" }}>Your crew awaits</p>
          <p style={{ fontSize: 12, color: "hsl(0,0%,50%)", margin: 0, maxWidth: 220 }}>
            Select a crop above and deploy 6 specialized AI agents to find buyers, negotiate, and arrange logistics
          </p>
        </div>
      )}
    </div>
  );
};

// ── Permissions Content ──────────────────────────────────

export const PermissionsContent = ({ crew }: { crew: ReturnType<typeof useAgentCrew> }) => {
  const { permissions, setPermissions, newCrop, setNewCrop, addCrop, removeCrop, savePermissions } = crew;
  return (
    <div className="flex flex-col gap-3" style={{ padding: "0 4px" }}>
      <GlassPanel title="Agent Authorization">
        <Toggle label="Auto-Negotiate" desc="Allow crew to find buyers and close deals"
          value={permissions.auto_negotiate} onChange={v => setPermissions(p => ({ ...p, auto_negotiate: v }))} />
        <Toggle label="Arrange Logistics" desc="Allow logistics agent to coordinate delivery"
          value={permissions.allow_logistics} onChange={v => setPermissions(p => ({ ...p, allow_logistics: v }))} />
      </GlassPanel>

      <GlassPanel title="Price Floor">
        <p style={{ fontSize: 12, color: "hsl(0,0%,50%)", margin: "0 0 8px" }}>Negotiator will never accept below this price</p>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16, fontWeight: 700, color: "hsl(130, 35%, 42%)" }}>R</span>
          <input type="number" value={permissions.min_price_per_kg || ""}
            onChange={e => setPermissions(p => ({ ...p, min_price_per_kg: parseFloat(e.target.value) || null }))}
            placeholder="15" style={inputGlass} />
          <span style={{ fontSize: 12, color: "hsl(0,0%,50%)" }}>/kg</span>
        </div>
      </GlassPanel>

      <GlassPanel title="Authorized Crops">
        <div className="flex flex-wrap gap-2 mb-2">
          {permissions.crops.map((c, i) => (
            <span key={i} style={{
              padding: "5px 10px", borderRadius: 10, fontSize: 12, fontWeight: 500,
              background: "hsla(130, 40%, 48%, 0.08)", color: "hsl(130, 35%, 38%)",
              border: "1px solid hsla(130, 40%, 48%, 0.15)",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {c}
              <button onClick={() => removeCrop(i)} style={{ border: "none", background: "none", cursor: "pointer", color: "hsl(0,50%,55%)", padding: 0, display: "flex" }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newCrop} onChange={e => setNewCrop(e.target.value)} onKeyDown={e => e.key === "Enter" && addCrop()}
            placeholder="Add crop..." style={inputGlass} />
          <button onClick={addCrop} style={btnOutline}>Add</button>
        </div>
      </GlassPanel>

      <button onClick={savePermissions} style={btnPrimary}>
        <ShieldCheck size={14} /> Save Permissions
      </button>
    </div>
  );
};

// ── Deals Content ────────────────────────────────────────

const PaymentForm = ({ deal, onSubmit }: { deal: Deal; onSubmit: (amt: number, ref: string, method: string) => void }) => {
  const defaultAmt = deal.negotiated_price && deal.quantity_kg ? deal.negotiated_price * deal.quantity_kg : 0;
  const [amt, setAmt] = useState(String(defaultAmt));
  const [ref, setRef] = useState("");
  const [method, setMethod] = useState("EFT");
  return (
    <div className="flex flex-col gap-2" style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "hsla(130, 40%, 96%, 0.6)", border: "1px solid hsla(130, 40%, 48%, 0.12)" }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "hsl(130, 35%, 38%)", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Mark Payment Received</p>
      <input value={amt} onChange={e => setAmt(e.target.value)} type="number" placeholder="Amount (R)" style={inputGlass} />
      <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Reference / receipt #" style={inputGlass} />
      <select value={method} onChange={e => setMethod(e.target.value)} style={{ ...inputGlass, padding: "10px 12px" }}>
        <option value="EFT">EFT</option>
        <option value="Cash">Cash</option>
        <option value="Mobile">Mobile (e.g. SnapScan)</option>
        <option value="Other">Other</option>
      </select>
      <button onClick={() => onSubmit(parseFloat(amt) || 0, ref, method)} style={btnPrimary}>
        <Check size={13} /> Confirm Paid
      </button>
    </div>
  );
};

const RatingForm = ({ onSubmit }: { onSubmit: (r: number, n: string) => void }) => {
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-2" style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "hsla(45, 70%, 96%, 0.6)", border: "1px solid hsla(45, 60%, 48%, 0.12)" }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "hsl(40, 60%, 38%)", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Rate this deal — feeds learning</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setRating(n)} style={{
            width: 32, height: 32, borderRadius: 10, border: "none", cursor: "pointer",
            background: n <= rating ? "hsl(45, 80%, 55%)" : "hsla(0,0%,0%,0.06)",
            color: n <= rating ? "white" : "hsl(0,0%,50%)", fontWeight: 700,
          }}>{n}</button>
        ))}
      </div>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note (what went well/wrong?)" style={inputGlass} />
      <button onClick={() => rating > 0 && onSubmit(rating, note)} disabled={rating === 0} style={{ ...btnPrimary, opacity: rating === 0 ? 0.5 : 1 }}>
        <Heart size={13} /> Submit Rating
      </button>
    </div>
  );
};

export const DealsContent = ({ crew }: { crew: ReturnType<typeof useAgentCrew> }) => {
  const { deals, permissions, arrangeLogi, markPaid, rateDeal, buyers, stats, farmerName } = crew;
  const [openPay, setOpenPay] = useState<string | null>(null);
  const [openRate, setOpenRate] = useState<string | null>(null);
  const [tab, setTab] = useState<"market" | "deals" | "buyers" | "learning">("market");
  const tabs: { key: typeof tab; label: string; count: number }[] = [
    { key: "market", label: "Market", count: buyers.length },
    { key: "deals", label: "Deals", count: deals.length },
    { key: "buyers", label: "Buyers", count: buyers.length },
    { key: "learning", label: "Learning", count: stats.length },
  ];
  return (
    <div className="flex flex-col gap-3" style={{ padding: "0 4px" }}>
      <div className="flex gap-1" style={{ padding: 4, borderRadius: 14, background: "hsla(0,0%,0%,0.04)" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "8px 6px", borderRadius: 10, border: "none", cursor: "pointer",
            background: tab === t.key ? "white" : "transparent",
            color: tab === t.key ? "hsl(130, 35%, 38%)" : "hsl(0,0%,45%)",
            fontWeight: 600, fontSize: 11, fontFamily: FONT,
            boxShadow: tab === t.key ? "0 2px 8px hsla(0,0%,0%,0.06)" : "none",
            transition: "all 0.2s",
          }}>
            {t.label} <span style={{ fontSize: 9, opacity: 0.7 }}>({t.count})</span>
          </button>
        ))}
      </div>
      {tab === "market" && <MarketLink farmerName={farmerName} buyers={buyers} />}
      {tab === "buyers" && <BuyersContent crew={crew} />}
      {tab === "learning" && <LearningContent crew={crew} />}
      {tab === "deals" && (deals.length === 0 ? (
        <div className="flex flex-col items-center" style={{ padding: "30px 20px", textAlign: "center" }}>
          <Package size={28} style={{ color: "hsl(0,0%,70%)", marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: "hsl(0,0%,50%)", margin: 0 }}>No deals yet. Deploy agents to start.</p>
        </div>
      ) : deals.map(deal => {
        const isPaid = deal.payment_status === "paid";
        const isRated = !!deal.farmer_rating;
        return (
        <GlassPanel key={deal.id} title={`${deal.crop} — ${deal.status}${isPaid ? " · paid" : ""}`}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <DataPill label="Quantity" value={`${deal.quantity_kg}kg`} />
            <DataPill label="Floor" value={`R${deal.asking_price}/kg`} />
            {deal.negotiated_price && <DataPill label="Negotiated" value={`R${deal.negotiated_price}/kg`} highlight />}
            {deal.buyer_name && <DataPill label="Buyer" value={deal.buyer_name} />}
            {deal.predicted_price != null && <DataPill label="Predicted" value={`R${Number(deal.predicted_price).toFixed(2)}/kg`} />}
            {deal.confidence != null && <DataPill label="Confidence" value={`${Math.round(Number(deal.confidence) * 100)}%`} />}
            {isPaid && deal.paid_amount != null && <DataPill label="Paid" value={`R${Number(deal.paid_amount).toLocaleString()}`} highlight />}
            {deal.farmer_rating != null && <DataPill label="Your rating" value={`${deal.farmer_rating}/5`} />}
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2">
            <span style={{
              padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 500,
              background: deal.logistics_status === "arranged" ? "hsla(130, 40%, 48%, 0.08)" : "hsla(40, 70%, 50%, 0.08)",
              color: deal.logistics_status === "arranged" ? "hsl(130, 35%, 42%)" : "hsl(40, 60%, 40%)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Truck size={11} /> {deal.logistics_status?.toUpperCase()}
            </span>
            <div className="flex gap-2">
              {deal.logistics_status === "pending" && permissions.allow_logistics && (
                <button onClick={() => arrangeLogi(deal.id)} style={btnOutline}>Arrange</button>
              )}
              {!isPaid && (
                <button onClick={() => setOpenPay(openPay === deal.id ? null : deal.id)} style={btnOutline}>
                  <CircleDollarSign size={11} /> {openPay === deal.id ? "Close" : "Mark Paid"}
                </button>
              )}
              {isPaid && !isRated && (
                <button onClick={() => setOpenRate(openRate === deal.id ? null : deal.id)} style={btnOutline}>
                  <Heart size={11} /> {openRate === deal.id ? "Close" : "Rate"}
                </button>
              )}
            </div>
          </div>
          {openPay === deal.id && (
            <PaymentForm deal={deal} onSubmit={(amt, ref, method) => { markPaid(deal.id, amt, ref, method); setOpenPay(null); }} />
          )}
          {openRate === deal.id && (
            <RatingForm onSubmit={(r, n) => { rateDeal(deal.id, r, n); setOpenRate(null); }} />
          )}
        </GlassPanel>
      ); }))}
    </div>
  );
};

// ── Buyers Marketplace ───────────────────────────────────

export const BuyersContent = ({ crew }: { crew: ReturnType<typeof useAgentCrew> }) => {
  const { buyers } = crew;
  if (buyers.length === 0) {
    return (
      <div className="flex flex-col items-center" style={{ padding: "30px 20px", textAlign: "center" }}>
        <Network size={28} style={{ color: "hsl(0,0%,70%)", marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: "hsl(0,0%,50%)", margin: 0 }}>No verified buyers yet.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3" style={{ padding: "0 4px" }}>
      <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", margin: "0 0 4px" }}>{buyers.length} active buyers in marketplace. Negotiator picks from this pool.</p>
      {buyers.map(b => (
        <GlassPanel key={b.id} title={`${b.name}${b.verified ? " ✓" : ""}`}>
          <div className="grid grid-cols-2 gap-2">
            <DataPill label="Type" value={b.buyer_type} />
            <DataPill label="Region" value={`${b.city || "—"}, ${b.region || "—"}`} />
            <DataPill label="Price range" value={`R${b.min_price_per_kg}-R${b.max_price_per_kg}/kg`} highlight />
            <DataPill label="Payment" value={b.payment_terms || "—"} />
            <DataPill label="Crops" value={b.crops.slice(0, 3).join(", ")} />
            <DataPill label="Reliability" value={`${Math.round(b.reliability_score * 100)}%`} />
          </div>
          {b.contact_phone && (
            <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", margin: "8px 0 0" }}>{b.contact_phone}</p>
          )}
        </GlassPanel>
      ))}
    </div>
  );
};

// ── Learning / Outcomes ──────────────────────────────────

export const LearningContent = ({ crew }: { crew: ReturnType<typeof useAgentCrew> }) => {
  const { stats } = crew;
  if (stats.length === 0) {
    return (
      <div className="flex flex-col items-center" style={{ padding: "30px 20px", textAlign: "center" }}>
        <Activity size={28} style={{ color: "hsl(0,0%,70%)", marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: "hsl(0,0%,50%)", margin: 0 }}>
          No closed deals yet. Once you mark deals paid and rate them, the orchestrator personalizes future confidence scores.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3" style={{ padding: "0 4px" }}>
      <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", margin: "0 0 4px" }}>The orchestrator blends these stats into its confidence on every analysis.</p>
      {stats.map(s => (
        <GlassPanel key={s.crop} title={s.crop}>
          <div className="grid grid-cols-2 gap-2">
            <DataPill label="Closed" value={`${s.deals_closed}`} />
            <DataPill label="Win rate" value={s.deals_closed ? `${Math.round((s.deals_won / s.deals_closed) * 100)}%` : "—"} />
            {s.avg_achieved_price != null && <DataPill label="Avg achieved" value={`R${Number(s.avg_achieved_price).toFixed(2)}/kg`} highlight />}
            {s.avg_predicted_price != null && <DataPill label="Avg predicted" value={`R${Number(s.avg_predicted_price).toFixed(2)}/kg`} />}
            {s.avg_rating != null && <DataPill label="Avg rating" value={`${Number(s.avg_rating).toFixed(1)}/5`} />}
            {s.prediction_accuracy != null && <DataPill label="Prediction accuracy" value={`${Math.round(Number(s.prediction_accuracy) * 100)}%`} />}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
};

// ── GeoAI Content ────────────────────────────────────────

interface GeoAIContentProps {
  onFarmArea?: (a: number) => void;
  onFarmNDVI?: (d: NDVIData) => void;
  geoData: any;
  setGeoData: (d: any) => void;
}

export const GeoAIContent = ({ onFarmArea, onFarmNDVI, geoData, setGeoData }: GeoAIContentProps) => {
  const [geoLoading, setGeoLoading] = useState(false);
  const [showRehab, setShowRehab] = useState(false);

  const fetchRealData = async (lat: number, lng: number) => {
    setGeoLoading(true);
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
      if (data.success) setGeoData({ ...data, lat, lng });
      else setGeoData({ fallback: true, lat, lng });
    } catch (e) {
      console.error("geo-intelligence error:", e);
      setGeoData({ fallback: true, lat, lng });
    }
    setGeoLoading(false);
  };

  useEffect(() => {
    if (!geoData) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => fetchRealData(pos.coords.latitude, pos.coords.longitude),
          () => fetchRealData(-26.2, 28.05),
          { timeout: 5000 }
        );
      } else {
        fetchRealData(-26.2, 28.05);
      }
    }
  }, []);

  if (geoLoading || !geoData) {
    return (
      <div className="flex flex-col items-center" style={{ padding: "40px 20px" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "hsl(130, 35%, 48%)", marginBottom: 12 }} />
        <p style={{ fontSize: 13, color: "hsl(0,0%,50%)" }}>Fetching satellite data...</p>
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
    <div className="flex flex-col gap-3" style={{ padding: "0 4px" }}>
      {/* Map */}
      <GlassPanel title="Your Farm Boundary" accent>
        <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", margin: "0 0 8px", lineHeight: 1.4 }}>
          Mark your farm boundary, then toggle NDVI overlay.
        </p>
        <FarmBoundaryMap
          center={[geoData.lat, geoData.lng]}
          ndviValue={ndvi.estimated}
          onBoundaryChange={(pts, area) => { onFarmArea?.(area); }}
          onNDVIData={(ndviData) => { onFarmNDVI?.(ndviData); }}
        />
      </GlassPanel>

      {/* Coordinates */}
      <div className="flex items-center gap-2 flex-wrap" style={{ padding: "0 4px" }}>
        <MapPin size={12} style={{ color: "hsl(130, 40%, 45%)" }} />
        <span style={{ fontSize: 11, color: "hsl(0,0%,45%)" }}>{geoData.lat.toFixed(4)}, {geoData.lng.toFixed(4)}</span>
        <button onClick={() => { setGeoData(null); }} style={{ ...btnOutline, padding: "4px 10px", fontSize: 10, marginLeft: "auto" }}>Refresh</button>
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
              background: "hsla(0,0%,100%,0.9)",
              display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
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
            <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", margin: 0 }}>NDVI: {ndvi.estimated ?? "—"} <span style={{ fontSize: 9, color: "hsl(0,0%,65%)" }}>(modeled estimate)</span></p>
            <p style={{ fontSize: 9, color: "hsl(0,0%,60%)", margin: "2px 0 0", lineHeight: 1.3 }}>
              Toggle NDVI Satellite on map for real satellite imagery
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Climate */}
      <GlassPanel title="Climate Data (30-day)">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <MiniMetric label="Max Temp" value={climate.avgTempMax != null ? `${climate.avgTempMax}°C` : "—"} color="hsl(0, 55%, 55%)" />
          <MiniMetric label="Min Temp" value={climate.avgTempMin != null ? `${climate.avgTempMin}°C` : "—"} color="hsl(200, 55%, 50%)" />
          <MiniMetric label="Rain" value={climate.totalPrecipitation30d != null ? `${climate.totalPrecipitation30d}mm` : "—"} color="hsl(200, 60%, 48%)" />
        </div>
      </GlassPanel>

      {/* Soil Moisture */}
      <GlassPanel title="Soil Moisture">
        <div className="flex items-center gap-3 mb-3">
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "hsla(200, 55%, 50%, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Droplets size={22} style={{ color: "hsl(200, 55%, 50%)" }} />
          </div>
          <div>
            <span style={{ fontSize: 28, fontWeight: 800, color: "hsl(200, 55%, 50%)" }}>{soil.moistureRealtime ?? soil.moisture30dAvg ?? "—"}%</span>
            <p style={{ fontSize: 10, color: "hsl(0,0%,50%)", margin: 0 }}>Soil temp: {soil.soilTemp != null ? `${soil.soilTemp}°C` : "—"}</p>
          </div>
        </div>
      </GlassPanel>

      {/* Smart Irrigation */}
      <GlassPanel title="Smart Irrigation">
        <div style={{
          padding: 12, borderRadius: 14,
          background: irrigation.recommendedLiters <= 0.5 ? "hsla(130, 40%, 48%, 0.06)" : "hsla(45, 70%, 50%, 0.06)",
          border: `1px solid ${irrigation.recommendedLiters <= 0.5 ? "hsla(130, 40%, 48%, 0.12)" : "hsla(45, 70%, 50%, 0.12)"}`,
          marginBottom: 10,
        }}>
          <div className="flex items-center gap-2 mb-1">
            {irrigation.recommendedLiters <= 0.5 ? <CheckCircle2 size={14} style={{ color: "hsl(130, 40%, 45%)" }} /> : <CloudRain size={14} style={{ color: "hsl(45, 65%, 48%)" }} />}
            <span style={{ fontSize: 14, fontWeight: 700, color: "hsl(0,0%,18%)" }}>{irrigation.advice || "—"}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Deficit" value={irrigation.waterDeficitMM != null ? `${irrigation.waterDeficitMM}mm` : "—"} color="hsl(200, 55%, 50%)" />
          <MiniMetric label="ET₀" value={irrigation.et0Today != null ? `${irrigation.et0Today}mm` : "—"} color="hsl(45, 65%, 48%)" />
          <MiniMetric label="Efficiency" value={irrigation.efficiency != null ? `${irrigation.efficiency}%` : "—"} color="hsl(130, 40%, 45%)" />
        </div>
      </GlassPanel>

      {/* Best Crops */}
      <GlassPanel title="Best Crops for Your Area">
        {crops.map((crop: any, i: number) => (
          <div key={crop.name} style={{ padding: "10px 0", borderBottom: i < crops.length - 1 ? "1px solid hsla(0,0%,0%,0.04)" : "none" }}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <Sprout size={13} style={{ color: "hsl(130, 40%, 45%)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "hsl(0,0%,18%)" }}>{crop.name}</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8,
                background: crop.suitability >= 75 ? "hsla(130, 40%, 48%, 0.1)" : "hsla(45, 65%, 50%, 0.1)",
                color: crop.suitability >= 75 ? "hsl(130, 35%, 40%)" : "hsl(45, 55%, 38%)",
              }}>{crop.suitability}% match</span>
            </div>
            <div className="flex gap-4" style={{ paddingLeft: 21 }}>
              <div>
                <span style={{ fontSize: 9, color: "hsl(0,0%,55%)", textTransform: "uppercase", fontWeight: 600 }}>Yield</span>
                <p style={{ fontSize: 12, fontWeight: 600, color: "hsl(0,0%,30%)", margin: 0 }}>{crop.estimatedYield}</p>
              </div>
              <div>
                <span style={{ fontSize: 9, color: "hsl(0,0%,55%)", textTransform: "uppercase", fontWeight: 600 }}>Temp</span>
                <p style={{ fontSize: 12, fontWeight: 500, color: "hsl(0,0%,30%)", margin: 0 }}>{crop.tempScore}%</p>
              </div>
            </div>
          </div>
        ))}
      </GlassPanel>

      {/* Land Rehab */}
      <GlassPanel title="Land Assessment">
        <div className="flex items-center gap-3 mb-3">
          <Leaf size={22} style={{
            color: rehab.degradationRisk === "high" ? "hsl(0, 55%, 50%)" : rehab.degradationRisk === "moderate" ? "hsl(45, 60%, 45%)" : "hsl(130, 40%, 45%)",
          }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{rehab.ndviClass || "—"}</p>
            <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", margin: "2px 0 0" }}>
              Risk: <span style={{ fontWeight: 700, color: rehab.degradationRisk === "high" ? "hsl(0, 55%, 50%)" : "hsl(130, 40%, 45%)" }}>{(rehab.degradationRisk || "—").toUpperCase()}</span>
            </p>
          </div>
        </div>
        <button onClick={() => setShowRehab(!showRehab)} style={{ ...btnOutline, width: "100%", justifyContent: "center" }}>
          {showRehab ? "Hide" : "Show"} Recommendations
        </button>
        {showRehab && rehab.recommendations?.map((r: string, i: number) => (
          <div key={i} className="flex gap-2" style={{ padding: "6px 0", borderBottom: "1px solid hsla(0,0%,0%,0.04)" }}>
            <CheckCircle2 size={12} style={{ color: "hsl(130, 40%, 45%)", marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "hsl(0,0%,35%)", lineHeight: 1.4 }}>{r}</span>
          </div>
        ))}
      </GlassPanel>
    </div>
  );
};
