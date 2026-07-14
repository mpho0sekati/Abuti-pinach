import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MapPin, Tractor, Store, ShoppingBasket, ChevronRight, Loader2, Check } from "lucide-react";
import { z } from "zod";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

type Role = "farmer" | "seller" | "buyer";

const PROVINCES = [
  "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Free State",
  "Mpumalanga", "Limpopo", "North West", "Northern Cape",
];

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role>("farmer");
  const [displayName, setDisplayName] = useState("");
  const [province, setProvince] = useState("");
  const [town, setTown] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  // farmer
  const [crops, setCrops] = useState("");
  const [farmSize, setFarmSize] = useState("");
  const [livestock, setLivestock] = useState("");
  // seller
  const [businessName, setBusinessName] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [deliveryRadius, setDeliveryRadius] = useState(80);
  // buyer
  const [interests, setInterests] = useState("");

  const [saving, setSaving] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) { toast.error("Location not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setLocating(false); toast.success("Location captured"); },
      () => { setLocating(false); toast.error("Couldn't get location — pick province manually"); },
      { timeout: 10000 }
    );
  };

  const toggleCat = (c: string) => setCategories(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);

  const save = async () => {
    if (!user) return;
    const schema = z.object({
      displayName: z.string().trim().min(1).max(80),
      province: z.string().min(1, "Pick a province"),
      town: z.string().trim().max(80).optional(),
    });
    const parsed = schema.safeParse({ displayName, province, town });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }

    setSaving(true);
    try {
      const { error: pErr } = await supabase.from("profiles").update({
        display_name: displayName, primary_role: role, province, town: town || null,
        lat, lng, onboarded: true,
      }).eq("id", user.id);
      if (pErr) throw pErr;

      await supabase.from("user_roles").upsert({ user_id: user.id, role });

      if (role === "farmer") {
        await supabase.from("farmer_details").upsert({
          user_id: user.id,
          crops: crops.split(",").map(s => s.trim()).filter(Boolean),
          farm_size_ha: farmSize ? Number(farmSize) : null,
          livestock: livestock.split(",").map(s => s.trim()).filter(Boolean),
        });
      } else if (role === "seller") {
        await supabase.from("seller_details").upsert({
          user_id: user.id, business_name: businessName,
          categories: categories as any, delivery_radius_km: deliveryRadius,
        });
      } else {
        await supabase.from("farmer_details").upsert({ user_id: user.id, notes: interests });
      }

      await refreshProfile();
      toast.success("Profile ready");
      navigate("/");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh px-5 py-8" style={{
      fontFamily: FONT,
      background: "radial-gradient(ellipse at top, hsl(120, 35%, 92%) 0%, hsl(90, 25%, 97%) 60%)",
    }}>
      <div className="mx-auto w-full" style={{ maxWidth: 480 }}>
        {/* progress */}
        <div className="flex gap-1.5 mb-6">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="flex-1 h-1.5 rounded-full" style={{
              background: n <= step ? "hsl(130, 55%, 42%)" : "hsla(130, 20%, 80%, 0.5)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        <Card>
          {step === 1 && (
            <>
              <H>Who are you?</H>
              <Sub>This shapes everything Abuti shows you.</Sub>
              <div className="flex flex-col gap-2 mt-4">
                <RoleCard active={role === "farmer"} onClick={() => setRole("farmer")} Icon={Tractor} title="Farmer" desc="Grow crops or raise livestock" />
                <RoleCard active={role === "seller"} onClick={() => setRole("seller")} Icon={Store} title="Seller" desc="Sell inputs, equipment, or produce" />
                <RoleCard active={role === "buyer"} onClick={() => setRole("buyer")} Icon={ShoppingBasket} title="Buyer" desc="Buy direct from local farmers" />
              </div>
              <PrimaryBtn onClick={() => setStep(2)}>Continue<ChevronRight size={16} /></PrimaryBtn>
            </>
          )}

          {step === 2 && (
            <>
              <H>Where are you?</H>
              <Sub>Local weather, prices, and listings depend on this.</Sub>
              <div className="flex flex-col gap-3 mt-4">
                <TextField label="Your name" value={displayName} onChange={setDisplayName} placeholder="e.g. Thabo Nkosi" />
                <button onClick={requestLocation} disabled={locating}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    background: lat ? "hsl(130, 50%, 92%)" : "white",
                    border: "1px solid hsla(130, 30%, 50%, 0.3)",
                    color: "hsl(130, 45%, 28%)", cursor: "pointer",
                  }}>
                  {locating ? <Loader2 size={14} className="animate-spin" /> : lat ? <Check size={14} /> : <MapPin size={14} />}
                  {locating ? "Locating…" : lat ? `Got it (${lat.toFixed(2)}, ${lng?.toFixed(2)})` : "Use my GPS"}
                </button>
                <SelectField label="Province" value={province} onChange={setProvince} options={PROVINCES} />
                <TextField label="Town / area (optional)" value={town} onChange={setTown} placeholder="e.g. Polokwane" />
              </div>
              <Row>
                <SecondaryBtn onClick={() => setStep(1)}>Back</SecondaryBtn>
                <PrimaryBtn onClick={() => setStep(3)}>Continue<ChevronRight size={16} /></PrimaryBtn>
              </Row>
            </>
          )}

          {step === 3 && (
            <>
              {role === "farmer" && <>
                <H>Tell us about your farm</H>
                <Sub>Abuti tailors weather, pest, and market advice to this.</Sub>
                <div className="flex flex-col gap-3 mt-4">
                  <TextField label="Crops (comma-separated)" value={crops} onChange={setCrops} placeholder="maize, spinach, tomatoes" />
                  <TextField label="Farm size (hectares)" value={farmSize} onChange={setFarmSize} type="number" placeholder="2.5" />
                  <TextField label="Livestock (comma-separated)" value={livestock} onChange={setLivestock} placeholder="cattle, chickens" />
                </div>
              </>}
              {role === "seller" && <>
                <H>About your business</H>
                <Sub>Buyers see this on your listings.</Sub>
                <div className="flex flex-col gap-3 mt-4">
                  <TextField label="Business name" value={businessName} onChange={setBusinessName} placeholder="e.g. Nkosi Agri Supplies" />
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "hsl(130, 25%, 35%)" }}>What you sell</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["produce", "livestock", "inputs", "equipment", "other"].map(c => (
                        <button key={c} type="button" onClick={() => toggleCat(c)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold capitalize"
                          style={{
                            background: categories.includes(c) ? "hsl(130, 50%, 38%)" : "white",
                            color: categories.includes(c) ? "white" : "hsl(130, 30%, 30%)",
                            border: "1px solid hsla(130, 30%, 50%, 0.3)", cursor: "pointer",
                          }}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "hsl(130, 25%, 35%)" }}>Delivery radius: {deliveryRadius} km</span>
                    <input type="range" min={10} max={300} step={10} value={deliveryRadius}
                      onChange={(e) => setDeliveryRadius(Number(e.target.value))} className="w-full mt-2" />
                  </div>
                </div>
              </>}
              {role === "buyer" && <>
                <H>What are you looking for?</H>
                <Sub>We'll surface matching listings near you.</Sub>
                <TextField label="Interests" value={interests} onChange={setInterests} placeholder="e.g. fresh produce, livestock feed" />
              </>}
              <Row>
                <SecondaryBtn onClick={() => setStep(2)}>Back</SecondaryBtn>
                <PrimaryBtn onClick={() => setStep(4)}>Continue<ChevronRight size={16} /></PrimaryBtn>
              </Row>
            </>
          )}

          {step === 4 && (
            <>
              <H>All set</H>
              <Sub>Review and finish.</Sub>
              <div className="mt-4 p-4 rounded-xl" style={{ background: "hsla(130, 30%, 95%, 0.6)" }}>
                <Line label="Role" value={role} />
                <Line label="Name" value={displayName} />
                <Line label="Province" value={province} />
                {town && <Line label="Town" value={town} />}
                {lat && <Line label="GPS" value={`${lat.toFixed(3)}, ${lng?.toFixed(3)}`} />}
              </div>
              <Row>
                <SecondaryBtn onClick={() => setStep(3)}>Back</SecondaryBtn>
                <PrimaryBtn onClick={save} disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <>Finish<Check size={16} /></>}
                </PrimaryBtn>
              </Row>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: "hsla(0, 0%, 100%, 0.92)", borderRadius: 22, padding: 24,
    boxShadow: "0 18px 48px hsla(130, 30%, 25%, 0.12), inset 0 0 0 1px hsla(0, 0%, 100%, 0.8)",
  }}>{children}</div>
);
const H = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 20, fontWeight: 700, color: "hsl(130, 30%, 22%)", margin: 0 }}>{children}</h2>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 13, color: "hsl(130, 18%, 45%)", marginTop: 4, marginBottom: 0 }}>{children}</p>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 mt-5">{children}</div>
);
const PrimaryBtn = ({ children, onClick, disabled }: any) => (
  <button onClick={onClick} disabled={disabled}
    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl font-semibold text-sm"
    style={{
      background: "linear-gradient(140deg, hsl(130, 55%, 38%), hsl(140, 50%, 30%))",
      color: "white", border: "none", cursor: disabled ? "wait" : "pointer",
      boxShadow: "0 6px 18px hsla(130, 55%, 30%, 0.32)", opacity: disabled ? 0.7 : 1,
    }}>{children}</button>
);
const SecondaryBtn = ({ children, onClick }: any) => (
  <button onClick={onClick}
    className="px-5 py-3 rounded-xl font-semibold text-sm"
    style={{ background: "white", color: "hsl(130, 30%, 30%)", border: "1px solid hsla(130, 20%, 60%, 0.3)", cursor: "pointer" }}>
    {children}
  </button>
);
const RoleCard = ({ active, onClick, Icon, title, desc }: any) => (
  <button onClick={onClick}
    className="flex items-center gap-3 p-3.5 rounded-xl text-left"
    style={{
      background: active ? "hsl(130, 50%, 95%)" : "white",
      border: `1.5px solid ${active ? "hsl(130, 55%, 42%)" : "hsla(130, 20%, 70%, 0.3)"}`,
      cursor: "pointer", transition: "all 0.15s",
    }}>
    <div style={{
      width: 40, height: 40, borderRadius: 12,
      background: active ? "hsl(130, 55%, 38%)" : "hsla(130, 30%, 92%, 1)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon size={20} color={active ? "white" : "hsl(130, 45%, 35%)"} />
    </div>
    <div className="flex-1">
      <div style={{ fontSize: 14, fontWeight: 600, color: "hsl(130, 30%, 22%)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "hsl(130, 18%, 45%)" }}>{desc}</div>
    </div>
  </button>
);
const TextField = ({ label, value, onChange, type = "text", placeholder }: any) => (
  <label className="flex flex-col gap-1">
    <span style={{ fontSize: 11, fontWeight: 600, color: "hsl(130, 25%, 35%)" }}>{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{
        padding: "11px 14px", borderRadius: 12, border: "1px solid hsla(130, 20%, 60%, 0.25)",
        background: "white", fontSize: 14, color: "hsl(130, 30%, 18%)", fontFamily: FONT, outline: "none",
      }} />
  </label>
);
const SelectField = ({ label, value, onChange, options }: any) => (
  <label className="flex flex-col gap-1">
    <span style={{ fontSize: 11, fontWeight: 600, color: "hsl(130, 25%, 35%)" }}>{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "11px 14px", borderRadius: 12, border: "1px solid hsla(130, 20%, 60%, 0.25)",
        background: "white", fontSize: 14, color: "hsl(130, 30%, 18%)", fontFamily: FONT, outline: "none",
      }}>
      <option value="">Select…</option>
      {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
    </select>
  </label>
);
const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-1" style={{ fontSize: 13 }}>
    <span style={{ color: "hsl(130, 18%, 45%)" }}>{label}</span>
    <span style={{ color: "hsl(130, 30%, 22%)", fontWeight: 600 }}>{value || "—"}</span>
  </div>
);

export default ProfileSetup;
