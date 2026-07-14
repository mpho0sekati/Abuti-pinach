import { useEffect, useRef } from "react";
import { useSavedLocations } from "./useSavedLocations";
import { useNotificationSettings, isWithinQuietHours } from "./useNotificationSettings";
import { buildWeatherAlert, fetchWeatherFor } from "@/utils/weatherAlerts";

const POLL_MS = 15 * 60 * 1000;
const TAG_STORE_KEY = "abuti_multi_loc_tags";

function loadTags(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(TAG_STORE_KEY) || "{}"); } catch { return {}; }
}
function saveTags(tags: Record<string, string>) {
  localStorage.setItem(TAG_STORE_KEY, JSON.stringify(tags));
}

export function useMultiLocationAlerts() {
  const { locations } = useSavedLocations();
  const { settings } = useNotificationSettings();
  const tagsRef = useRef<Record<string, string>>(loadTags());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const active = locations.filter(l => l.alertsEnabled);
    if (active.length === 0) return;

    let cancelled = false;

    const checkOne = async (loc: typeof active[number]) => {
      try {
        const weather = await fetchWeatherFor(loc.latitude, loc.longitude, loc.label);
        if (cancelled) return;
        const summary = buildWeatherAlert(weather);
        if (!summary) return;
        if (summary.level === "severe" && !settings.severeEnabled) return;
        if (summary.level === "moderate" && !settings.moderateEnabled) return;

        const quiet = isWithinQuietHours(settings);
        if (quiet && !(summary.level === "severe" && settings.bypassQuietForSevere)) return;

        const key = `${loc.id}`;
        if (tagsRef.current[key] === summary.tag) return;
        tagsRef.current[key] = summary.tag;
        saveTags(tagsRef.current);

        const n = new Notification(summary.title, {
          body: summary.body,
          tag: summary.tag,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          requireInteraction: summary.level === "severe",
          silent: !settings.sound || quiet,
        });
        n.onclick = () => { window.focus(); n.close(); };
        if (settings.vibrate && "vibrate" in navigator && !quiet) {
          navigator.vibrate(summary.level === "severe" ? [300, 120, 300, 120, 300] : [200, 100, 200]);
        }
      } catch { /* network or parse error — try again next tick */ }
    };

    const runAll = () => { active.forEach(checkOne); };
    // initial check after short delay to let UI settle
    const initial = setTimeout(runAll, 4000);
    const interval = setInterval(runAll, POLL_MS);
    return () => { cancelled = true; clearTimeout(initial); clearInterval(interval); };
  }, [locations, settings]);
}
