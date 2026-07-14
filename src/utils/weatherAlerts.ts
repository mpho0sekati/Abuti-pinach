import type { WeatherData } from "@/hooks/useWeather";

export type AlertLevel = "none" | "moderate" | "severe";

export type WeatherAlertSummary = {
  title: string;
  body: string;
  tag: string;
  level: AlertLevel;
};

export function buildWeatherAlert(weather: WeatherData): WeatherAlertSummary | null {
  const { windSpeed, weatherCode, daily, locationName } = weather;
  const reasons: string[] = [];
  let severe = false;
  let moderate = false;

  if ([95, 96, 99].includes(weatherCode)) { reasons.push("Thunderstorm"); severe = true; }
  if (weatherCode === 82) { reasons.push("Violent rain — flood risk"); severe = true; }
  if ([63, 65, 81].includes(weatherCode)) { reasons.push("Heavy rain"); moderate = true; }
  if (daily.precipitationSum >= 50) { reasons.push(`${Math.round(daily.precipitationSum)}mm rain expected`); severe = true; }
  if (windSpeed >= 90) { reasons.push(`Destructive wind ${Math.round(windSpeed)} km/h`); severe = true; }
  else if (windSpeed >= 60) { reasons.push(`Gale-force wind ${Math.round(windSpeed)} km/h`); severe = true; }
  else if (windSpeed >= 40) { reasons.push(`Strong wind ${Math.round(windSpeed)} km/h`); moderate = true; }
  if (daily.maxTemp >= 42) { reasons.push(`Extreme heat ${Math.round(daily.maxTemp)}°C`); severe = true; }
  else if (daily.maxTemp >= 35) { reasons.push(`Heat warning ${Math.round(daily.maxTemp)}°C`); moderate = true; }
  if (daily.minTemp <= 0) { reasons.push(`Freeze ${Math.round(daily.minTemp)}°C`); severe = true; }
  else if (daily.minTemp <= 3) { reasons.push(`Frost risk ${Math.round(daily.minTemp)}°C`); moderate = true; }
  if ([96, 99].includes(weatherCode)) { reasons.push("Hail damage risk"); severe = true; }
  if ([45, 48].includes(weatherCode)) { reasons.push("Dense fog"); moderate = true; }
  if (daily.maxTemp >= 32 && daily.precipitationSum === 0 && daily.precipitationProbability <= 10) {
    reasons.push("Drought conditions"); moderate = true;
  }

  if (reasons.length === 0) return null;
  const level: AlertLevel = severe ? "severe" : moderate ? "moderate" : "none";
  if (level === "none") return null;
  const title = severe ? `⚠️ Severe weather — ${locationName}` : `Weather warning — ${locationName}`;
  const body = `${reasons.slice(0, 3).join(" · ")}. Tap to see what to do now.`;
  const tag = `weather:${locationName}:${weatherCode}:${Math.round(daily.maxTemp)}:${Math.round(daily.minTemp)}:${Math.round(windSpeed)}:${Math.round(daily.precipitationSum)}`;
  return { title, body, tag, level };
}

const codeToDesc: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

export async function fetchWeatherFor(lat: number, lon: number, label?: string): Promise<WeatherData> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=1`
  );
  const data = await res.json();
  const c = data.current, d = data.daily;
  return {
    temperature: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    weatherCode: c.weather_code,
    description: codeToDesc[c.weather_code] || "Unknown",
    daily: {
      maxTemp: d.temperature_2m_max[0],
      minTemp: d.temperature_2m_min[0],
      precipitationSum: d.precipitation_sum[0],
      precipitationProbability: d.precipitation_probability_max[0],
    },
    locationName: label || data.timezone?.split("/").pop()?.replace(/_/g, " ") || "your area",
    latitude: lat,
    longitude: lon,
  };
}

export type GeocodeHit = { name: string; admin1?: string; country?: string; latitude: number; longitude: number };

export async function geocodeLocation(query: string): Promise<GeocodeHit[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
  );
  const data = await res.json();
  return (data.results || []).map((r: any) => ({
    name: r.name, admin1: r.admin1, country: r.country, latitude: r.latitude, longitude: r.longitude,
  }));
}
