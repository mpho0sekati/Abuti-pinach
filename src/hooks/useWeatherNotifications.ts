import { useEffect, useRef, useState, useCallback } from "react";
import type { WeatherData } from "./useWeather";
import type { WeatherAlertLevel } from "@/components/OrbController";
import { useNotificationSettings, isWithinQuietHours } from "./useNotificationSettings";


const PERM_KEY = "abuti_notif_perm_asked";
const LAST_ALERT_KEY = "abuti_last_weather_alert";

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

function buildAlertSummary(weather: WeatherData): { title: string; body: string; tag: string } | null {
  const { temperature, windSpeed, humidity, weatherCode, daily, locationName } = weather;
  const reasons: string[] = [];
  let severe = false;

  if ([95, 96, 99].includes(weatherCode)) { reasons.push("Thunderstorm"); severe = true; }
  if (weatherCode === 82) { reasons.push("Violent rain — flood risk"); severe = true; }
  if ([63, 65, 81].includes(weatherCode)) reasons.push("Heavy rain");
  if (daily.precipitationSum >= 50) { reasons.push(`${Math.round(daily.precipitationSum)}mm rain expected`); severe = true; }
  if (windSpeed >= 90) { reasons.push(`Destructive wind ${Math.round(windSpeed)} km/h`); severe = true; }
  else if (windSpeed >= 60) { reasons.push(`Gale-force wind ${Math.round(windSpeed)} km/h`); severe = true; }
  else if (windSpeed >= 40) reasons.push(`Strong wind ${Math.round(windSpeed)} km/h`);
  if (daily.maxTemp >= 42) { reasons.push(`Extreme heat ${Math.round(daily.maxTemp)}°C`); severe = true; }
  else if (daily.maxTemp >= 35) reasons.push(`Heat warning ${Math.round(daily.maxTemp)}°C`);
  if (daily.minTemp <= 0) { reasons.push(`Freeze ${Math.round(daily.minTemp)}°C`); severe = true; }
  else if (daily.minTemp <= 3) reasons.push(`Frost risk ${Math.round(daily.minTemp)}°C`);
  if ([96, 99].includes(weatherCode)) { reasons.push("Hail damage risk"); severe = true; }
  if ([45, 48].includes(weatherCode)) reasons.push("Dense fog");
  if (daily.maxTemp >= 32 && daily.precipitationSum === 0 && daily.precipitationProbability <= 10) reasons.push("Drought conditions");

  if (reasons.length === 0) return null;
  const title = severe ? `⚠️ Severe weather — ${locationName}` : `Weather warning — ${locationName}`;
  const body = `${reasons.slice(0, 3).join(" · ")}. Tap to see what to do now.`;
  const tag = `weather:${weatherCode}:${Math.round(daily.maxTemp)}:${Math.round(daily.minTemp)}:${Math.round(windSpeed)}:${Math.round(daily.precipitationSum)}`;
  return { title, body, tag };
}

export function useWeatherNotifications(weather: WeatherData | null, alertLevel: WeatherAlertLevel) {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<NotifPermission>(
    supported ? (Notification.permission as NotifPermission) : "unsupported"
  );
  const lastTagRef = useRef<string>(typeof window !== "undefined" ? localStorage.getItem(LAST_ALERT_KEY) || "" : "");
  const { settings } = useNotificationSettings();

  const requestPermission = useCallback(async () => {
    if (!supported) return "unsupported" as NotifPermission;
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotifPermission);
      localStorage.setItem(PERM_KEY, "1");
      return result as NotifPermission;
    } catch {
      return "denied" as NotifPermission;
    }
  }, [supported]);

  // Auto-prompt once when weather first loads (avoids prompting too early).
  useEffect(() => {
    if (!supported || !weather) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(PERM_KEY)) return;
    const id = setTimeout(() => { requestPermission(); }, 8000);
    return () => clearTimeout(id);
  }, [supported, weather, requestPermission]);

  // Fire notification on alert
  useEffect(() => {
    if (!supported || permission !== "granted" || !weather) return;
    if (alertLevel === "none") return;
    // Respect per-severity preferences
    if (alertLevel === "severe" && !settings.severeEnabled) return;
    if (alertLevel === "moderate" && !settings.moderateEnabled) return;
    // Quiet hours (severe can bypass)
    const quiet = isWithinQuietHours(settings);
    if (quiet && !(alertLevel === "severe" && settings.bypassQuietForSevere)) return;

    const summary = buildAlertSummary(weather);
    if (!summary) return;
    if (summary.tag === lastTagRef.current) return;
    lastTagRef.current = summary.tag;
    localStorage.setItem(LAST_ALERT_KEY, summary.tag);

    try {
      const n = new Notification(summary.title, {
        body: summary.body,
        tag: summary.tag,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        requireInteraction: alertLevel === "severe",
        silent: !settings.sound || quiet,
      });
      n.onclick = () => { window.focus(); n.close(); };
      if (settings.vibrate && "vibrate" in navigator && !quiet) {
        navigator.vibrate(alertLevel === "severe" ? [300, 120, 300, 120, 300] : [200, 100, 200]);
      }
    } catch {}
  }, [supported, permission, weather, alertLevel, settings]);

  return { supported, permission, requestPermission };
}

