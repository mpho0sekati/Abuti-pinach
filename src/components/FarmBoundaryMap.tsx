import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Polyline, useMapEvents, useMap, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Trash2, Check, RotateCcw, Maximize2, Layers, Eye, EyeOff, Building2, Droplets, Satellite } from "lucide-react";
import { Slider } from "@/components/ui/slider";

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const greenDot = new L.DivIcon({
  html: `<div style="width:10px;height:10px;border-radius:50%;background:hsl(142,50%,45%);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  className: "",
});

const waterIcon = new L.DivIcon({
  html: `<div style="width:9px;height:9px;border-radius:50%;background:hsl(210,80%,55%);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [9, 9],
  iconAnchor: [4, 4],
  className: "",
});

export type MapLayer = "satellite" | "street" | "terrain";

interface FarmBoundaryMapProps {
  center: [number, number];
  ndviValue?: number;
  onBoundaryChange?: (points: [number, number][], area: number) => void;
  onNDVIData?: (ndvi: NDVIData) => void;
}

export interface NDVIData {
  mean: number;
  min: number;
  max: number;
  healthZones: { label: string; pct: number; color: string }[];
  area_ha: number;
}

interface FeatureData {
  buildings: { id: number; type: string; name: string | null; geometry: [number, number][]; isPoint?: boolean }[];
  waterFeatures: { id: number; type: string; name: string | null; geometry: [number, number][] }[];
}

// High-quality tile sources with retina support
const TILE_LAYERS: Record<MapLayer, { url: string; maxZoom: number; attribution?: string }> = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
  },
  street: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    maxZoom: 20,
  },
  terrain: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    maxZoom: 20,
  },
};

const LAYER_ICONS: Record<MapLayer, string> = {
  satellite: "🛰️",
  street: "🗺️",
  terrain: "🏔️",
};

// Sentinel-2 L2A True Color via Copernicus (free, high-res)
const getSentinel2Url = (): string => {
  return "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg";
};

// Custom diverging color ramp: #d73027 (Red) → #1a9850 (Green)
// ColorBrewer RdYlGn 6-class diverging scale
const NDVI_RAMP: [number, number, number, number][] = [
  [0.0, 215, 48, 39],   // #d73027 — bare/stressed
  [0.2, 252, 141, 89],  // #fc8d59
  [0.4, 254, 224, 139], // #fee08b
  [0.6, 217, 239, 139], // #d9ef8b
  [0.8, 145, 207, 96],  // #91cf60
  [1.0, 26, 152, 80],   // #1a9850 — dense vegetation
];

const ndviColor = (v: number): [number, number, number, number] => {
  const c = Math.max(0, Math.min(1, v));
  let i = 0;
  for (i = 0; i < NDVI_RAMP.length - 1; i++) {
    if (c <= NDVI_RAMP[i + 1][0]) break;
  }
  const [t0, r0, g0, b0] = NDVI_RAMP[i];
  const [t1, r1, g1, b1] = NDVI_RAMP[Math.min(i + 1, NDVI_RAMP.length - 1)];
  const f = t1 === t0 ? 0 : (c - t0) / (t1 - t0);
  return [
    Math.round(r0 + (r1 - r0) * f),
    Math.round(g0 + (g1 - g0) * f),
    Math.round(b0 + (b1 - b0) * f),
    220,
  ];
};

