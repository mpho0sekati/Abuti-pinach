import { useState, useEffect } from "react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

export interface MarketPrediction {
  item: string;
  current_price: string;
  predicted_trend: "rising" | "stable" | "falling";
  demand_level: "high" | "medium" | "low";
  best_sell_window?: string;
  tip?: string;
  confidence?: "high" | "medium" | "low";
}

interface MarketPredictionCardProps {
  predictions: MarketPrediction[];
  onDismiss: () => void;
}

const trendIcon = (t: string) => t === "rising" ? "↗" : t === "falling" ? "↘" : "→";
const trendColor = (t: string) => t === "rising" ? "hsl(130, 50%, 42%)" : t === "falling" ? "hsl(0, 55%, 50%)" : "hsl(45, 60%, 45%)";
const demandBg = (d: string) => d === "high" ? "hsla(130, 40%, 48%, 0.12)" : d === "low" ? "hsla(0, 40%, 50%, 0.1)" : "hsla(45, 50%, 50%, 0.1)";
const demandColor = (d: string) => d === "high" ? "hsl(130, 40%, 38%)" : d === "low" ? "hsl(0, 45%, 45%)" : "hsl(45, 50%, 40%)";

const MarketPredictionCard = ({ predictions, onDismiss }: MarketPredictionCardProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    const dismiss = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 500);
    }, 25000);
    return () => { clearTimeout(t); clearTimeout(dismiss); };
  }, [onDismiss]);

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
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(0, 0%, 18%)", letterSpacing: "0.02em" }}>
            Market Intelligence
          </div>
          <button onClick={() => { setVisible(false); setTimeout(onDismiss, 500); }} style={{
            background: "none", border: "none", fontSize: 14,
            color: "hsl(0, 0%, 50%)", cursor: "pointer", padding: 2,
          }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {predictions.map((p, i) => (
            <div key={i} style={{
              padding: "12px 14px",
              borderRadius: 16,
              background: "hsla(0, 0%, 100%, 0.5)",
              border: "1px solid hsla(0, 0%, 0%, 0.04)",
              animation: `cardSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s both`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "hsl(0, 0%, 15%)" }}>
                  {p.item}
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 700, color: trendColor(p.predicted_trend),
                  lineHeight: 1,
                }}>
                  {trendIcon(p.predicted_trend)}
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "hsl(0, 0%, 20%)", marginTop: 4 }}>
                {p.current_price}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 8,
                  background: demandBg(p.demand_level), color: demandColor(p.demand_level),
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {p.demand_level} demand
                </span>
                {p.confidence && (
                  <span style={{
                    fontSize: 10, fontWeight: 500, padding: "3px 8px", borderRadius: 8,
                    background: "hsla(0, 0%, 0%, 0.04)", color: "hsl(0, 0%, 50%)",
                    letterSpacing: "0.04em",
                  }}>
                    {p.confidence} confidence
                  </span>
                )}
              </div>
              {p.best_sell_window && (
                <div style={{ fontSize: 11, color: "hsl(0, 0%, 45%)", marginTop: 6 }}>
                  Best to sell: {p.best_sell_window}
                </div>
              )}
              {p.tip && (
                <div style={{ fontSize: 11, color: "hsl(130, 30%, 40%)", marginTop: 4, fontStyle: "italic" }}>
                  {p.tip}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default MarketPredictionCard;
