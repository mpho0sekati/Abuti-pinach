import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";
const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-number`;
const AUTH_HEADER = { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` };

interface OwnedNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  voiceUrl: string;
  smsUrl: string;
}

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}

const COUNTRIES = [
  { code: "US", label: "🇺🇸 United States" },
  { code: "GB", label: "🇬🇧 United Kingdom" },
  { code: "ZA", label: "🇿🇦 South Africa" },
  { code: "KE", label: "🇰🇪 Kenya" },
  { code: "NG", label: "🇳🇬 Nigeria" },
  { code: "CA", label: "🇨🇦 Canada" },
  { code: "AU", label: "🇦🇺 Australia" },
];

const PhoneNumbers = () => {
  const navigate = useNavigate();
  const [owned, setOwned] = useState<OwnedNumber[]>([]);
  const [available, setAvailable] = useState<AvailableNumber[]>([]);
  const [country, setCountry] = useState("US");
  const [areaCode, setAreaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchOwned = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(API_URL, { method: "POST", headers: AUTH_HEADER, body: JSON.stringify({ action: "list" }) });
      const data = await resp.json();
      if (data.numbers) setOwned(data.numbers);
      else if (data.error) setMessage({ type: "error", text: data.error });
    } catch (e) {
      setMessage({ type: "error", text: "Failed to fetch numbers" });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchOwned(); }, [fetchOwned]);

  const searchNumbers = async () => {
    setSearching(true);
    setAvailable([]);
    setMessage(null);
    try {
      const resp = await fetch(API_URL, { method: "POST", headers: AUTH_HEADER, body: JSON.stringify({ action: "search", country, areaCode: areaCode || undefined }) });
      const data = await resp.json();
      if (data.available) {
        setAvailable(data.available);
        if (data.available.length === 0) setMessage({ type: "error", text: "No numbers found. Try a different country or area code." });
      } else if (data.error) setMessage({ type: "error", text: data.error });
    } catch (e) {
      setMessage({ type: "error", text: "Search failed" });
    }
    setSearching(false);
  };

  const purchaseNumber = async (phoneNumber: string) => {
    setPurchasing(phoneNumber);
    setMessage(null);
    try {
      const resp = await fetch(API_URL, { method: "POST", headers: AUTH_HEADER, body: JSON.stringify({ action: "purchase", phoneNumber }) });
      const data = await resp.json();
      if (data.success) {
        setMessage({ type: "success", text: `Purchased ${data.number.phoneNumber}! Webhooks configured automatically.` });
        setAvailable(prev => prev.filter(n => n.phoneNumber !== phoneNumber));
        fetchOwned();
      } else {
        setMessage({ type: "error", text: data.error || "Purchase failed" });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Purchase failed" });
    }
    setPurchasing(null);
  };

  const configureWebhooks = async (sid: string) => {
    setConfiguring(sid);
    setMessage(null);
    try {
      const resp = await fetch(API_URL, { method: "POST", headers: AUTH_HEADER, body: JSON.stringify({ action: "configure", phoneNumberSid: sid }) });
      const data = await resp.json();
      if (data.success) {
        setMessage({ type: "success", text: "Webhooks updated!" });
        fetchOwned();
      } else {
        setMessage({ type: "error", text: data.error || "Configuration failed" });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Configuration failed" });
    }
    setConfiguring(null);
  };

  const expectedVoiceUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-voice`;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(180deg, hsl(80, 15%, 97%) 0%, hsl(100, 12%, 94%) 40%, hsl(90, 18%, 91%) 100%)",
      fontFamily: FONT,
      padding: "24px 16px",
    }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <button onClick={() => navigate("/")} style={{
            width: 36, height: 36, borderRadius: "50%", border: "none",
            background: "hsla(0, 0%, 100%, 0.6)", backdropFilter: "blur(12px)",
            cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            ←
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "hsl(0, 0%, 15%)", margin: 0 }}>
              📞 Phone Numbers
            </h1>
            <p style={{ fontSize: 12, color: "hsl(0, 0%, 50%)", margin: 0, letterSpacing: "0.04em" }}>
              Manage dedicated farming hotline numbers
            </p>
          </div>
        </div>

        {/* Status message */}
        {message && (
          <div style={{
            padding: "12px 18px", borderRadius: 16, marginBottom: 20,
            background: message.type === "success" ? "hsla(130, 40%, 48%, 0.12)" : "hsla(0, 60%, 50%, 0.1)",
            color: message.type === "success" ? "hsl(130, 45%, 30%)" : "hsl(0, 50%, 40%)",
            fontSize: 13, fontWeight: 500,
          }}>
            {message.text}
          </div>
        )}

        {/* Owned Numbers */}
        <div style={{
          background: "hsla(0, 0%, 100%, 0.6)", backdropFilter: "blur(20px)",
          borderRadius: 20, padding: 24, marginBottom: 24,
          border: "1px solid hsla(0, 0%, 100%, 0.5)",
          boxShadow: "0 4px 24px hsla(0, 0%, 0%, 0.04)",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "hsl(0, 0%, 18%)", margin: "0 0 16px" }}>
            Your Numbers
          </h2>
          {loading ? (
            <p style={{ fontSize: 13, color: "hsl(0, 0%, 50%)" }}>Loading...</p>
          ) : owned.length === 0 ? (
            <p style={{ fontSize: 13, color: "hsl(0, 0%, 50%)" }}>No numbers yet. Search and purchase one below.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {owned.map(n => {
                const isConfigured = n.voiceUrl === expectedVoiceUrl;
                return (
                  <div key={n.sid} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", borderRadius: 14,
                    background: "hsla(130, 20%, 96%, 0.6)",
                    border: isConfigured ? "1px solid hsla(130, 40%, 50%, 0.2)" : "1px solid hsla(40, 60%, 50%, 0.2)",
                  }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "hsl(0, 0%, 15%)", letterSpacing: "0.02em" }}>
                        {n.phoneNumber}
                      </div>
                      <div style={{ fontSize: 11, color: isConfigured ? "hsl(130, 40%, 40%)" : "hsl(40, 50%, 40%)", marginTop: 2 }}>
                        {isConfigured ? "✓ Webhooks configured" : "⚠ Webhooks not configured"}
                      </div>
                    </div>
                    {!isConfigured && (
                      <button
                        onClick={() => configureWebhooks(n.sid)}
                        disabled={configuring === n.sid}
                        style={{
                          padding: "8px 16px", borderRadius: 20, border: "none",
                          background: "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))",
                          color: "hsl(0, 0%, 100%)", fontSize: 12, fontWeight: 600,
                          cursor: configuring === n.sid ? "wait" : "pointer",
                          opacity: configuring === n.sid ? 0.6 : 1,
                        }}
                      >
                        {configuring === n.sid ? "..." : "Configure"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Search & Purchase */}
        <div style={{
          background: "hsla(0, 0%, 100%, 0.6)", backdropFilter: "blur(20px)",
          borderRadius: 20, padding: 24,
          border: "1px solid hsla(0, 0%, 100%, 0.5)",
          boxShadow: "0 4px 24px hsla(0, 0%, 0%, 0.04)",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "hsl(0, 0%, 18%)", margin: "0 0 16px" }}>
            Get a New Number
          </h2>

          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              style={{
                flex: 1, minWidth: 160, padding: "10px 14px", borderRadius: 14,
                border: "1px solid hsla(130, 20%, 60%, 0.12)",
                background: "hsla(0, 0%, 100%, 0.7)", fontSize: 13,
                fontFamily: FONT, outline: "none", color: "hsl(0, 0%, 18%)",
              }}
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>

            <input
              value={areaCode}
              onChange={e => setAreaCode(e.target.value)}
              placeholder="Area code (optional)"
              style={{
                width: 140, padding: "10px 14px", borderRadius: 14,
                border: "1px solid hsla(130, 20%, 60%, 0.12)",
                background: "hsla(0, 0%, 100%, 0.7)", fontSize: 13,
                fontFamily: FONT, outline: "none", color: "hsl(0, 0%, 18%)",
              }}
            />

            <button
              onClick={searchNumbers}
              disabled={searching}
              style={{
                padding: "10px 22px", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))",
                color: "hsl(0, 0%, 100%)", fontSize: 13, fontWeight: 600,
                cursor: searching ? "wait" : "pointer",
                opacity: searching ? 0.6 : 1,
                boxShadow: "0 3px 12px hsla(135, 35%, 40%, 0.25)",
              }}
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Results */}
          {available.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {available.map(n => (
                <div key={n.phoneNumber} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 14,
                  background: "hsla(0, 0%, 100%, 0.5)",
                  border: "1px solid hsla(130, 20%, 60%, 0.08)",
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(0, 0%, 15%)" }}>
                      {n.phoneNumber}
                    </div>
                    <div style={{ fontSize: 11, color: "hsl(0, 0%, 50%)" }}>
                      {[n.locality, n.region].filter(Boolean).join(", ") || n.friendlyName}
                    </div>
                  </div>
                  <button
                    onClick={() => purchaseNumber(n.phoneNumber)}
                    disabled={purchasing === n.phoneNumber}
                    style={{
                      padding: "8px 18px", borderRadius: 20, border: "none",
                      background: purchasing === n.phoneNumber
                        ? "hsl(0, 0%, 85%)"
                        : "linear-gradient(135deg, hsl(200, 60%, 50%), hsl(210, 55%, 45%))",
                      color: "hsl(0, 0%, 100%)", fontSize: 12, fontWeight: 600,
                      cursor: purchasing === n.phoneNumber ? "wait" : "pointer",
                    }}
                  >
                    {purchasing === n.phoneNumber ? "Buying..." : "Purchase"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhoneNumbers;