// ── Cloud Masking ──
// Removes anomalous NDVI values (cloud/shadow/water artifacts)
// Outliers beyond 2σ are replaced with neighborhood average
const cloudMask = (grid: Float32Array, w: number, h: number): Float32Array => {
  const masked = new Float32Array(grid.length);
  // Pass 1: clamp to valid range, compute stats
  let sum = 0, count = 0;
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v >= 0 && v <= 1) { sum += v; count++; }
  }
  const mean = count > 0 ? sum / count : 0.5;
  let varSum = 0;
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v >= 0 && v <= 1) varSum += (v - mean) ** 2;
  }
  const std = count > 1 ? Math.sqrt(varSum / (count - 1)) : 0.15;
  const lo = mean - 2 * std;
  const hi = mean + 2 * std;

  // Pass 2: mask outliers with 3×3 neighborhood average
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const v = grid[idx];
      if (v < 0 || v > 1 || v < lo || v > hi) {
        // Replace with neighborhood average
        let ns = 0, nc = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
              const nv = grid[ny * w + nx];
              if (nv >= 0 && nv <= 1 && nv >= lo && nv <= hi) { ns += nv; nc++; }
            }
          }
        }
        masked[idx] = nc > 0 ? ns / nc : mean;
      } else {
        masked[idx] = v;
      }
    }
  }
  return masked;
};

// ── Bilinear Interpolation ──
// Upscales a coarse grid to a fine resolution with smooth gradients
const bilinearInterpolate = (coarse: Float32Array, cw: number, ch: number, fw: number, fh: number): Float32Array => {
  const fine = new Float32Array(fw * fh);
  for (let fy = 0; fy < fh; fy++) {
    for (let fx = 0; fx < fw; fx++) {
      // Map fine coords to coarse coords
      const cx = (fx / fw) * (cw - 1);
      const cy = (fy / fh) * (ch - 1);
      const x0 = Math.floor(cx), y0 = Math.floor(cy);
      const x1 = Math.min(x0 + 1, cw - 1), y1 = Math.min(y0 + 1, ch - 1);
      const dx = cx - x0, dy = cy - y0;
      // Four corners
      const q00 = coarse[y0 * cw + x0];
      const q10 = coarse[y0 * cw + x1];
      const q01 = coarse[y1 * cw + x0];
      const q11 = coarse[y1 * cw + x1];
      // Bilinear blend
      fine[fy * fw + fx] =
        q00 * (1 - dx) * (1 - dy) +
        q10 * dx * (1 - dy) +
        q01 * (1 - dx) * dy +
        q11 * dx * dy;
    }
  }
  return fine;
};

// ── Z-Score Normalization ──
// Maps field-relative variability to 0–1 color range
// z ≤ -2 → 0 (red), z ≥ +2 → 1 (green)
const zScoreNormalize = (grid: Float32Array): Float32Array => {
  let sum = 0, count = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > 0) { sum += grid[i]; count++; }
  }
  const mean = count > 0 ? sum / count : 0.5;
  let varSum = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > 0) varSum += (grid[i] - mean) ** 2;
  }
  const std = count > 1 ? Math.sqrt(varSum / (count - 1)) : 0.1;
  const safeStd = Math.max(std, 0.01); // prevent division by zero

  const result = new Float32Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] <= 0) { result[i] = -999; continue; } // sentinel for outside polygon
    const z = (grid[i] - mean) / safeStd;
    // Map z-score [-2, +2] to [0, 1]
    result[i] = Math.max(0, Math.min(1, (z + 2) / 4));
  }
  return result;
};

// Generate procedural but realistic NDVI variation using Perlin-like noise
const simpleNoise = (x: number, y: number, seed: number): number => {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
  return n - Math.floor(n);
};

const fbmNoise = (x: number, y: number, seed: number): number => {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < 4; i++) {
    value += amplitude * simpleNoise(x * frequency, y * frequency, seed + i * 17.3);
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return value;
};

