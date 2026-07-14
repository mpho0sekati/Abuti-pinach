import { useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, Phone, MessageCircle, Send, RefreshCw, TrendingUp, TrendingDown, Minus, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Buyer {
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

interface MarketPrice {
  crop: string;
  price_min: number | null;
  price_max: number | null;
  unit: string;
  source: string;
  date: string;
}

interface Props {
  farmerName: string;
  buyers: Buyer[];
}

const STORAGE = "market_link_cache_v1";

export default function MarketLink({ farmerName, buyers }: Props) {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [lang, setLang] = useState<"en" | "zu">(() => (localStorage.getItem("orb_lang") === "zu" ? "zu" : "en"));

  const refresh = useCallback(async (silent = false) => {
    setLoading(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/market-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (j.success && j.prices) {
        setPrices(j.prices);
        setScrapedAt(j.scraped_at);
        localStorage.setItem(STORAGE, JSON.stringify({ prices: j.prices, scraped_at: j.scraped_at, ts: Date.now() }));
        if (!silent) toast.success(`Live prices refreshed — ${j.prices.length} crops`);
      } else if (!silent) {
        toast.error("Could not refresh live prices");
      }
    } catch {
      if (!silent) toast.error("Network error fetching live prices");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE);
    if (cached) {
      try {
        const { prices: p, scraped_at, ts } = JSON.parse(cached);
        setPrices(p || []);
        setScrapedAt(scraped_at);
        const stale = Date.now() - (ts || 0) > 1000 * 60 * 60 * 3; // 3h
        if (stale) refresh(true);
        return;
      } catch { /* fall through */ }
    }
    refresh(true);
  }, [refresh]);

  // Match each market crop to best buyers
  const rows = useMemo(() => {
    return prices.map(p => {
      const cl = p.crop.toLowerCase();
      const matched = buyers
        .filter(b => b.crops.some(c => c.toLowerCase().includes(cl) || cl.includes(c.toLowerCase())))
        .sort((a, b) => (b.max_price_per_kg ?? 0) * b.reliability_score - (a.max_price_per_kg ?? 0) * a.reliability_score)
        .slice(0, 3);
      const avgMarket = p.price_min && p.price_max ? (p.price_min + p.price_max) / 2 : (p.price_min || p.price_max || null);
      return { price: p, avgMarket, matched };
    }).sort((a, b) => b.matched.length - a.matched.length);
  }, [prices, buyers]);

  const cleanPhone = (p: string) => p.replace(/[^\d+]/g, "");

  const draftAndOpen = async (buyer: Buyer, crop: string, askingPrice: number, marketPrice: number | null, channel: "wa" | "sms" | "call") => {
    if (!buyer.contact_phone) { toast.error("No phone for this buyer"); return; }
    const phone = cleanPhone(buyer.contact_phone);
    if (channel === "call") {
      window.location.href = `tel:${phone}`;
      return;
    }
    setDrafting(buyer.id + crop + channel);
    let message = `Hi ${buyer.name}, this is ${farmerName}. I have 100kg of fresh ${crop} at R${askingPrice}/kg. Reply YES to confirm or call back. Thanks.`;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/agent-negotiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({
          action: "draft_offer", farmer_name: farmerName, crop, quantity_kg: 100,
          buyer_name: buyer.name, buyer_type: buyer.buyer_type, region: buyer.region,
          price_per_kg: askingPrice, market_price: marketPrice, language: lang,
        }),
      });
      const j = await r.json();
      if (j.success && j.message) message = j.message;
    } catch { /* fallback used */ }
    setDrafting(null);

    const encoded = encodeURIComponent(message);
    if (channel === "wa") {
      window.open(`https://wa.me/${phone.replace(/^\+/, "")}?text=${encoded}`, "_blank", "noopener");
    } else {
      window.location.href = `sms:${phone}?body=${encoded}`;
    }
    toast.success(`Offer drafted for ${buyer.name}`);
  };

  return (
    <div className="flex flex-col gap-3" style={{ padding: "0 4px", fontFamily: FONT }}>
      <div className="flex items-center justify-between" style={{ padding: "2px 4px" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(0,0%,18%)" }}>Live SA market → buyers</div>
          <div style={{ fontSize: 10, color: "hsl(0,0%,50%)", marginTop: 2 }}>
            {scrapedAt ? `Updated ${new Date(scrapedAt).toLocaleTimeString()}` : "No data yet"} · One-tap reach buyers
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setLang(l => { const n = l === "en" ? "zu" : "en"; localStorage.setItem("orb_lang", n); return n; })}
            style={pillBtn}>{lang === "en" ? "EN" : "ZU"}</button>
          <button onClick={() => refresh(false)} disabled={loading} style={pillBtn} aria-label="refresh">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
        </div>
      </div>

      {prices.length === 0 && !loading && (
        <div style={{ padding: "30px 20px", textAlign: "center", fontSize: 12, color: "hsl(0,0%,50%)" }}>
          No live prices yet. Tap refresh to scrape SA fresh produce markets.
        </div>
      )}

      {rows.map(({ price, avgMarket, matched }) => (
        <div key={price.crop} style={card}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(0,0%,15%)" }}>{price.crop}</div>
              <div style={{ fontSize: 10, color: "hsl(0,0%,52%)" }}>{price.source}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(130,35%,35%)" }}>
                R{price.price_min?.toFixed(2)}{price.price_max && price.price_max !== price.price_min ? `–${price.price_max.toFixed(2)}` : ""}
              </div>
              <div style={{ fontSize: 10, color: "hsl(0,0%,55%)" }}>per {price.unit}</div>
            </div>
          </div>

          {matched.length === 0 ? (
            <div style={{ fontSize: 11, color: "hsl(0,0%,55%)", padding: "6px 0" }}>
              No matched buyers in your marketplace yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {matched.map(b => {
                const ask = avgMarket ? Math.max(avgMarket * 1.05, b.min_price_per_kg || 0) : (b.max_price_per_kg || b.min_price_per_kg || 0);
                const askR = Number(ask.toFixed(2));
                const trend = avgMarket && b.max_price_per_kg ? (b.max_price_per_kg > avgMarket ? "up" : b.max_price_per_kg < avgMarket ? "down" : "flat") : "flat";
                const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
                const trendColor = trend === "up" ? "hsl(130,40%,38%)" : trend === "down" ? "hsl(0,55%,50%)" : "hsl(40,50%,40%)";
                const busy = drafting?.startsWith(b.id + price.crop);
                return (
                  <div key={b.id} style={buyerRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: "hsl(0,0%,18%)" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                        {b.verified && <ShieldCheck size={11} style={{ color: "hsl(130,40%,40%)", flexShrink: 0 }} />}
                      </div>
                      <div className="flex items-center gap-2" style={{ fontSize: 10, color: "hsl(0,0%,50%)", marginTop: 2 }}>
                        <span className="flex items-center gap-0.5"><MapPin size={9} />{b.city || b.region || "SA"}</span>
                        <span className="flex items-center gap-0.5" style={{ color: trendColor, fontWeight: 600 }}>
                          <TrendIcon size={9} />R{askR}/kg
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button disabled={!b.contact_phone || !!busy} onClick={() => draftAndOpen(b, price.crop, askR, avgMarket, "wa")}
                        style={iconBtn("hsl(142,70%,45%)")} title="WhatsApp offer">
                        {busy && drafting?.endsWith("wa") ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
                      </button>
                      <button disabled={!b.contact_phone || !!busy} onClick={() => draftAndOpen(b, price.crop, askR, avgMarket, "sms")}
                        style={iconBtn("hsl(210,80%,50%)")} title="SMS offer">
                        {busy && drafting?.endsWith("sms") ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      </button>
                      <button disabled={!b.contact_phone} onClick={() => draftAndOpen(b, price.crop, askR, avgMarket, "call")}
                        style={iconBtn("hsl(0,0%,30%)")} title="Call buyer">
                        <Phone size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <div style={{ fontSize: 10, color: "hsl(0,0%,55%)", textAlign: "center", padding: "4px 8px 8px" }}>
        AI drafts the offer in your language. You stay in control of the conversation and payment.
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "hsla(0,0%,100%,0.55)",
  backdropFilter: "blur(40px) saturate(1.6)",
  WebkitBackdropFilter: "blur(40px) saturate(1.6)",
  border: "1px solid hsla(0,0%,100%,0.5)",
  borderRadius: 16,
  padding: 12,
  boxShadow: "0 4px 20px hsla(130,20%,30%,0.05)",
};

const buyerRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "8px 10px",
  background: "hsla(0,0%,100%,0.5)",
  borderRadius: 12,
  border: "1px solid hsla(0,0%,0%,0.04)",
};

const pillBtn: React.CSSProperties = {
  padding: "6px 8px", borderRadius: 10, border: "1px solid hsla(0,0%,0%,0.08)",
  background: "white", cursor: "pointer", fontSize: 11, fontWeight: 600,
  color: "hsl(0,0%,30%)", display: "inline-flex", alignItems: "center", gap: 4,
};

const iconBtn = (c: string): React.CSSProperties => ({
  width: 30, height: 30, borderRadius: 10, border: "none", cursor: "pointer",
  background: c, color: "white", display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
});
