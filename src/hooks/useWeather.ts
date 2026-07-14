import { useState, useCallback, useRef, useEffect } from "react";
import { setCache, getCache } from "@/utils/offlineCache";

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
  daily: {
    maxTemp: number;
    minTemp: number;
    precipitationSum: number;
    precipitationProbability: number;
  };
  locationName: string;
  latitude: number;
  longitude: number;
}

const weatherCodeToDescription = (code: number): string => {
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
  };
  return map[code] || "Unknown";
};

export type WeatherStatus = "idle" | "requesting" | "loading" | "granted" | "denied" | "error";

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [status, setStatus] = useState<WeatherStatus>("idle");
  const [error, setError] = useState<string>("");
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setStatus("loading");
    try {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=1`
      );
      const weatherData = await weatherRes.json();

      const current = weatherData.current;
      const daily = weatherData.daily;

      const data: WeatherData = {
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        description: weatherCodeToDescription(current.weather_code),
        daily: {
          maxTemp: daily.temperature_2m_max[0],
          minTemp: daily.temperature_2m_min[0],
          precipitationSum: daily.precipitation_sum[0],
          precipitationProbability: daily.precipitation_probability_max[0],
        },
        locationName: weatherData.timezone?.split("/").pop()?.replace(/_/g, " ") || "your area",
        latitude: lat,
        longitude: lon,
      };

      setWeather(data);
      setStatus("granted");
      coordsRef.current = { lat, lon };
      // Cache the successful result
      setCache("weather", "last_weather", data);
    } catch (e) {
      // Check cache on failure
      const cached = await getCache("weather", "last_weather");
      if (cached) {
        setWeather(cached);
        setStatus("granted");
        coordsRef.current = { lat: cached.latitude, lon: cached.longitude };
        setError("Offline - using cached weather");
      } else {
        setError("Couldn't fetch weather data");
        setStatus("error");
      }
    }
  }, []);

  // Auto-refresh weather every 15 minutes
  useEffect(() => {
    if (!coordsRef.current) return;
    refreshIntervalRef.current = setInterval(() => {
      if (coordsRef.current) {
        fetchWeather(coordsRef.current.lat, coordsRef.current.lon);
      }
    }, 15 * 60 * 1000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [fetchWeather, status]);

  const requestLocation = useCallback(async () => {
    // Try to load from cache first for immediate UI
    const cached = await getCache("weather", "last_weather");
    if (cached && !weather) {
      setWeather(cached);
      setStatus("granted");
    }

    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setStatus("error");
      return;
    }
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      async () => {
        if (cached) {
          setStatus("granted");
        } else {
          setStatus("denied");
          setError("Location access denied");
        }
      },
      { timeout: 10000 }
    );
  }, [fetchWeather, weather]);

  return { weather, status, error, requestLocation };
}
