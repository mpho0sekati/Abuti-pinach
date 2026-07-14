import { useState, useEffect, useMemo } from "react";
import type { WeatherData } from "@/hooks/useWeather";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

interface WeatherPopupProps {
  weather: WeatherData;
  visible: boolean;
  onDismiss: () => void;
}

const weatherIcons: Record<number, { icon: string; label: string }> = {
  0: { icon: "☀️", label: "Clear" },
  1: { icon: "🌤", label: "Mostly Clear" },
  2: { icon: "⛅", label: "Partly Cloudy" },
  3: { icon: "☁️", label: "Overcast" },
  45: { icon: "🌫", label: "Foggy" },
  48: { icon: "🌫", label: "Rime Fog" },
  51: { icon: "🌦", label: "Light Drizzle" },
  53: { icon: "🌦", label: "Drizzle" },
  55: { icon: "🌧", label: "Dense Drizzle" },
  61: { icon: "🌧", label: "Slight Rain" },
  63: { icon: "🌧", label: "Rain" },
  65: { icon: "🌧", label: "Heavy Rain" },
  71: { icon: "🌨", label: "Light Snow" },
  73: { icon: "❄️", label: "Snow" },
  75: { icon: "❄️", label: "Heavy Snow" },
  80: { icon: "🌦", label: "Showers" },
  81: { icon: "🌧", label: "Rain Showers" },
  82: { icon: "⛈", label: "Violent Showers" },
  95: { icon: "⛈", label: "Thunderstorm" },
  96: { icon: "⛈", label: "Hail Storm" },
  99: { icon: "⛈", label: "Severe Hail" },
};

const WeatherPopup = ({ weather, visible, onDismiss }: WeatherPopupProps) => {
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (visible) {
      setExiting(false);
      const t = setTimeout(() => setShow(true), 50);
      const dismiss = setTimeout(() => {
        setExiting(true);
        setTimeout(() => { setShow(false); onDismiss(); }, 500);
      }, 15000);
      return () => { clearTimeout(t); clearTimeout(dismiss); };
    } else {
      setShow(false);
    }
  }, [visible, onDismiss]);

  const iconData = useMemo(() => {
    return weatherIcons[weather.weatherCode] || { icon: "🌍", label: weather.description };
  }, [weather.weatherCode, weather.description]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => { setShow(false); onDismiss(); }, 500);
  };

  if (!visible && !show) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        zIndex: 50,
        transform: show && !exiting
          ? "translateX(-50%) translateY(0) scale(1)"
          : exiting
            ? "translateX(-50%) translateY(-12px) scale(0.92)"
            : "translateX(-50%) translateY(-16px) scale(0.92)",
        opacity: show && !exiting ? 1 : 0,
        transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: show ? "auto" : "none",
      }}
      onClick={handleDismiss}
    >
      <div style={{
        background: "hsla(0, 0%, 100%, 0.6)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        borderRadius: 20,
        padding: "10px 16px 8px",
        border: "1px solid hsla(0, 0%, 100%, 0.5)",
        boxShadow: `
          0 6px 24px hsla(130, 30%, 30%, 0.07),
          0 1px 2px hsla(0, 0%, 0%, 0.03),
          inset 0 1px 0 hsla(0, 0%, 100%, 0.6)
        `,
        fontFamily: FONT,
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        maxWidth: 280,
      }}>
        {/* Icon */}
        <div style={{
          fontSize: 32,
          lineHeight: 1,
          animation: "weatherIconFloat 3s ease-in-out infinite",
          filter: "drop-shadow(0 2px 4px hsla(0, 0%, 0%, 0.08))",
          flexShrink: 0,
        }}>
          {iconData.icon}
        </div>

        {/* Info column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Temp + description */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{
              fontSize: 22,
              fontWeight: 700,
              color: "hsl(0, 0%, 15%)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}>
              {Math.round(weather.temperature)}°
            </span>
            <span style={{
              fontSize: 10,
              color: "hsl(0, 0%, 45%)",
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}>
              {iconData.label}
            </span>
          </div>

          {/* Details */}
          <div style={{
            display: "flex",
            gap: 10,
            marginTop: 4,
          }}>
            <span style={{ fontSize: 10, color: "hsl(200, 50%, 45%)", fontWeight: 600 }}>
              {weather.humidity}% <span style={{ fontWeight: 400, color: "hsl(0, 0%, 55%)", fontSize: 8 }}>HUM</span>
            </span>
            <span style={{ fontSize: 10, color: "hsl(130, 35%, 45%)", fontWeight: 600 }}>
              {Math.round(weather.windSpeed)} <span style={{ fontWeight: 400, color: "hsl(0, 0%, 55%)", fontSize: 8 }}>KM/H</span>
            </span>
            <span style={{ fontSize: 10, color: "hsl(30, 50%, 45%)", fontWeight: 600 }}>
              {weather.daily.precipitationProbability}% <span style={{ fontWeight: 400, color: "hsl(0, 0%, 55%)", fontSize: 8 }}>RAIN</span>
            </span>
          </div>

          {/* H/L + progress */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 5,
          }}>
            <span style={{ fontSize: 9, color: "hsl(0, 0%, 50%)", fontWeight: 500 }}>
              H:{Math.round(weather.daily.maxTemp)}° L:{Math.round(weather.daily.minTemp)}°
            </span>
            <div style={{
              flex: 1,
              height: 2,
              borderRadius: 1,
              background: "hsla(0, 0%, 0%, 0.05)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                background: "linear-gradient(90deg, hsl(130, 45%, 50%), hsl(200, 50%, 55%))",
                animation: "weatherTimer 15s linear forwards",
                borderRadius: 1,
              }} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes weatherIconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes weatherTimer {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default WeatherPopup;
