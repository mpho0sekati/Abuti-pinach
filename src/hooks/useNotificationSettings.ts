import { useEffect, useState, useCallback } from "react";

export type NotificationSettings = {
  severeEnabled: boolean;
  moderateEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string; // "HH:mm"
  quietEnd: string;   // "HH:mm"
  bypassQuietForSevere: boolean;
  vibrate: boolean;
  sound: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  severeEnabled: true,
  moderateEnabled: true,
  quietHoursEnabled: false,
  quietStart: "22:00",
  quietEnd: "06:00",
  bypassQuietForSevere: true,
  vibrate: true,
  sound: true,
};

const KEY = "abuti_notif_settings_v1";
const EVENT = "abuti:notif-settings-changed";

export function loadNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
  } catch { return DEFAULT_NOTIFICATION_SETTINGS; }
}

export function saveNotificationSettings(s: NotificationSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: s }));
}

export function isWithinQuietHours(s: NotificationSettings, now = new Date()): boolean {
  if (!s.quietHoursEnabled) return false;
  const [sh, sm] = s.quietStart.split(":").map(Number);
  const [eh, em] = s.quietEnd.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // overnight window
}

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(() => loadNotificationSettings());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as NotificationSettings | undefined;
      setSettings(detail ?? loadNotificationSettings());
    };
    const storage = (e: StorageEvent) => { if (e.key === KEY) setSettings(loadNotificationSettings()); };
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", storage);
    };
  }, []);

  const update = useCallback((patch: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveNotificationSettings(next);
      return next;
    });
  }, []);

  return { settings, update };
}