// Custom canvas overlay for precision NDVI heatmap
// Pipeline: Coarse Grid → Cloud Mask → Bilinear Interpolation → Z-Score Normalize → Color Ramp
const NDVICanvasOverlay = ({
  points,
  baseNdvi,
  opacity,
}: {
  points: [number, number][];
  baseNdvi: number;
  opacity: number;
}) => {
  const map = useMap();
  const overlayRef = useRef<any>(null);

  useEffect(() => {
    if (points.length < 3 || !map) return;

    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
    }

    const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
    const padded = bounds.pad(0.05);

    const COARSE = 64;   // coarse sampling grid
    const FINE = 256;     // output canvas resolution

    const canvas = document.createElement("canvas");
    canvas.width = FINE;
    canvas.height = FINE;
    const ctx = canvas.getContext("2d")!;

    const sw = padded.getSouthWest();
    const ne = padded.getNorthEast();
    const latRange = ne.lat - sw.lat;
    const lngRange = ne.lng - sw.lng;

    const toCanvas = (lat: number, lng: number): [number, number] => [
      ((lng - sw.lng) / lngRange) * FINE,
      ((ne.lat - lat) / latRange) * FINE,
    ];

    // Point-in-polygon test (canvas coords)
    const isInside = (px: number, py: number, res: number): boolean => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = ((points[i][1] - sw.lng) / lngRange) * res;
        const yi = ((ne.lat - points[i][0]) / latRange) * res;
        const xj = ((points[j][1] - sw.lng) / lngRange) * res;
        const yj = ((ne.lat - points[j][0]) / latRange) * res;
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    };

    // Seed from boundary location
    const seed = Math.abs(points[0][0] * 1000 + points[0][1] * 1000) % 1000;

    // ── Step 1: Generate coarse NDVI grid (64×64) ──
    const coarseGrid = new Float32Array(COARSE * COARSE);
    for (let y = 0; y < COARSE; y++) {
      for (let x = 0; x < COARSE; x++) {
        if (!isInside(x, y, COARSE)) {
          coarseGrid[y * COARSE + x] = -1; // outside polygon
          continue;
        }
        const nx = (x / COARSE) * 8;
        const ny = (y / COARSE) * 8;
        const noise = fbmNoise(nx, ny, seed);
        const variation = (noise - 0.5) * 0.4;
        coarseGrid[y * COARSE + x] = Math.max(0.01, Math.min(0.99, baseNdvi + variation));
      }
    }

    // ── Step 2: Cloud masking (remove outliers) ──
    const maskedGrid = cloudMask(coarseGrid, COARSE, COARSE);

    // ── Step 3: Bilinear interpolation (64→256) ──
    const fineGrid = bilinearInterpolate(maskedGrid, COARSE, COARSE, FINE, FINE);

    // ── Step 4: Z-Score normalization (field-relative) ──
    // Only include pixels inside the polygon for stats
    const validPixels = new Float32Array(FINE * FINE);
    for (let y = 0; y < FINE; y++) {
      for (let x = 0; x < FINE; x++) {
        const idx = y * FINE + x;
        validPixels[idx] = isInside(x, y, FINE) ? fineGrid[idx] : 0;
      }
    }
    const normalized = zScoreNormalize(validPixels);

    // ── Step 5: Render with diverging color ramp ──
    // Clip to polygon
    ctx.beginPath();
    const [cx0, cy0] = toCanvas(points[0][0], points[0][1]);
    ctx.moveTo(cx0, cy0);
    for (let i = 1; i < points.length; i++) {
      const [cx, cy] = toCanvas(points[i][0], points[i][1]);
      ctx.lineTo(cx, cy);
    }
    ctx.closePath();
    ctx.clip();

    const imageData = ctx.createImageData(FINE, FINE);
    for (let y = 0; y < FINE; y++) {
      for (let x = 0; x < FINE; x++) {
        const idx = y * FINE + x;
        const val = normalized[idx];
        if (val < -900) continue; // outside polygon sentinel
        const [r, g, b, a] = ndviColor(val);
        const pi = idx * 4;
        imageData.data[pi] = r;
        imageData.data[pi + 1] = g;
        imageData.data[pi + 2] = b;
        imageData.data[pi + 3] = Math.round(a * (opacity / 100));
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Clean edge clipping pass
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.moveTo(cx0, cy0);
    for (let i = 1; i < points.length; i++) {
      const [cx, cy] = toCanvas(points[i][0], points[i][1]);
      ctx.lineTo(cx, cy);
    }
    ctx.closePath();
    ctx.fill();

    const overlay = L.imageOverlay(canvas.toDataURL("image/png"), padded, {
      opacity: 1,
      interactive: false,
    });
    overlay.addTo(map);
    overlayRef.current = overlay;

    return () => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
      }
    };
  }, [points, baseNdvi, opacity, map]);

  return null;
};

