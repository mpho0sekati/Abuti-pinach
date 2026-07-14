import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, ExternalLink,
  Search, ArrowUpDown, ChevronDown, ChevronUp, AlertCircle, Clock,
} from "lucide-react";

type Row = { commodity: string; unit: string; low: number | null; high: number | null; avg: number | null };
type Resp = { success: boolean; date?: string; source_url?: string; prices: Row[]; error?: string };

const CACHE_KEY = "joburg_daily_prices_v2";
const HISTORY_KEY = "joburg_daily_prices_history_v1";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

type SortKey = "name" | "avg" | "spread" | "trend";

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function DailyMarketPrices() {
  const [data, setData] = useState<Resp | null>(null);
  const [prev, setPrev] = useState<Record<string, number>>({});
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [asc, setAsc] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = async (force = false) => {
    setError(null);
    if (!force) {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.cachedAt && Date.now() - parsed.cachedAt < CACHE_TTL) {
            setData(parsed.data);
            setCachedAt(parsed.cachedAt);
            hydratePrev(parsed.data);
            return;
          }
        }
      } catch {}
    }
    setLoading(true);
    try {
      const { data: resp, error: fnErr } = await supabase.functions.invoke<Resp>("joburg-market-prices", { body: {} });
      if (fnErr) throw new Error(fnErr.message);
      if (!resp?.success) throw new Error(resp?.error || "Could not fetch prices");
      const ts = Date.now();
      setData(resp);
      setCachedAt(ts);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: ts, data: resp }));
      hydratePrev(resp, true);
    } catch (e: any) {
      setError(e?.message || "Failed to load market prices");
    }
    setLoading(false);
  };

  // Track prior snapshot for trend arrows
  const hydratePrev = (resp: Resp, writeHistory = false) => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const hist = raw ? JSON.parse(raw) : { snapshots: [] as { ts: number; map: Record<string, number> }[] };
      const prevSnap = hist.snapshots[hist.snapshots.length - 2] || hist.snapshots[0];
      if (prevSnap?.map) setPrev(prevSnap.map);

      if (writeHistory) {
        const map: Record<string, number> = {};
        for (const r of resp.prices) if (r.avg != null) map[r.commodity.toLowerCase()] = r.avg;
        hist.snapshots = [...(hist.snapshots || []), { ts: Date.now(), map }].slice(-5);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
      }
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const all = data?.prices ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q ? all.filter(r => r.commodity.toLowerCase().includes(q)) : all;
    const withMeta = filtered.map(r => {
      const p = prev[r.commodity.toLowerCase()];
      const trend = p != null && r.avg != null ? (r.avg - p) / p : null;
      const spread = r.high != null && r.low != null ? r.high - r.low : null;
      return { ...r, trend, spread };
    });
    withMeta.sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sort === "name") { av = a.commodity; bv = b.commodity; }
      else if (sort === "avg") { av = a.avg ?? -1; bv = b.avg ?? -1; }
      else if (sort === "spread") { av = a.spread ?? -1; bv = b.spread ?? -1; }
      else { av = a.trend ?? -Infinity; bv = b.trend ?? -Infinity; }
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return withMeta;
  }, [data, prev, query, sort, asc]);

  const visible = expanded ? rows : rows.slice(0, 8);

  const summary = useMemo(() => {
    if (!rows.length) return null;
    const trends = rows.map(r => r.trend).filter((t): t is number => t != null);
    const up = trends.filter(t => t > 0.01).length;
    const down = trends.filter(t => t < -0.01).length;
    const avgAll = rows.reduce((s, r) => s + (r.avg ?? 0), 0) / rows.length;
    return { up, down, flat: trends.length - up - down, avgAll, count: rows.length };
  }, [rows]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc); else { setSort(key); setAsc(key === "name"); }
  };

  return (
    <section
      className="rounded-2xl p-3.5 mb-3"
      style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.18)", boxShadow: "0 4px 14px hsla(130, 20%, 30%, 0.05)" }}
      aria-label="Daily wholesale prices from Joburg Market"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <TrendingUp size={14} color="#2D7A3A" />
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "hsl(130, 30%, 22%)" }} className="truncate">
            Joburg Market — live wholesale prices
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {cachedAt && (
            <span className="inline-flex items-center gap-1" style={{ fontSize: 10, color: "hsl(130, 18%, 45%)" }}>
              <Clock size={9} /> {relTime(cachedAt)}
            </span>
          )}
          <button
            onClick={() => load(true)} aria-label="Refresh prices" disabled={loading}
            className="p-1.5 rounded-full transition-opacity"
            style={{ background: "hsl(90, 30%, 95%)", opacity: loading ? 0.6 : 1 }}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} color="#2D7A3A" />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          <Chip label={`${summary.count} items`} tone="neutral" />
          <Chip label={`Avg R${summary.avgAll.toFixed(2)}`} tone="brand" />
          {summary.up > 0 && <Chip icon={<TrendingUp size={9} />} label={`${summary.up} up`} tone="up" />}
          {summary.down > 0 && <Chip icon={<TrendingDown size={9} />} label={`${summary.down} down`} tone="down" />}
          {summary.flat > 0 && <Chip icon={<Minus size={9} />} label={`${summary.flat} flat`} tone="neutral" />}
        </div>
      )}

      {/* Search + sort */}
      {(data?.prices?.length ?? 0) > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
               style={{ background: "hsl(90, 30%, 96%)", border: "1px solid hsla(130, 20%, 60%, 0.18)" }}>
            <Search size={11} color="hsl(130, 18%, 45%)" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commodity…"
              style={{ background: "transparent", border: "none", outline: "none", fontSize: 11, width: "100%", color: "hsl(130, 30%, 22%)" }}
            />
          </div>
          <button
            onClick={() => toggleSort(sort)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg"
            style={{ background: "hsl(90, 30%, 96%)", border: "1px solid hsla(130, 20%, 60%, 0.18)", fontSize: 10, fontWeight: 600, color: "hsl(130, 30%, 22%)" }}
            aria-label="Toggle sort direction"
          >
            <ArrowUpDown size={10} /> {sort} {asc ? "↑" : "↓"}
          </button>
        </div>
      )}

      {/* States */}
      {loading && !data && (
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 22, borderRadius: 6, background: "linear-gradient(90deg, hsl(90,20%,94%), hsl(90,20%,97%), hsl(90,20%,94%))", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
          ))}
          <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: "hsl(0, 60%, 97%)", border: "1px solid hsl(0, 40%, 85%)" }}>
          <AlertCircle size={12} color="hsl(0, 60%, 45%)" className="mt-0.5" />
          <div style={{ fontSize: 11, color: "hsl(0, 40%, 30%)" }}>
            {error}. <button onClick={() => load(true)} style={{ textDecoration: "underline", fontWeight: 600 }}>Try again</button>
          </div>
        </div>
      )}
      {!loading && !error && data?.prices?.length === 0 && (
        <p style={{ fontSize: 11, color: "hsl(130, 18%, 45%)" }}>No prices published for today yet. Check back later.</p>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full" style={{ fontSize: 11, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "hsl(130, 18%, 45%)", textAlign: "left" }}>
                  <SortableTh label="Commodity" active={sort === "name"} asc={asc} onClick={() => toggleSort("name")} />
                  <th className="py-1 px-1 font-semibold text-right">Low</th>
                  <SortableTh label="Avg" align="right" active={sort === "avg"} asc={asc} onClick={() => toggleSort("avg")} />
                  <th className="py-1 px-1 font-semibold text-right">High</th>
                  <SortableTh label="Trend" align="right" active={sort === "trend"} asc={asc} onClick={() => toggleSort("trend")} />
                  <th className="py-1 px-1 font-semibold">Unit</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.commodity + i} style={{ borderTop: "1px solid hsla(130,20%,60%,0.14)" }}>
                    <td className="py-1.5 px-1" style={{ fontWeight: 600, color: "hsl(130, 30%, 22%)" }}>{r.commodity}</td>
                    <td className="py-1.5 px-1 text-right" style={{ color: "hsl(130, 18%, 40%)" }}>R{r.low?.toFixed(2) ?? "—"}</td>
                    <td className="py-1.5 px-1 text-right" style={{ fontWeight: 700, color: "#2D7A3A" }}>R{r.avg?.toFixed(2) ?? "—"}</td>
                    <td className="py-1.5 px-1 text-right" style={{ color: "hsl(130, 18%, 40%)" }}>R{r.high?.toFixed(2) ?? "—"}</td>
                    <td className="py-1.5 px-1 text-right">
                      <TrendCell trend={r.trend} />
                    </td>
                    <td className="py-1.5 px-1" style={{ color: "hsl(130, 18%, 45%)" }}>{r.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > 8 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-full mt-2 py-1.5 rounded-lg inline-flex items-center justify-center gap-1"
              style={{ background: "hsl(90, 30%, 96%)", border: "1px solid hsla(130, 20%, 60%, 0.18)", fontSize: 11, fontWeight: 600, color: "hsl(130, 30%, 30%)" }}
            >
              {expanded ? <>Show less <ChevronUp size={12} /></> : <>Show all {rows.length} <ChevronDown size={12} /></>}
            </button>
          )}
        </>
      )}

      {data?.source_url && (
        <a href={data.source_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2.5"
          style={{ fontSize: 10, color: "hsl(130, 25%, 35%)" }}>
          Source: joburgmarket.co.za <ExternalLink size={9} />
        </a>
      )}
      <span className="hidden">{now}</span>
    </section>
  );
}

