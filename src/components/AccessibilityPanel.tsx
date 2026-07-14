import { useState, useCallback } from "react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

interface AccessibilityPanelProps {
  onClose: () => void;
  onToggleHighContrast: (on: boolean) => void;
  onToggleLargeTargets: (on: boolean) => void;
  highContrast: boolean;
  largeTargets: boolean;
}

const AccessibilityPanel = ({
  onClose,
  onToggleHighContrast,
  onToggleLargeTargets,
  highContrast,
  largeTargets,
}: AccessibilityPanelProps) => {
  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 80,
      animation: "a11ySlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      <div style={{
        background: "hsla(0, 0%, 100%, 0.75)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        borderRadius: "24px 24px 0 0",
        padding: "24px 24px 36px",
        border: "1px solid hsla(0, 0%, 100%, 0.5)",
        borderBottom: "none",
        boxShadow: "0 -8px 40px hsla(0, 0%, 0%, 0.08)",
        fontFamily: FONT,
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "hsla(0, 0%, 0%, 0.1)",
          margin: "0 auto 18px",
        }} />

        <div style={{
          fontSize: 16, fontWeight: 700,
          color: "hsl(0, 0%, 15%)",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          Accessibility
          <button onClick={onClose} style={{
            background: "none", border: "none",
            fontSize: 18, color: "hsl(0, 0%, 50%)",
            cursor: "pointer", padding: 4,
          }}>✕</button>
        </div>

        {/* Toggle items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Voice-only mode info */}
          <div style={{
            padding: "12px 16px", borderRadius: 16,
            background: "hsla(130, 30%, 50%, 0.08)",
            border: "1px solid hsla(130, 30%, 50%, 0.12)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(130, 35%, 35%)" }}>
              Voice Navigation — Active
            </div>
            <div style={{ fontSize: 11, color: "hsl(0, 0%, 50%)", marginTop: 4 }}>
              Say "Orb" to activate, speak commands naturally. Full hands-free operation.
            </div>
          </div>

          {/* High contrast toggle */}
          <ToggleRow
            label="High Contrast"
            description="Enhanced visibility for visual impairments"
            active={highContrast}
            onToggle={() => onToggleHighContrast(!highContrast)}
          />

          {/* Large touch targets */}
          <ToggleRow
            label="Large Touch Targets"
            description="Bigger buttons for motor accessibility"
            active={largeTargets}
            onToggle={() => onToggleLargeTargets(!largeTargets)}
          />

          {/* Gesture hints */}
          <div style={{
            padding: "12px 16px", borderRadius: 16,
            background: "hsla(0, 0%, 0%, 0.02)",
            border: "1px solid hsla(0, 0%, 0%, 0.04)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0, 0%, 25%)" }}>
              Gesture Controls
            </div>
            <div style={{ fontSize: 11, color: "hsl(0, 0%, 50%)", marginTop: 4, lineHeight: 1.6 }}>
              Tap orb — start/stop listening<br/>
              Double-tap — take a photo<br/>
              Long press — open accessibility<br/>
              Say "help" — get assistance
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes a11ySlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const ToggleRow = ({ label, description, active, onToggle }: {
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}) => (
  <div
    onClick={onToggle}
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      borderRadius: 16,
      background: active ? "hsla(130, 40%, 48%, 0.08)" : "hsla(0, 0%, 0%, 0.02)",
      border: `1px solid ${active ? "hsla(130, 40%, 48%, 0.15)" : "hsla(0, 0%, 0%, 0.04)"}`,
      cursor: "pointer",
      transition: "all 0.3s ease",
    }}
  >
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0, 0%, 20%)" }}>{label}</div>
      <div style={{ fontSize: 11, color: "hsl(0, 0%, 50%)", marginTop: 2 }}>{description}</div>
    </div>
    <div style={{
      width: 44, height: 26, borderRadius: 13,
      background: active
        ? "linear-gradient(135deg, hsl(130, 45%, 48%), hsl(140, 40%, 42%))"
        : "hsl(0, 0%, 82%)",
      padding: 2,
      transition: "background 0.3s ease",
      flexShrink: 0,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        background: "hsl(0, 0%, 100%)",
        boxShadow: "0 1px 4px hsla(0, 0%, 0%, 0.15)",
        transform: active ? "translateX(18px)" : "translateX(0)",
        transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }} />
    </div>
  </div>
);

export default AccessibilityPanel;
