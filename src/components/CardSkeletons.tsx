import React from "react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

const shimmer: React.CSSProperties = {
  background:
    "linear-gradient(90deg, hsla(0,0%,0%,0.04) 0%, hsla(0,0%,0%,0.08) 50%, hsla(0,0%,0%,0.04) 100%)",
  backgroundSize: "200% 100%",
  animation: "skelShimmer 1.4s ease-in-out infinite",
  borderRadius: 8,
};

const Bar = ({ w, h = 10, mt = 0 }: { w: number | string; h?: number; mt?: number }) => (
  <div style={{ ...shimmer, width: w, height: h, marginTop: mt }} />
);

const ShellHeader = ({ label }: { label: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: "hsl(130, 50%, 50%)",
        animation: "skelDot 1.2s ease-in-out infinite",
      }} />
      <div style={{
        fontSize: 12, fontWeight: 700, color: "hsl(0, 0%, 35%)",
        letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: FONT,
      }}>
        {label}
      </div>
    </div>
    <div style={{ ...shimmer, width: 14, height: 14, borderRadius: "50%" }} />
  </div>
);

const Shell = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div
    style={{
      width: "100%",
      maxWidth: 340,
      animation: "skelEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    }}
  >
    <div
      style={{
        background: "hsla(0, 0%, 100%, 0.55)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        borderRadius: 24,
        padding: "18px 18px 16px",
        border: "1px solid hsla(0, 0%, 100%, 0.5)",
        boxShadow: "0 8px 32px hsla(130, 30%, 30%, 0.06)",
        fontFamily: FONT,
      }}
    >
      <ShellHeader label={label} />
      {children}
    </div>
    <style>{`
      @keyframes skelShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @keyframes skelDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.7); }
      }
      @keyframes skelEnter {
        from { opacity: 0; transform: translateY(12px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `}</style>
  </div>
);

export const MarketSkeleton = () => (
  <Shell label="Fetching live prices…">
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            padding: "12px 14px",
            borderRadius: 16,
            background: "hsla(0, 0%, 100%, 0.5)",
            border: "1px solid hsla(0, 0%, 0%, 0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Bar w={90} h={12} />
            <Bar w={20} h={20} />
          </div>
          <Bar w={120} h={18} mt={8} />
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <Bar w={70} h={14} />
            <Bar w={90} h={14} />
          </div>
        </div>
      ))}
    </div>
  </Shell>
);

export const BiosecuritySkeleton = () => (
  <Shell label="Running biosecurity check…">
    <Bar w={80} h={20} />
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ ...shimmer, width: 18, height: 18, borderRadius: 5 }} />
          <Bar w={`${60 + ((i * 13) % 30)}%`} h={11} />
        </div>
      ))}
    </div>
  </Shell>
);
