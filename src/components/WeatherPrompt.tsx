import { WeatherStatus, WeatherData } from "@/hooks/useWeather";

interface WeatherPromptProps {
  status: WeatherStatus;
  weather: WeatherData | null;
  onRequestLocation: () => void;
  onSkip: () => void;
}

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

const glassCard: React.CSSProperties = {
  padding: "18px 20px",
  borderRadius: 20,
  background: "hsla(0, 0%, 100%, 0.72)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 4px 24px hsla(130, 20%, 30%, 0.06), 0 1px 3px hsla(130, 20%, 30%, 0.04)",
  border: "1px solid hsla(0, 0%, 100%, 0.6)",
  fontFamily: FONT,
  fontSize: 14,
  color: "hsl(0, 0%, 25%)",
  lineHeight: 1.55,
  textAlign: "center" as const,
};

const WeatherPrompt = ({ status, weather, onRequestLocation, onSkip }: WeatherPromptProps) => {
  if (status === "granted" && weather) return null;

  if (status === "idle") {
    return (
      <div className="w-full flex justify-center" style={{ maxWidth: 340, animation: "wpSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={glassCard}>
          <p style={{ marginBottom: 14 }}>
            Want me to check your local weather? I'll help plan your day.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={onRequestLocation}
              style={{
                padding: "10px 20px",
                borderRadius: 14,
                border: "none",
                background: "hsl(135, 35%, 45%)",
                color: "hsl(0, 0%, 100%)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: FONT,
                transition: "all 0.2s",
              }}
            >
              Share location
            </button>
            <button
              onClick={onSkip}
              style={{
                padding: "10px 20px",
                borderRadius: 14,
                border: "1px solid hsla(0, 0%, 0%, 0.08)",
                background: "hsla(0, 0%, 100%, 0.5)",
                color: "hsl(0, 0%, 45%)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: FONT,
                transition: "all 0.2s",
              }}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "requesting" || status === "loading") {
    return (
      <div className="w-full flex justify-center" style={{ maxWidth: 340, animation: "wpSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ ...glassCard, color: "hsl(0, 0%, 45%)" }}>
          {status === "requesting" ? "Waiting for location permission…" : "Fetching weather…"}
        </div>
      </div>
    );
  }

  if (status === "denied" || status === "error") {
    return (
      <div className="w-full flex justify-center" style={{ maxWidth: 340, animation: "wpSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={glassCard}>
          <p style={{ marginBottom: 12 }}>No worries — you can still ask me anything about farming.</p>
          <button
            onClick={onSkip}
            style={{
              padding: "10px 22px",
              borderRadius: 14,
              border: "none",
              background: "hsl(135, 35%, 45%)",
              color: "hsl(0, 0%, 100%)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default WeatherPrompt;
