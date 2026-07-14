import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Send, ShoppingBasket, HandCoins } from "lucide-react";
import OfferThread from "@/components/OfferThread";
import { useTrustSignals } from "@/hooks/useTrustSignals";
import { TrustBadges } from "@/components/TrustBadges";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

const distance = (lat1: number, lon1: number, lat2: number | null, lon2: number | null) => {
  if (lat2 == null || lon2 == null) return null;
  const R = 6371;
  const toR = (d: number) => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const ListingPage = () => {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [myOffer, setMyOffer] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [medianPrice, setMedianPrice] = useState<number | null>(null);

  const load = async () => {
    if (!id) return;
    const { data: l } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
    setListing(l);
    if (l) {
      const { data: s } = await supabase.from("profiles").select("*").eq("id", l.seller_id).maybeSingle();
      setSeller(s);
      if (user) {
        const { data: o } = await supabase.from("offers").select("*").eq("listing_id", id).eq("buyer_id", user.id).maybeSingle();
        setMyOffer(o);
      }
    }
  };

  useEffect(() => { load(); }, [id, user?.id]);

  useEffect(() => {
    if (listing) {
      (async () => {
        const { data } = await supabase
          .from("listings")
          .select("price, lat, lng")
          .eq("category", listing.category)
          .eq("status", "active")
          .neq("id", listing.id)
          .limit(100);

        if (data && data.length > 0) {
          let nearbyPrices = data;
          if (listing.lat != null && listing.lng != null) {
            nearbyPrices = data.filter(l => {
              const d = distance(listing.lat, listing.lng, l.lat, l.lng);
              return d !== null && d <= 80;
            });
          }

          if (nearbyPrices.length > 0) {
            const prices = nearbyPrices.map(l => l.price).sort((a, b) => a - b);
            const mid = Math.floor(prices.length / 2);
            const median = prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
            setMedianPrice(median);
          }
        }
      })();
    }
  }, [listing]);

  const submitOffer = async () => {
    if (!user || !listing) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid offer amount"); return; }

    // Client-side rate limiting: check localStorage for offers today
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const limitKey = `offers_sent_${user.id}_${listing.id}`;
    const sentData = JSON.parse(localStorage.getItem(limitKey) || '{"date":"","count":0}');

    if (sentData.date === today && sentData.count >= 3) {
      toast.error("Limit reached: 3 offers per day for this listing.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.from("offers").insert({
      listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id,
      amount: amt, message: message || null, status: "pending",
    }).select().maybeSingle();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setMyOffer(data);
    setAmount(""); setMessage("");

    // Update rate limit count
    const newCount = sentData.date === today ? sentData.count + 1 : 1;
    localStorage.setItem(limitKey, JSON.stringify({ date: today, count: newCount }));

    toast.success("Offer sent");
  };

  const { data: trust } = useTrustSignals(listing?.seller_id);

  if (!listing) {
    return <div className="min-h-dvh flex items-center justify-center" style={{ fontFamily: FONT, color: "hsl(130, 25%, 35%)" }}>Loading…</div>;
  }

  const isOwner = user?.id === listing.seller_id;

  return (
    <div className="min-h-dvh" style={{ fontFamily: FONT, background: "hsl(90, 25%, 97%)" }}>
      <Helmet>
        <title>{`${listing.title} — R${listing.price}/${listing.unit ?? "kg"} | Abuti Spinach`}</title>
        <meta name="description" content={`${listing.title} from a${trust?.isVerified ? " verified" : ""} ${listing.category} seller${seller?.town ? ` in ${seller.town}` : ""}. R${listing.price} per ${listing.unit ?? "kg"}. Make an offer on Abuti Spinach.`} />
        <link rel="canonical" href={`https://abutispinach.com/listing/${listing.id}`} />
        <meta property="og:title" content={`${listing.title} — R${listing.price}/${listing.unit ?? "kg"}`} />
        <meta property="og:description" content={listing.description ?? `${listing.category} from a South African seller${seller?.town ? ` in ${seller.town}` : ""}.`} />
        <meta property="og:url" content={`https://abutispinach.com/listing/${listing.id}`} />
        {listing.photo_url && <meta property="og:image" content={listing.photo_url} />}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": listing.title,
          "description": listing.description ?? undefined,
          "image": listing.photo_url ?? undefined,
          "category": listing.category,
          "offers": {
            "@type": "Offer",
            "price": Number(listing.price),
            "priceCurrency": "ZAR",
            "availability": listing.status === "active" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "url": `https://abutispinach.com/listing/${listing.id}`,
            "seller": { "@type": "Person", "name": seller?.display_name ?? "Verified seller" }
          },
          ...(trust && trust.ratingCount > 0 && trust.averageRating != null ? {
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": trust.averageRating.toFixed(1),
              "reviewCount": trust.ratingCount
            }
          } : {})
        })}</script>
      </Helmet>
      <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
        <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between" style={{
          background: "hsla(90, 25%, 97%, 0.9)", backdropFilter: "blur(14px)",
        }}>
          <button onClick={() => navigate(-1)} className="p-2 rounded-full" style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.2)" }}>
            <ArrowLeft size={18} color="hsl(130, 30%, 30%)" />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: "hsl(130, 30%, 22%)" }}>Listing</span>
          <div style={{ width: 36 }} />
        </div>

        <div className="px-4 pb-24">
          <div style={{
            aspectRatio: "1.5", borderRadius: 18,
            background: listing.photo_url
              ? `url(${listing.photo_url}) center/cover`
              : "linear-gradient(135deg, hsl(130, 30%, 85%), hsl(130, 40%, 75%))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {!listing.photo_url && <ShoppingBasket size={48} color="hsl(130, 35%, 50%)" />}
          </div>

          <div className="mt-4">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "hsl(130, 30%, 22%)" }}>{listing.title}</h1>
            <div className="flex items-baseline gap-3 mt-1">
              <div style={{ fontSize: 24, fontWeight: 700, color: "hsl(130, 55%, 32%)" }}>
                R {listing.price}/{listing.unit ?? "kg"}
              </div>
              {medianPrice && (
                <div style={{ fontSize: 11, color: "hsl(130, 15%, 50%)", fontWeight: 500 }}>
                  Median (80km): R {medianPrice.toFixed(2)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2" style={{ fontSize: 12, color: "hsl(130, 18%, 45%)" }}>
              <span className="capitalize px-2 py-0.5 rounded-full" style={{ background: "hsl(130, 30%, 92%)", color: "hsl(130, 45%, 28%)", fontWeight: 600 }}>
                {listing.category}
              </span>
              <span>{listing.quantity ?? 1} {listing.unit ?? "kg"} available</span>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "hsl(45, 100%, 92%)", color: "hsl(45, 100%, 25%)", fontWeight: 700, fontSize: 10 }}>
                <HandCoins size={10} />
                COD / ESCROW
              </div>
            </div>
            {listing.description && (
              <p style={{ fontSize: 14, color: "hsl(130, 22%, 30%)", marginTop: 12, lineHeight: 1.5 }}>{listing.description}</p>
            )}
          </div>

          {seller && (
            <div className="mt-4 p-3 rounded-xl" style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.2)" }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(130, 30%, 22%)" }} className="truncate">
                    {seller.display_name ?? "Seller"}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: 11, color: "hsl(130, 18%, 45%)" }}>
                    <MapPin size={10} />{seller.town || seller.province || "—"}
                  </div>
                </div>
                <span className="capitalize px-2 py-1 rounded-full" style={{ background: "hsl(130, 30%, 92%)", color: "hsl(130, 45%, 28%)", fontSize: 10, fontWeight: 600 }}>
                  {seller.primary_role}
                </span>
              </div>
              <div className="mt-2">
                <TrustBadges sellerId={listing.seller_id} />
              </div>
            </div>
          )}

          {!isOwner && !myOffer && (
            <div className="mt-5 p-4 rounded-2xl" style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.2)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "hsl(130, 30%, 22%)" }}>Make an offer</h3>
              {user ? (
                <div className="flex flex-col gap-2 mt-3">
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Your offer (R per ${listing.unit ?? "kg"})`}
                    style={{ padding: "11px 14px", borderRadius: 12, border: "1px solid hsla(130, 20%, 60%, 0.25)", fontSize: 14, fontFamily: FONT, outline: "none" }} />
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional message" rows={2} maxLength={500}
                    style={{ padding: "11px 14px", borderRadius: 12, border: "1px solid hsla(130, 20%, 60%, 0.25)", fontSize: 14, fontFamily: FONT, outline: "none", resize: "none" }} />
                  <button onClick={submitOffer} disabled={busy}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
                    style={{
                      background: "linear-gradient(140deg, hsl(130, 55%, 38%), hsl(140, 50%, 30%))",
                      color: "white", border: "none", cursor: "pointer",
                      boxShadow: "0 6px 18px hsla(130, 55%, 30%, 0.32)",
                    }}>
                    <Send size={14} />Send offer
                  </button>
                </div>
              ) : (
                <div className="mt-3 text-center">
                  <p style={{ fontSize: 13, color: "hsl(130, 18%, 45%)", marginBottom: 12 }}>Sign in to make an offer and chat with the seller.</p>
                  <button onClick={() => navigate("/auth", { state: { from: `/listing/${listing.id}` } })}
                    className="w-full py-3 rounded-xl font-semibold text-sm"
                    style={{ background: "hsl(130, 55%, 38%)", color: "white", border: "none", cursor: "pointer" }}>
                    Sign in
                  </button>
                </div>
              )}
            </div>
          )}

          {myOffer && <OfferThread offer={myOffer} listing={listing} onUpdate={load} />}
          {isOwner && (
            <Link to="/seller" className="block text-center mt-5 py-3 rounded-xl font-semibold text-sm"
              style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.25)", color: "hsl(130, 30%, 22%)" }}>
              Manage in seller dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingPage;
