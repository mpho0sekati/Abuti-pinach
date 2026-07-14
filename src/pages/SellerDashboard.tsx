import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, Plus, Loader2, Package, Inbox, Trash2, Camera } from "lucide-react";
import { compressImage } from "@/utils/compression";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

const SellerDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"listings" | "offers">("listings");
  const [listings, setListings] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  // create form
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<"produce" | "livestock" | "inputs" | "equipment" | "other">("produce");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("kg");
  const [quantity, setQuantity] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: l } = await supabase.from("listings").select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
    setListings(l ?? []);
    const { data: o } = await supabase.from("offers").select("*, listings(title, unit)").eq("seller_id", user.id).order("created_at", { ascending: false });
    setOffers(o ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const createListing = async () => {
    if (!user) return;
    if (!title.trim() || !price) { toast.error("Title and price are required"); return; }
    if (!photoFile) { toast.error("A photo is required for your listing"); return; }

    setBusy(true);
    try {
      let photo_url: string | null = null;

      // Compress image to < 200KB
      const compressedBlob = await compressImage(photoFile, 800, 0.6);
      if (compressedBlob.size > 200 * 1024) {
        // Try even more aggressive compression if still too large
        const smallerBlob = await compressImage(photoFile, 600, 0.4);
        photo_url = await uploadBlob(smallerBlob);
      } else {
        photo_url = await uploadBlob(compressedBlob);
      }

      const { error } = await supabase.from("listings").insert({
        seller_id: user.id, title: title.trim().slice(0, 120), description: desc.trim().slice(0, 1000) || null,
        category, price: Number(price), unit, quantity: quantity ? Number(quantity) : 1,
        photo_url, lat: profile?.lat, lng: profile?.lng, status: "active",
      });
      if (error) throw error;
      toast.success("Listing posted");
      setTitle(""); setDesc(""); setPrice(""); setQuantity(""); setPhotoFile(null); setCreating(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to post");
    } finally {
      setBusy(false);
    }
  };

  const uploadBlob = async (blob: Blob) => {
    const path = `${user!.id}/${Date.now()}-photo.jpg`;
    const { error: upErr } = await supabase.storage.from("listing-photos").upload(path, blob, { contentType: "image/jpeg" });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("listing-photos").getPublicUrl(path);
    return pub.publicUrl;
  };

  const deleteListing = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  return (
    <div className="min-h-dvh" style={{ fontFamily: FONT, background: "hsl(90, 25%, 97%)" }}>
      <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
        <div className="sticky top-0 z-30 px-4 py-3" style={{ background: "hsla(90, 25%, 97%, 0.95)", backdropFilter: "blur(14px)" }}>
          <div className="flex items-center justify-between">
            <button onClick={() => navigate("/")} className="p-2 rounded-full" style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.2)" }}>
              <ArrowLeft size={18} color="hsl(130, 30%, 30%)" />
            </button>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "hsl(130, 30%, 22%)" }}>Seller Dashboard</h1>
            <button onClick={() => setCreating(!creating)} className="p-2 rounded-full" style={{ background: "hsl(130, 55%, 38%)" }}>
              <Plus size={18} color="white" />
            </button>
          </div>

          <div className="flex gap-1 p-1 rounded-xl mt-3" style={{ background: "hsla(130, 20%, 92%, 0.6)" }}>
            {(["listings", "offers"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold capitalize"
                style={{
                  background: tab === t ? "white" : "transparent",
                  color: tab === t ? "hsl(130, 35%, 28%)" : "hsl(130, 15%, 50%)",
                }}>
                {t === "listings" ? <Package size={13} /> : <Inbox size={13} />}{t}
                {t === "offers" && offers.filter(o => o.status === "pending").length > 0 && (
                  <span className="px-1.5 rounded-full" style={{ background: "hsl(0, 75%, 55%)", color: "white", fontSize: 9 }}>
                    {offers.filter(o => o.status === "pending").length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-24 pt-3">
          {creating && (
            <div className="p-4 rounded-2xl mb-4" style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.2)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "hsl(130, 30%, 22%)", marginBottom: 8 }}>New listing</h3>
              <div className="flex flex-col gap-2">
                <Inp v={title} on={setTitle} ph="Title (e.g. Fresh spinach 5kg)" />
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" rows={2} maxLength={1000}
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid hsla(130, 20%, 60%, 0.25)", fontSize: 13, fontFamily: FONT, outline: "none", resize: "none" }} />
                <div className="flex gap-2">
                  <select value={category} onChange={(e) => setCategory(e.target.value as any)}
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid hsla(130, 20%, 60%, 0.25)", fontSize: 13, fontFamily: FONT }}>
                    {["produce", "livestock", "inputs", "equipment", "other"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Inp v={unit} on={setUnit} ph="unit" />
                </div>
                <div className="flex gap-2">
                  <Inp v={price} on={setPrice} ph="Price (R)" type="number" />
                  <Inp v={quantity} on={setQuantity} ph="Qty" type="number" />
                </div>
                <div className="flex flex-col gap-1">
                  <span style={{ fontSize: 11, fontWeight: 600, color: "hsl(130, 25%, 35%)" }}>Photo (Required)</span>
                  <div className="relative">
                    <input type="file" accept="image/*" id="photo-upload" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
                    <label htmlFor="photo-upload" className="flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl cursor-pointer"
                      style={{ borderColor: photoFile ? "hsl(130, 40%, 48%)" : "hsla(130, 20%, 60%, 0.25)", background: photoFile ? "hsla(130, 40%, 48%, 0.05)" : "transparent" }}>
                      <Camera size={18} color={photoFile ? "#2D7A3A" : "#6b7c6b"} />
                      <span style={{ fontSize: 13, color: photoFile ? "#2D7A3A" : "#6b7c6b", fontWeight: photoFile ? 600 : 400 }}>
                        {photoFile ? photoFile.name : "Tap to take or upload a photo"}
                      </span>
                    </label>
                  </div>
                </div>
                <button onClick={createListing} disabled={busy}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm mt-1"
                  style={{ background: "hsl(130, 55%, 38%)", color: "white", border: "none", cursor: "pointer" }}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : "Post listing"}
                </button>
              </div>
            </div>
          )}

          {tab === "listings" && (
            <div className="flex flex-col gap-2">
              {listings.length === 0 && (
                <div className="text-center py-12" style={{ color: "hsl(130, 18%, 45%)", fontSize: 13 }}>
                  No listings yet. Tap + to create one.
                </div>
              )}
              {listings.map(l => (
                <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.2)" }}>
                  <div style={{
                    width: 54, height: 54, borderRadius: 10, flexShrink: 0,
                    background: l.photo_url ? `url(${l.photo_url}) center/cover` : "linear-gradient(135deg, hsl(130, 30%, 85%), hsl(130, 40%, 75%))",
                  }} />
                  <Link to={`/listing/${l.id}`} className="flex-1 min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(130, 30%, 22%)" }} className="truncate">{l.title}</div>
                    <div style={{ fontSize: 12, color: "hsl(130, 55%, 32%)", fontWeight: 700 }}>R {l.price}/{l.unit}</div>
                  </Link>
                  <button onClick={() => deleteListing(l.id)} className="p-2 rounded-lg" style={{ background: "hsla(0, 70%, 50%, 0.1)", border: "none", cursor: "pointer" }}>
                    <Trash2 size={14} color="hsl(0, 70%, 50%)" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "offers" && (
            <div className="flex flex-col gap-2">
              {offers.length === 0 && (
                <div className="text-center py-12" style={{ color: "hsl(130, 18%, 45%)", fontSize: 13 }}>
                  No offers yet.
                </div>
              )}
              {offers.map(o => (
                <Link to={`/listing/${o.listing_id}`} key={o.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.2)" }}>
                  <div className="min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(130, 30%, 22%)" }} className="truncate">{o.listings?.title}</div>
                    <div style={{ fontSize: 11, color: "hsl(130, 18%, 45%)" }}>Offer: R {o.amount}/{o.listings?.unit ?? "kg"}</div>
                  </div>
                  <span className="capitalize px-2 py-1 rounded-full" style={{
                    background: o.status === "pending" ? "hsl(45, 90%, 92%)" : "hsl(130, 30%, 92%)",
                    color: o.status === "pending" ? "hsl(35, 80%, 35%)" : "hsl(130, 45%, 28%)",
                    fontSize: 10, fontWeight: 700,
                  }}>{o.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Inp = ({ v, on, ph, type = "text" }: any) => (
  <input value={v} type={type} onChange={(e) => on(e.target.value)} placeholder={ph}
    style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid hsla(130, 20%, 60%, 0.25)", fontSize: 13, fontFamily: FONT, outline: "none" }} />
);

export default SellerDashboard;
