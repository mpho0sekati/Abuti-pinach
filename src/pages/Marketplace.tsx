import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, MapPin, Filter, Package, ShoppingBasket, WifiOff } from "lucide-react";
import { setCache, getCache } from "@/utils/offlineCache";
import { TrustBadges } from "@/components/TrustBadges";
import DailyMarketPrices from "@/components/DailyMarketPrices";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

type Listing = {
  id: string; seller_id: string; title: string; description: string | null;
  category: string; price: number; unit: string | null; quantity: number | null;
  photo_url: string | null; lat: number | null; lng: number | null; status: string;
  created_at: string;
};
type SellerInfo = { id: string; display_name: string | null; town: string | null; province: string | null };

const CATEGORIES = ["all", "produce", "livestock", "inputs", "equipment", "other"] as const;

const distance = (a: { lat: number; lng: number }, b: { lat: number | null; lng: number | null }) => {
  if (b.lat == null || b.lng == null) return null;
  const R = 6371;
  const toR = (d: number) => d * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
};

const Marketplace = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [sellers, setSellers] = useState<Record<string, SellerInfo>>({});
  const [category, setCategory] = useState<string>("all");
  const [radius, setRadius] = useState(80);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const isOffline = !navigator.onLine;

      if (isOffline) {
        const cached = await getCache("listings", "all_active");
        if (cached) {
          setListings(cached.listings);
          setSellers(cached.sellers);
          setLoading(false);
          return;
        }
      }

      try {
        const { data } = await supabase.from("listings").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(100);
        const ls = (data as Listing[]) ?? [];
        setListings(ls);
        const ids = [...new Set(ls.map(l => l.seller_id))];
        let sellerMap: Record<string, SellerInfo> = {};
        if (ids.length) {
          const { data: sd } = await supabase.from("profiles").select("id,display_name,town,province").in("id", ids);
          (sd ?? []).forEach((s: any) => { sellerMap[s.id] = s; });
          setSellers(sellerMap);
        }
        // Cache the result
        setCache("listings", "all_active", { listings: ls, sellers: sellerMap });
      } catch (e) {
        const cached = await getCache("listings", "all_active");
        if (cached) {
          setListings(cached.listings);
          setSellers(cached.sellers);
        }
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let out = listings;
    if (category !== "all") out = out.filter(l => l.category === category);
    if (profile?.lat && profile?.lng) {
      out = out.map(l => ({ l, d: distance({ lat: profile.lat!, lng: profile.lng! }, l) }))
        .filter(x => x.d == null || x.d <= radius)
        .sort((a, b) => (a.d ?? 9999) - (b.d ?? 9999))
        .map(x => x.l);
    }
    return out;
  }, [listings, category, radius, profile]);

  return (
    <div className="min-h-dvh" style={{ fontFamily: FONT, background: "hsl(90, 25%, 97%)" }}>
      <Helmet>
        <title>Marketplace — verified South African farmers &amp; sellers | Abuti Spinach</title>
        <meta name="description" content="Browse fresh produce, livestock and farm inputs from verified South African farmers and sellers near you. Live Joburg Market reference prices and in-app offers." />
        <link rel="canonical" href="https://abutispinach.com/marketplace" />
        <meta property="og:title" content="Marketplace — verified South African farmers &amp; sellers" />
        <meta property="og:description" content="Verified farmers and sellers within 80km. Live Joburg Market reference prices." />
        <meta property="og:url" content="https://abutispinach.com/marketplace" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": "Abuti Spinach Marketplace",
          "url": "https://abutispinach.com/marketplace",
          "description": "Verified South African farmer and seller marketplace with live Joburg Market prices.",
          "isPartOf": { "@type": "WebSite", "name": "Abuti Spinach", "url": "https://abutispinach.com" }
        })}</script>
      </Helmet>
      <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
        {/* Header */}
        <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{
          background: "linear-gradient(180deg, hsla(90, 25%, 97%, 0.95), hsla(90, 25%, 97%, 0.85))",
          backdropFilter: "blur(14px)",
        }}>
          <div className="flex items-center justify-between">
            <button onClick={() => navigate("/")} className="p-2 rounded-full" style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.2)" }}>
              <ArrowLeft size={18} color="hsl(130, 30%, 30%)" />
            </button>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "hsl(130, 30%, 22%)" }}>Marketplace</h1>
            <div className="flex items-center gap-2">
              {!navigator.onLine && <WifiOff size={16} color="hsl(0, 50%, 50%)" />}
              <Link to="/seller" className="p-2 rounded-full" style={{ background: "hsl(130, 55%, 38%)", display: "inline-flex" }}>
                <Plus size={18} color="white" />
              </Link>
            </div>
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap"
                style={{
                  background: category === c ? "hsl(130, 50%, 38%)" : "white",
                  color: category === c ? "white" : "hsl(130, 30%, 30%)",
                  border: "1px solid hsla(130, 20%, 60%, 0.25)",
                }}>{c}</button>
            ))}
          </div>

          {profile?.lat && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl" style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.2)" }}>
              <Filter size={13} color="hsl(130, 30%, 40%)" />
              <span style={{ fontSize: 12, color: "hsl(130, 25%, 35%)" }}>Within {radius} km</span>
              <input type="range" min={10} max={300} step={10} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))} className="flex-1" />
            </div>
          )}
        </div>

        <div className="px-4 pb-24 pt-2">
          <DailyMarketPrices />

          {loading && <div className="text-center py-8" style={{ color: "hsl(130, 18%, 45%)" }}>Loading listings…</div>}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12">
              <Package size={36} color="hsl(130, 20%, 60%)" className="mx-auto mb-3" />
              <p style={{ color: "hsl(130, 18%, 45%)", fontSize: 14 }}>No listings nearby yet.</p>
              <Link to="/seller" style={{ color: "hsl(130, 55%, 35%)", fontWeight: 600, fontSize: 13 }}>Post the first one →</Link>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(l => {
              const seller = sellers[l.seller_id];
              const d = profile?.lat && profile?.lng ? distance({ lat: profile.lat, lng: profile.lng }, l) : null;
              return (
                <Link key={l.id} to={`/listing/${l.id}`} className="block rounded-2xl overflow-hidden"
                  style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.18)", boxShadow: "0 4px 14px hsla(130, 20%, 30%, 0.05)" }}>
                  <div style={{
                    aspectRatio: "1.1", background: l.photo_url
                      ? `url(${l.photo_url}) center/cover`
                      : "linear-gradient(135deg, hsl(130, 30%, 85%), hsl(130, 40%, 75%))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                  }}>
                    {!l.photo_url && <ShoppingBasket size={28} color="hsl(130, 35%, 50%)" />}
                  </div>
                  <div className="p-2.5">
                    <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(130, 30%, 22%)", lineHeight: 1.2 }} className="truncate">{l.title}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(130, 55%, 32%)", marginTop: 2 }}>R {l.price}/{l.unit ?? "kg"}</div>
                    <div className="flex items-center gap-1 mt-1" style={{ fontSize: 10, color: "hsl(130, 15%, 50%)" }}>
                      <MapPin size={10} />
                      <span className="truncate">{d != null ? `${d} km` : seller?.town || seller?.province || "—"}</span>
                    </div>
                    {seller?.display_name && (
                      <div className="truncate mt-1" style={{ fontSize: 10, color: "hsl(130, 22%, 35%)", fontWeight: 600 }}>
                        {seller.display_name}
                      </div>
                    )}
                    <div className="mt-1">
                      <TrustBadges sellerId={l.seller_id} size="sm" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
