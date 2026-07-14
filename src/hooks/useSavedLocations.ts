import { useCallback, useEffect, useState } from "react";

export type SavedLocation = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  alertsEnabled: boolean;
  isPrimary?: boolean;
};

const KEY = "abuti_saved_locations_v1";
const EVENT = "abuti:saved-locations-changed";

function load(): SavedLocation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persist(next: SavedLocation[]) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function useSavedLocations() {
  const [locations, setLocations] = useState<SavedLocation[]>(() => load());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as SavedLocation[] | undefined;
      setLocations(detail ?? load());
    };
    const storage = (e: StorageEvent) => { if (e.key === KEY) setLocations(load()); };
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", storage);
    };
  }, []);

  const addLocation = useCallback((loc: Omit<SavedLocation, "id">) => {
    setLocations(prev => {
      // dedupe by rounded coords
      const exists = prev.find(p =>
        Math.abs(p.latitude - loc.latitude) < 0.01 && Math.abs(p.longitude - loc.longitude) < 0.01
      );
      if (exists) return prev;
      const next = [...prev, { ...loc, id: crypto.randomUUID() }];
      persist(next);
      return next;
    });
  }, []);

  const updateLocation = useCallback((id: string, patch: Partial<SavedLocation>) => {
    setLocations(prev => {
      const next = prev.map(l => l.id === id ? { ...l, ...patch } : l);
      persist(next);
      return next;
    });
  }, []);

  const removeLocation = useCallback((id: string) => {
    setLocations(prev => {
      const next = prev.filter(l => l.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const setPrimary = useCallback((id: string) => {
    setLocations(prev => {
      const next = prev.map(l => ({ ...l, isPrimary: l.id === id }));
      persist(next);
      return next;
    });
  }, []);

  return { locations, addLocation, updateLocation, removeLocation, setPrimary };
}