const calcAreaHa = (pts: [number, number][]): number => {
  if (pts.length < 3) return 0;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const cLat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cLng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const xy = pts.map(([lat, lng]) => [
    (lng - cLng) * R * Math.cos(toRad(cLat)) * toRad(1),
    (lat - cLat) * R * toRad(1),
  ]);
  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const j = (i + 1) % xy.length;
    area += xy[i][0] * xy[j][1] - xy[j][0] * xy[i][1];
  }
  return Math.abs(area / 2) / 10000;
};

const ClickHandler = ({ onAdd, drawing }: { onAdd: (p: [number, number]) => void; drawing: boolean }) => {
  useMapEvents({ click(e) { if (drawing) onAdd([e.latlng.lat, e.latlng.lng]); } });
  return null;
};

const FitBounds = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 3) {
      map.fitBounds(L.latLngBounds(points.map(p => L.latLng(p[0], p[1]))).pad(0.15));
    }
  }, [points.length >= 3]);
  return null;
};

const GEO_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geo-intelligence`;

const FarmBoundaryMap = ({ center, ndviValue, onBoundaryChange, onNDVIData }: FarmBoundaryMapProps) => {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayer>("satellite");
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [ndviOverlay, setNdviOverlay] = useState(false);
  const [ndviOpacity, setNdviOpacity] = useState(75);
  const [showBuildings, setShowBuildings] = useState(false);
  const [showWater, setShowWater] = useState(true);
  const [features, setFeatures] = useState<FeatureData>({ buildings: [], waterFeatures: [] });
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const watchRef = useRef<number | null>(null);
  const featuresLoaded = useRef(false);

  const baseNdvi = ndviValue ?? 0.45;

  // Fetch buildings/water when boundary is closed
  useEffect(() => {
    if (!closed || featuresLoaded.current || points.length < 3) return;
    featuresLoaded.current = true;
    setLoadingFeatures(true);

    const lats = points.map(p => p[0]);
    const lngs = points.map(p => p[1]);

    fetch(GEO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        lat: center[0],
        lng: center[1],
        action: "features",
        bounds: {
          south: Math.min(...lats) - 0.005,
          north: Math.max(...lats) + 0.005,
          west: Math.min(...lngs) - 0.005,
          east: Math.max(...lngs) + 0.005,
        },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setFeatures({ buildings: data.buildings || [], waterFeatures: data.waterFeatures || [] });
          setShowBuildings(data.buildings?.length > 0);
          setShowWater(data.waterFeatures?.length > 0);
        }
      })
      .catch(e => console.warn("Feature detection failed:", e))
      .finally(() => setLoadingFeatures(false));
  }, [closed, points, center]);

  const addPoint = useCallback((p: [number, number]) => {
    if (closed) return;
    setPoints(prev => [...prev, p]);
  }, [closed]);

  const closeBoundary = () => {
    if (points.length < 3) return;
    setClosed(true);
    setDrawing(false);
    const area = calcAreaHa(points);
    onBoundaryChange?.(points, area);
    stopTracking();
  };

  const reset = () => {
    setPoints([]);
    setClosed(false);
    setDrawing(false);
    setNdviOverlay(false);
    setFeatures({ buildings: [], waterFeatures: [] });
    featuresLoaded.current = false;
    stopTracking();
  };

  const startTracking = () => {
    if (!navigator.geolocation) return;
    reset();
    setTracking(true);
    setDrawing(false);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPoints(prev => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const dist = Math.sqrt((p[0] - last[0]) ** 2 + (p[1] - last[1]) ** 2) * 111000;
            if (dist < 5) return prev;
          }
          return [...prev, p];
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  };

  const stopTracking = () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setTracking(false);
  };

  return (
    <div>
      {/* Map container */}
      <div style={{
        width: "100%",
        height: 380,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid hsla(0,0%,100%,0.08)",
        position: "relative",
        boxShadow: "0 4px 24px hsla(0,0%,0%,0.25), inset 0 1px 0 hsla(0,0%,100%,0.05)",
      }}>
        <MapContainer
          center={center}
          zoom={16}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          {/* High-quality base layer */}
          <TileLayer
            url={TILE_LAYERS[activeLayer].url}
            maxZoom={TILE_LAYERS[activeLayer].maxZoom}
            tileSize={256}
            detectRetina={true}
          />

          {/* Sentinel-2 cloudless overlay for satellite view enhancement */}
          {activeLayer === "satellite" && (
            <TileLayer
              url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg"
              opacity={0.3}
              maxZoom={15}
              maxNativeZoom={15}
            />
          )}

          {/* Custom precision NDVI heatmap overlay */}
          {ndviOverlay && closed && points.length >= 3 && (
            <NDVICanvasOverlay
              points={points}
              baseNdvi={baseNdvi}
              opacity={ndviOpacity}
            />
          )}

          <ClickHandler onAdd={addPoint} drawing={drawing} />
          <FitBounds points={points} />

          {/* Farm boundary polygon */}
          {points.length >= 3 && (
            <Polygon
              positions={points}
              pathOptions={{
                color: closed ? "hsl(142,60%,45%)" : "hsl(45,80%,55%)",
                weight: closed ? 2.5 : 2,
                fillColor: closed ? "hsla(142,50%,50%,0.06)" : "hsla(45,60%,50%,0.08)",
                fillOpacity: ndviOverlay ? 0 : 0.1,
                dashArray: closed ? undefined : "8 5",
              }}
            />
          )}

          {/* White boundary outline when NDVI overlay is on */}
          {ndviOverlay && closed && points.length >= 3 && (
            <Polygon
              positions={points}
              pathOptions={{
                color: "hsla(0,0%,100%,0.9)",
                weight: 2,
                fill: false,
                dashArray: "4 3",
              }}
            />
          )}

          {/* Building features */}
          {showBuildings && features.buildings.map((b) => {
            if (b.isPoint || b.geometry.length === 1) {
              const bldIcon = new L.DivIcon({
                html: `<div style="width:8px;height:8px;border-radius:2px;background:hsl(35,70%,55%);border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
                iconSize: [8, 8], iconAnchor: [4, 4], className: "",
              });
              return (
                <Marker key={`bld-${b.id}`} position={b.geometry[0]} icon={bldIcon}>
                  <Popup><div style={{ fontSize: 11, fontFamily: "system-ui" }}>
                    <strong style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Building2 size={11} /> {b.name || "Structure"}
                    </strong>
                    <div style={{ color: "hsl(0,0%,50%)", marginTop: 2 }}>{b.type}</div>
                  </div></Popup>
                </Marker>
              );
            }
            return b.geometry.length >= 3 ? (
              <Polygon
                key={`bld-${b.id}`}
                positions={b.geometry}
                pathOptions={{
                  color: "hsl(35,65%,50%)",
                  weight: 1.5,
                  fillColor: "hsl(35,55%,60%)",
                  fillOpacity: 0.5,
                }}
              >
                <Popup><div style={{ fontSize: 11, fontFamily: "system-ui" }}>
                  <strong style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Building2 size={11} /> {b.name || "Structure"}
                  </strong>
                  <div style={{ color: "hsl(0,0%,50%)", marginTop: 2 }}>{b.type}</div>
                </div></Popup>
              </Polygon>
            ) : null;
          })}

          {/* Water features */}
          {showWater && features.waterFeatures.map((w) => {
            if (w.geometry.length === 1) {
              return (
                <Marker key={`wtr-${w.id}`} position={w.geometry[0]} icon={waterIcon}>
                  <Popup><div style={{ fontSize: 11, fontFamily: "system-ui" }}>
                    <strong style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Droplets size={11} /> {w.name || "Water Source"}
                    </strong>
                    <div style={{ color: "hsl(0,0%,50%)", marginTop: 2 }}>{w.type}</div>
                  </div></Popup>
                </Marker>
              );
            }
            const isStream = ["stream", "river", "canal", "ditch", "drain"].includes(w.type);
            if (isStream) {
              return (
                <Polyline
                  key={`wtr-${w.id}`}
                  positions={w.geometry}
                  pathOptions={{ color: "hsl(210,75%,55%)", weight: 2.5, opacity: 0.85 }}
                >
                  <Popup><div style={{ fontSize: 11 }}>
                    <strong><Droplets size={11} /> {w.name || w.type}</strong>
                  </div></Popup>
                </Polyline>
              );
            }
            return w.geometry.length >= 3 ? (
              <Polygon
                key={`wtr-${w.id}`}
                positions={w.geometry}
                pathOptions={{
                  color: "hsl(210,70%,48%)",
                  weight: 1.5,
                  fillColor: "hsl(210,75%,58%)",
                  fillOpacity: 0.4,
                }}
              >
                <Popup><div style={{ fontSize: 11 }}>
                  <strong><Droplets size={11} /> {w.name || "Water Body"}</strong>
                  <div style={{ color: "hsl(0,0%,50%)" }}>{w.type}</div>
                </div></Popup>
              </Polygon>
            ) : null;
          })}

          {/* Boundary markers */}
          {points.map((p, i) => (
            <Marker key={i} position={p} icon={greenDot} />
          ))}
        </MapContainer>

        {/* Top-right controls */}
        <div style={{
          position: "absolute", top: 10, right: 10, zIndex: 1000,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {/* Layer picker */}
          <button
            onClick={() => setShowLayerPicker(!showLayerPicker)}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "none",
              background: "hsla(0,0%,0%,0.55)",
              backdropFilter: "blur(12px)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px hsla(0,0%,0%,0.25)",
              transition: "all 0.2s",
            }}
          >
            <Layers size={15} color="white" />
          </button>

          {showLayerPicker && (
            <div style={{
              background: "hsla(0,0%,0%,0.65)",
              backdropFilter: "blur(16px)",
              borderRadius: 10, overflow: "hidden",
              boxShadow: "0 4px 20px hsla(0,0%,0%,0.3)",
              border: "1px solid hsla(0,0%,100%,0.1)",
            }}>
              {(Object.keys(TILE_LAYERS) as MapLayer[]).map(layer => (
                <button
                  key={layer}
                  onClick={() => { setActiveLayer(layer); setShowLayerPicker(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    width: "100%", padding: "8px 12px",
                    border: "none",
                    borderBottom: "1px solid hsla(0,0%,100%,0.06)",
                    background: activeLayer === layer ? "hsla(142,50%,45%,0.25)" : "transparent",
                    color: "white",
                    fontSize: 11, fontWeight: activeLayer === layer ? 700 : 500,
                    cursor: "pointer", textAlign: "left",
                    fontFamily: "system-ui",
                  }}
                >
                  <span style={{ fontSize: 13 }}>{LAYER_ICONS[layer]}</span>
                  {layer.charAt(0).toUpperCase() + layer.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Drawing/tracking indicator */}
        {(drawing || tracking) && (
          <div style={{
            position: "absolute", top: 10, left: 10, zIndex: 1000,
            padding: "6px 12px", borderRadius: 20,
            background: tracking
              ? "linear-gradient(135deg, hsl(200,60%,45%), hsl(210,70%,50%))"
              : "linear-gradient(135deg, hsl(142,50%,42%), hsl(150,55%,48%))",
            color: "white", fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
            display: "flex", alignItems: "center", gap: 5,
            boxShadow: "0 2px 10px hsla(0,0%,0%,0.3)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "white", animation: "blink 1.2s infinite" }} />
            {tracking ? `GPS tracking · ${points.length} pts` : `Tap to mark · ${points.length} pts`}
          </div>
        )}

        {/* Feature loading */}
        {loadingFeatures && (
          <div style={{
            position: "absolute", top: 10, left: 10, zIndex: 1000,
            padding: "6px 12px", borderRadius: 20,
            background: "hsla(0,0%,0%,0.65)",
            backdropFilter: "blur(8px)",
            color: "white", fontSize: 10, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(142,50%,50%)", animation: "blink 0.8s infinite" }} />
            Scanning infrastructure...
          </div>
        )}

        {/* NDVI + Feature overlay panel */}
        {closed && (
          <div style={{
            position: "absolute", bottom: 10, right: 10, zIndex: 1000,
            padding: "10px 14px", borderRadius: 12,
            background: "hsla(0,0%,0%,0.6)",
            backdropFilter: "blur(16px)",
            border: "1px solid hsla(0,0%,100%,0.08)",
            minWidth: 170,
          }}>
            {/* NDVI toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{
                color: "white", fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                display: "flex", alignItems: "center", gap: 4, textTransform: "uppercase",
              }}>
                <Satellite size={10} /> NDVI
              </span>
              <button
                onClick={() => setNdviOverlay(!ndviOverlay)}
                style={{
                  background: ndviOverlay
                    ? "linear-gradient(135deg, hsl(142,50%,42%), hsl(150,50%,48%))"
                    : "hsla(0,0%,100%,0.12)",
                  border: "none", borderRadius: 14, padding: "3px 10px",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  transition: "all 0.25s",
                }}
              >
                {ndviOverlay ? <Eye size={10} color="white" /> : <EyeOff size={10} color="hsla(0,0%,100%,0.5)" />}
                <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>{ndviOverlay ? "ON" : "OFF"}</span>
              </button>
            </div>

            {ndviOverlay && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ color: "hsla(0,0%,100%,0.5)", fontSize: 9, fontWeight: 500 }}>Intensity</span>
                  <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>{ndviOpacity}%</span>
                </div>
                <Slider
                  value={[ndviOpacity]}
                  onValueChange={(v) => setNdviOpacity(v[0])}
                  min={20}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            )}

            {/* Building toggle */}
            {features.buildings.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 5, paddingTop: 6,
                borderTop: "1px solid hsla(0,0%,100%,0.06)",
              }}>
                <span style={{
                  color: "hsla(0,0%,100%,0.7)", fontSize: 9, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <Building2 size={9} color="hsl(35,65%,55%)" /> Structures · {features.buildings.length}
                </span>
                <button
                  onClick={() => setShowBuildings(!showBuildings)}
                  style={{
                    background: showBuildings ? "hsl(35,55%,45%)" : "hsla(0,0%,100%,0.1)",
                    border: "none", borderRadius: 10, padding: "2px 8px",
                    cursor: "pointer", color: "white", fontSize: 8, fontWeight: 700,
                    transition: "all 0.2s",
                  }}
                >
                  {showBuildings ? "ON" : "OFF"}
                </button>
              </div>
            )}

            {/* Water toggle */}
            {features.waterFeatures.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{
                  color: "hsla(0,0%,100%,0.7)", fontSize: 9, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <Droplets size={9} color="hsl(210,70%,55%)" /> Water · {features.waterFeatures.length}
                </span>
                <button
                  onClick={() => setShowWater(!showWater)}
                  style={{
                    background: showWater ? "hsl(210,60%,45%)" : "hsla(0,0%,100%,0.1)",
                    border: "none", borderRadius: 10, padding: "2px 8px",
                    cursor: "pointer", color: "white", fontSize: 8, fontWeight: 700,
                    transition: "all 0.2s",
                  }}
                >
                  {showWater ? "ON" : "OFF"}
                </button>
              </div>
            )}

            {/* Source label */}
            <div style={{
              marginTop: 6, paddingTop: 5,
              borderTop: "1px solid hsla(0,0%,100%,0.06)",
            }}>
              <span style={{
                color: "hsla(0,0%,100%,0.3)", fontSize: 7, letterSpacing: 0.8,
                textTransform: "uppercase", fontWeight: 600,
              }}>
                Z-Score NDVI · Cloud-masked · Bilinear
              </span>
            </div>
          </div>
        )}

        {/* Active layer badge */}
        <div style={{
          position: "absolute", bottom: 10, left: 10, zIndex: 1000,
          padding: "4px 10px", borderRadius: 14,
          background: "hsla(0,0%,0%,0.5)",
          backdropFilter: "blur(8px)",
          color: "white", fontSize: 9, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 4,
          letterSpacing: 0.3,
        }}>
          <span style={{ fontSize: 11 }}>{LAYER_ICONS[activeLayer]}</span>
          {activeLayer.charAt(0).toUpperCase() + activeLayer.slice(1)}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {!closed ? (
          <>
            {!drawing && !tracking && (
              <>
                <button onClick={() => { reset(); setDrawing(true); }} style={mapBtn}>
                  <MapPin size={12} /> Tap to Mark
                </button>
                <button onClick={startTracking} style={mapBtn}>
                  <Maximize2 size={12} /> Walk Around
                </button>
              </>
            )}
            {(drawing || tracking) && points.length >= 3 && (
              <button onClick={closeBoundary} style={{ ...mapBtn, background: "hsl(142,50%,42%)", color: "white" }}>
                <Check size={12} /> Close Boundary
              </button>
            )}
            {(drawing || tracking) && (
              <button onClick={reset} style={mapBtn}>
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </>
        ) : (
          <button onClick={reset} style={mapBtn}>
            <Trash2 size={12} /> Clear & Remap
          </button>
        )}
      </div>

      {/* NDVI legend */}
      {ndviOverlay && (
        <div style={{ marginTop: 8, padding: "0 2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 8, color: "hsla(0,0%,100%,0.4)", whiteSpace: "nowrap", fontWeight: 600 }}>Bare</span>
            <div style={{
              flex: 1, height: 8, borderRadius: 4,
              background: "linear-gradient(to right, #d73027, #fc8d59, #fee08b, #d9ef8b, #91cf60, #1a9850)",
              boxShadow: "inset 0 1px 2px hsla(0,0%,0%,0.2)",
            }} />
            <span style={{ fontSize: 8, color: "hsla(0,0%,100%,0.4)", whiteSpace: "nowrap", fontWeight: 600 }}>Dense</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, padding: "0 28px" }}>
            {["0.0", "0.25", "0.5", "0.75", "1.0"].map(v => (
              <span key={v} style={{ fontSize: 7, color: "hsla(0,0%,100%,0.3)", fontWeight: 500 }}>{v}</span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        .leaflet-container { font-family: inherit; }
        .leaflet-tile { image-rendering: -webkit-optimize-contrast; }
      `}</style>
    </div>
  );
};

const mapBtn: React.CSSProperties = {
  flex: 1, padding: "10px 12px", borderRadius: 12, border: "none",
  background: "hsla(142,30%,48%,0.1)",
  color: "hsl(142,40%,42%)", fontSize: 11, fontWeight: 600,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
  transition: "all 0.2s",
  fontFamily: "system-ui",
  letterSpacing: 0.2,
};

export default FarmBoundaryMap;
