import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, ShieldAlert, Moon, Volume2, Vibrate, AlertTriangle, CheckCircle2, XCircle, MapPin, Plus, Trash2, Star, Search, Loader2, Crosshair } from "lucide-react";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { useSavedLocations, type SavedLocation } from "@/hooks/useSavedLocations";
import { geocodeLocation, type GeocodeHit } from "@/utils/weatherAlerts";
import type { NotifPermission } from "@/hooks/useWeatherNotifications";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission: NotifPermission;
  supported: boolean;
  onRequestPermission: () => void;
};

export default function NotificationSettingsPanel({ open, onOpenChange, permission, supported, onRequestPermission }: Props) {
  const { settings, update } = useNotificationSettings();
  const { locations, addLocation, updateLocation, removeLocation, setPrimary } = useSavedLocations();

  const statusMeta = !supported
    ? { icon: XCircle, label: "Not supported on this device", tone: "muted" as const }
    : permission === "granted"
      ? { icon: CheckCircle2, label: "Alerts are on", tone: "ok" as const }
      : permission === "denied"
        ? { icon: XCircle, label: "Blocked in browser settings", tone: "danger" as const }
        : { icon: AlertTriangle, label: "Permission needed", tone: "warn" as const };

  const toneBg = { ok: "hsla(130, 60%, 95%, 0.9)", warn: "hsla(35, 90%, 95%, 0.9)", danger: "hsla(0, 80%, 96%, 0.9)", muted: "hsla(0, 0%, 96%, 0.9)" }[statusMeta.tone];
  const toneFg = { ok: "hsl(130, 50%, 30%)", warn: "hsl(30, 70%, 35%)", danger: "hsl(0, 70%, 40%)", muted: "hsl(0, 0%, 40%)" }[statusMeta.tone];
  const toneBorder = { ok: "hsla(130, 50%, 60%, 0.35)", warn: "hsla(30, 80%, 55%, 0.35)", danger: "hsla(0, 70%, 55%, 0.35)", muted: "hsla(0, 0%, 70%, 0.35)" }[statusMeta.tone];

  const StatusIcon = statusMeta.icon;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="border-0"
        style={{
          fontFamily: FONT,
          background: "linear-gradient(180deg, hsla(90, 25%, 99%, 0.98) 0%, hsla(95, 22%, 96%, 0.98) 100%)",
          backdropFilter: "blur(24px) saturate(1.3)",
          maxWidth: 560, margin: "0 auto", maxHeight: "90vh",
        }}
      >
        <DrawerHeader className="px-5 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: "linear-gradient(135deg, hsl(130, 50%, 92%), hsl(130, 45%, 85%))",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid hsla(130, 40%, 60%, 0.25)",
            }}>
              <Bell size={18} color="hsl(130, 45%, 30%)" />
            </div>
            <div>
              <DrawerTitle style={{ fontSize: 17, color: "#0f1a0f", letterSpacing: "-0.2px" }}>Weather alerts</DrawerTitle>
              <DrawerDescription style={{ fontSize: 12, color: "#6b7c6b", marginTop: 2 }}>Choose what wakes you up — and where.</DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="px-5 pb-6 overflow-y-auto" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 14,
            background: toneBg, border: `1px solid ${toneBorder}`,
          }}>
            <StatusIcon size={16} color={toneFg} />
            <span style={{ fontSize: 13, fontWeight: 600, color: toneFg, flex: 1 }}>{statusMeta.label}</span>
            {supported && permission !== "granted" && permission !== "denied" && (
              <Button size="sm" onClick={onRequestPermission} style={{ height: 30, borderRadius: 10, background: "hsl(130, 45%, 35%)", color: "white", fontSize: 12 }}>Enable</Button>
            )}
          </div>

          {/* Locations */}
          <Section title="Locations" icon={<MapPin size={14} />}>
            <LocationsManager
              locations={locations}
              onAdd={addLocation}
              onUpdate={updateLocation}
              onRemove={removeLocation}
              onSetPrimary={setPrimary}
            />
          </Section>

          <Section title="Severity" icon={<ShieldAlert size={14} />}>
            <Row icon={<AlertTriangle size={16} color="hsl(0, 70%, 50%)" />} title="Severe weather"
              hint="Thunderstorms, floods, gale winds, extreme heat or freeze."
              checked={settings.severeEnabled} onChange={(v) => update({ severeEnabled: v })} />
            <Row icon={<AlertTriangle size={16} color="hsl(30, 80%, 50%)" />} title="Moderate warnings"
              hint="Heavy rain, strong wind, heat advisory, frost risk."
              checked={settings.moderateEnabled} onChange={(v) => update({ moderateEnabled: v })} />
          </Section>

          <Section title="Quiet hours" icon={<Moon size={14} />}>
            <Row icon={<Moon size={16} color="hsl(220, 30%, 45%)" />} title="Silence alerts at night"
              hint="No sound or vibration during the window below."
              checked={settings.quietHoursEnabled} onChange={(v) => update({ quietHoursEnabled: v })} />
            {settings.quietHoursEnabled && (
              <>
                <div className="flex items-center gap-3 px-1 pt-1">
                  <TimeField label="From" value={settings.quietStart} onChange={(v) => update({ quietStart: v })} />
                  <TimeField label="Until" value={settings.quietEnd} onChange={(v) => update({ quietEnd: v })} />
                </div>
                <Row icon={<BellOff size={16} color="hsl(0, 60%, 45%)" />} title="Always alert on severe"
                  hint="Bypass quiet hours when a life-safety warning fires."
                  checked={settings.bypassQuietForSevere} onChange={(v) => update({ bypassQuietForSevere: v })} />
              </>
            )}
          </Section>

          <Section title="Feedback" icon={<Volume2 size={14} />}>
            <Row icon={<Volume2 size={16} color="hsl(130, 45%, 35%)" />} title="Sound" hint="Play the system notification sound."
              checked={settings.sound} onChange={(v) => update({ sound: v })} />
            <Row icon={<Vibrate size={16} color="hsl(130, 45%, 35%)" />} title="Vibration" hint="Buzz the phone on alert (mobile only)."
              checked={settings.vibrate} onChange={(v) => update({ vibrate: v })} />
          </Section>

          {permission === "denied" && (
            <p style={{ fontSize: 11, color: "#8a8a8a", lineHeight: 1.5, padding: "0 4px" }}>
              Notifications are blocked. Open your browser's site settings for this app and allow notifications, then come back.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function LocationsManager({
  locations, onAdd, onUpdate, onRemove, onSetPrimary,
}: {
  locations: SavedLocation[];
  onAdd: (loc: Omit<SavedLocation, "id">) => void;
  onUpdate: (id: string, patch: Partial<SavedLocation>) => void;
  onRemove: (id: string) => void;
  onSetPrimary: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [usingCurrent, setUsingCurrent] = useState(false);
  const [error, setError] = useState<string>("");

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setError("");
    try {
      const results = await geocodeLocation(query);
      setHits(results);
      if (results.length === 0) setError("No matches found.");
    } catch { setError("Couldn't search right now."); }
    finally { setSearching(false); }
  };

  const useCurrent = () => {
    if (!navigator.geolocation) { setError("Geolocation unavailable"); return; }
    setUsingCurrent(true); setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onAdd({
          label: "My current location",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          alertsEnabled: true,
          isPrimary: locations.length === 0,
        });
        setUsingCurrent(false); setAdding(false); setQuery(""); setHits([]);
      },
      () => { setError("Location permission denied."); setUsingCurrent(false); },
      { timeout: 10000 }
    );
  };

  const pickHit = (h: GeocodeHit) => {
    const label = [h.name, h.admin1, h.country].filter(Boolean).join(", ");
    onAdd({
      label, latitude: h.latitude, longitude: h.longitude,
      alertsEnabled: true, isPrimary: locations.length === 0,
    });
    setAdding(false); setQuery(""); setHits([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "4px" }}>
      {locations.length === 0 && !adding && (
        <div style={{ padding: "10px 8px", fontSize: 12, color: "#6b7c6b", lineHeight: 1.4 }}>
          No saved locations yet. Add your farm, family's place, or any spot you care about.
        </div>
      )}

      {locations.map(loc => (
        <div key={loc.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px", borderRadius: 12,
          background: loc.isPrimary ? "hsla(130, 35%, 94%, 0.7)" : "transparent",
          border: loc.isPrimary ? "1px solid hsla(130, 40%, 55%, 0.25)" : "1px solid transparent",
          marginBottom: 4,
        }}>
          <button
            onClick={() => onSetPrimary(loc.id)}
            title={loc.isPrimary ? "Primary location" : "Make primary"}
            style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: loc.isPrimary ? "hsl(45, 90%, 92%)" : "hsla(130, 25%, 96%, 0.9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${loc.isPrimary ? "hsla(45, 80%, 55%, 0.4)" : "hsla(130, 20%, 70%, 0.2)"}`,
              cursor: "pointer",
            }}>
            <Star size={15} color={loc.isPrimary ? "hsl(40, 85%, 45%)" : "hsl(0, 0%, 55%)"} fill={loc.isPrimary ? "hsl(45, 90%, 60%)" : "none"} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0f1a0f", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loc.label}</div>
            <div style={{ fontSize: 11, color: "#6b7c6b", marginTop: 2 }}>
              {loc.latitude.toFixed(3)}, {loc.longitude.toFixed(3)} · {loc.alertsEnabled ? "Alerts on" : "Alerts paused"}
            </div>
          </div>
          <Switch checked={loc.alertsEnabled} onCheckedChange={(v) => onUpdate(loc.id, { alertsEnabled: v })} />
          <button onClick={() => onRemove(loc.id)} aria-label="Remove location"
            style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <Trash2 size={15} color="hsl(0, 50%, 50%)" />
          </button>
        </div>
      ))}

      {!adding ? (
        <Button
          variant="ghost"
          onClick={() => setAdding(true)}
          style={{
            marginTop: 6, height: 40, borderRadius: 12,
            border: "1px dashed hsla(130, 30%, 50%, 0.4)",
            color: "hsl(130, 45%, 30%)", fontSize: 13, fontWeight: 600,
          }}>
          <Plus size={16} style={{ marginRight: 6 }} /> Add location
        </Button>
      ) : (
        <div style={{
          marginTop: 6, padding: 10, borderRadius: 12,
          background: "hsla(130, 25%, 97%, 0.7)",
          border: "1px solid hsla(130, 25%, 60%, 0.18)",
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
              placeholder="Search a town or city…"
              style={{
                flex: 1, height: 38, borderRadius: 10,
                border: "1px solid hsla(130, 25%, 60%, 0.25)", background: "white",
                padding: "0 12px", fontSize: 13, fontFamily: FONT, color: "#0f1a0f", outline: "none",
              }}
            />
            <Button onClick={runSearch} disabled={searching || !query.trim()}
              style={{ height: 38, borderRadius: 10, background: "hsl(130, 45%, 35%)", color: "white", fontSize: 12 }}>
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </Button>
          </div>

          <button
            onClick={useCurrent}
            disabled={usingCurrent}
            style={{
              marginTop: 8, width: "100%", height: 36, borderRadius: 10,
              border: "1px solid hsla(130, 25%, 60%, 0.25)", background: "white",
              fontSize: 12.5, fontWeight: 600, color: "hsl(130, 45%, 30%)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            {usingCurrent ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
            Use my current location
          </button>

          {error && <div style={{ fontSize: 11, color: "hsl(0, 70%, 45%)", marginTop: 6 }}>{error}</div>}

          {hits.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {hits.map((h, i) => {
                const label = [h.name, h.admin1, h.country].filter(Boolean).join(", ");
                return (
                  <button key={i} onClick={() => pickHit(h)}
                    style={{
                      textAlign: "left", padding: "8px 10px", borderRadius: 8,
                      background: "white", border: "1px solid hsla(130, 20%, 70%, 0.2)",
                      cursor: "pointer", fontSize: 12.5, color: "#0f1a0f",
                    }}>
                    <MapPin size={11} style={{ display: "inline", marginRight: 6, color: "hsl(130, 45%, 35%)" }} />
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <button onClick={() => { setAdding(false); setQuery(""); setHits([]); setError(""); }}
            style={{ marginTop: 8, width: "100%", height: 30, borderRadius: 8, background: "transparent",
              border: "none", fontSize: 11.5, color: "#6b7c6b", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: "hsla(0, 0%, 100%, 0.65)",
      border: "1px solid hsla(130, 25%, 60%, 0.18)",
      borderRadius: 16, padding: 6,
      boxShadow: "0 1px 2px hsla(130, 20%, 30%, 0.04)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 10px 4px",
        fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#6b7c6b",
      }}>{icon}{title}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

function Row({ icon, title, hint, checked, onChange }: { icon: React.ReactNode; title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", borderRadius: 12, cursor: "pointer", transition: "background 0.15s ease" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "hsla(130, 30%, 95%, 0.5)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: "hsla(130, 25%, 96%, 0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid hsla(130, 20%, 70%, 0.2)",
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f1a0f", lineHeight: 1.25 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "#6b7c6b", lineHeight: 1.35, marginTop: 2 }}>{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <Label style={{ fontSize: 11, color: "#6b7c6b", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</Label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          marginTop: 4, width: "100%",
          height: 40, borderRadius: 10,
          border: "1px solid hsla(130, 25%, 60%, 0.25)",
          background: "white", padding: "0 12px",
          fontSize: 14, fontFamily: FONT, color: "#0f1a0f", outline: "none",
        }}
      />
    </div>
  );
}