function SortableTh({ label, align = "left", active, asc, onClick }: { label: string; align?: "left" | "right"; active: boolean; asc: boolean; onClick: () => void }) {
  return (
    <th className={`py-1 px-1 font-semibold text-${align} cursor-pointer select-none`} onClick={onClick}>
      <span style={{ color: active ? "hsl(130, 45%, 30%)" : undefined }}>
        {label}{active ? (asc ? " ↑" : " ↓") : ""}
      </span>
    </th>
  );
}

function TrendCell({ trend }: { trend: number | null }) {
  if (trend == null) return <span style={{ color: "hsl(130, 15%, 65%)" }}>—</span>;
  const pct = (trend * 100);
  if (Math.abs(pct) < 1) {
    return <span className="inline-flex items-center gap-0.5" style={{ color: "hsl(130, 15%, 55%)" }}><Minus size={10} />0%</span>;
  }
  const up = pct > 0;
  return (
    <span className="inline-flex items-center gap-0.5" style={{ color: up ? "hsl(130, 55%, 32%)" : "hsl(0, 60%, 48%)", fontWeight: 600 }}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function Chip({ label, tone, icon }: { label: string; tone: "up" | "down" | "brand" | "neutral"; icon?: React.ReactNode }) {
  const map: Record<string, { bg: string; fg: string }> = {
    up: { bg: "hsl(130, 55%, 94%)", fg: "hsl(130, 55%, 28%)" },
    down: { bg: "hsl(0, 70%, 96%)", fg: "hsl(0, 60%, 40%)" },
    brand: { bg: "hsl(130, 45%, 94%)", fg: "hsl(130, 45%, 26%)" },
    neutral: { bg: "hsl(90, 25%, 94%)", fg: "hsl(130, 18%, 40%)" },
  };
  const c = map[tone];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.fg, fontSize: 10, fontWeight: 600 }}>
      {icon}{label}
    </span>
  );
}
