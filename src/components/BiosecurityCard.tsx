import { useState, useEffect } from "react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

export interface BiosecurityData {
  livestock_type: string;
  risk_level: "low" | "medium" | "high" | "critical";
  checklist: {
    item: string;
    status: "required" | "recommended" | "optional";
    category: string;
  }[];
  urgent_actions?: string[];
}

interface BiosecurityCardProps {
  data: BiosecurityData;
  onDismiss: () => void;
}

const riskColors: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: "hsla(130, 40%, 48%, 0.1)", text: "hsl(130, 40%, 35%)", border: "hsla(130, 40%, 48%, 0.2)" },
  medium: { bg: "hsla(45, 60%, 50%, 0.1)", text: "hsl(45, 60%, 38%)", border: "hsla(45, 60%, 50%, 0.2)" },
  high: { bg: "hsla(25, 70%, 50%, 0.1)", text: "hsl(25, 60%, 40%)", border: "hsla(25, 70%, 50%, 0.2)" },
  critical: { bg: "hsla(0, 60%, 50%, 0.12)", text: "hsl(0, 55%, 42%)", border: "hsla(0, 60%, 50%, 0.25)" },
};

const statusIcon = (s: string) => s === "required" ? "!" : s === "recommended" ? "~" : "?";

const BiosecurityCard = ({ data, onDismiss }: BiosecurityCardProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    const dismiss = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 500);
    }, 30000);
    return () => { clearTimeout(t); clearTimeout(dismiss); };
  }, [onDismiss]);

  const rc = riskColors[data.risk_level] || riskColors.low;

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.95)",
      transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      width: "100%",
      maxWidth: 340,
    }}>
      <div style={{
        background: "hsla(0, 0%, 100%, 0.55)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        borderRadius: 24,
        padding: "18px 18px 14px",
        border: "1px solid hsla(0, 0%, 100%, 0.5)",
        boxShadow: "0 8px 32px hsla(130, 30%, 30%, 0.06)",
        fontFamily: FONT,
        maxHeight: 400,
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(0, 0%, 18%)" }}>
            Biosecurity — {data.livestock_type}
          </div>
          <button onClick={() => { setVisible(false); setTimeout(onDismiss, 500); }} style={{
            background: "none", border: "none", fontSize: 14,
            color: "hsl(0, 0%, 50%)", cursor: "pointer",
          }}>✕</button>
        </div>

        {/* Risk level badge */}
        <div style={{
          display: "inline-block",
          padding: "4px 12px", borderRadius: 10,
          background: rc.bg, border: `1px solid ${rc.border}`,
          fontSize: 11, fontWeight: 700, color: rc.text,
          textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 12,
          animation: data.risk_level === "critical" ? "riskPulse 1s ease-in-out infinite" : "none",
        }}>
          {data.risk_level} risk
        </div>

        {/* Urgent actions */}
        {data.urgent_actions && data.urgent_actions.length > 0 && (
          <div style={{
            padding: "10px 12px", borderRadius: 14,
            background: "hsla(0, 55%, 50%, 0.08)",
            border: "1px solid hsla(0, 55%, 50%, 0.15)",
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(0, 50%, 42%)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Immediate Actions
            </div>
            {data.urgent_actions.map((a, i) => (
              <div key={i} style={{ fontSize: 12, color: "hsl(0, 40%, 35%)", marginTop: i > 0 ? 4 : 0, lineHeight: 1.5 }}>
                — {a}
              </div>
            ))}
          </div>
        )}

        {/* Checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.checklist.slice(0, 8).map((c, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "8px 10px", borderRadius: 12,
              background: c.status === "required" ? "hsla(0, 0%, 0%, 0.02)" : "transparent",
              animation: `cardSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.05}s both`,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: `1.5px solid ${c.status === "required" ? "hsl(0, 50%, 50%)" : c.status === "recommended" ? "hsl(45, 50%, 50%)" : "hsl(0, 0%, 70%)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700,
                color: c.status === "required" ? "hsl(0, 50%, 50%)" : "hsl(0, 0%, 60%)",
              }}>
                {statusIcon(c.status)}
              </div>
              <div>
                <div style={{ fontSize: 12, color: "hsl(0, 0%, 20%)", lineHeight: 1.4 }}>{c.item}</div>
                <div style={{ fontSize: 9, color: "hsl(0, 0%, 55%)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {c.category.replace(/_/g, " ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes riskPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default BiosecurityCard;
