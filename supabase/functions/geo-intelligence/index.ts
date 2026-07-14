const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { lat, lng, action, bounds } = body;

    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: "lat and lng required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch real climate data from NASA POWER (free, no key) ──
    if (action === "climate" || !action) {
      const now = new Date();
      const end = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const start30 = new Date(now.getTime() - 30 * 86400000);
      const startStr = `${start30.getFullYear()}${String(start30.getMonth() + 1).padStart(2, "0")}${String(start30.getDate()).padStart(2, "0")}`;

      const params = [
        "T2M", "T2M_MAX", "T2M_MIN",       // Temperature
        "PRECTOTCORR",                        // Precipitation
        "ALLSKY_SFC_SW_DWN",                  // Solar radiation
        "RH2M",                               // Relative humidity
        "WS2M",                               // Wind speed
        "GWETROOT",                           // Root-zone soil moisture
        "GWETPROF",                           // Profile soil moisture
        "EVPTRNS",                            // Evapotranspiration
      ].join(",");

      const nasaUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params}&community=AG&longitude=${lng}&latitude=${lat}&start=${startStr}&end=${end}&format=JSON`;

      let nasaData: any = null;
      try {
        const resp = await fetch(nasaUrl);
        if (resp.ok) nasaData = await resp.json();
      } catch (e) {
        console.error("NASA POWER fetch failed:", e);
      }

      // ── Fetch current weather from Open-Meteo (free, no key) ──
      let weatherData: any = null;
      try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,soil_temperature_0cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,uv_index_max&timezone=auto&forecast_days=7`;
        const resp = await fetch(weatherUrl);
        if (resp.ok) weatherData = await resp.json();
      } catch (e) {
        console.error("Open-Meteo fetch failed:", e);
      }

      // ── Compute derived metrics ──
      const parameters = nasaData?.properties?.parameter || {};

      // Average soil moisture from NASA (root zone)
      const gwetValues = Object.values(parameters.GWETROOT || {}).filter((v: any) => v !== -999) as number[];
      const avgSoilMoisture = gwetValues.length > 0
        ? Math.round((gwetValues.reduce((a: number, b: number) => a + b, 0) / gwetValues.length) * 100)
        : null;

      // Real-time soil moisture from Open-Meteo
      const currentSoil = weatherData?.current;
      const realtimeSoilMoisture = currentSoil
        ? Math.round(((currentSoil.soil_moisture_0_to_1cm + currentSoil.soil_moisture_1_to_3cm + currentSoil.soil_moisture_3_to_9cm) / 3) * 100)
        : null;

      // Precipitation last 30 days
      const precValues = Object.values(parameters.PRECTOTCORR || {}).filter((v: any) => v !== -999) as number[];
      const totalPrecip = precValues.reduce((a: number, b: number) => a + b, 0);

      // Temperature stats
      const tMaxValues = Object.values(parameters.T2M_MAX || {}).filter((v: any) => v !== -999) as number[];
      const tMinValues = Object.values(parameters.T2M_MIN || {}).filter((v: any) => v !== -999) as number[];
      const avgTMax = tMaxValues.length > 0 ? +(tMaxValues.reduce((a, b) => a + b, 0) / tMaxValues.length).toFixed(1) : null;
      const avgTMin = tMinValues.length > 0 ? +(tMinValues.reduce((a, b) => a + b, 0) / tMinValues.length).toFixed(1) : null;

      // Solar radiation avg
      const solarValues = Object.values(parameters.ALLSKY_SFC_SW_DWN || {}).filter((v: any) => v !== -999) as number[];
      const avgSolar = solarValues.length > 0 ? +(solarValues.reduce((a, b) => a + b, 0) / solarValues.length).toFixed(1) : null;

      // ET avg
      const etValues = Object.values(parameters.EVPTRNS || {}).filter((v: any) => v !== -999) as number[];
      const avgET = etValues.length > 0 ? +(etValues.reduce((a, b) => a + b, 0) / etValues.length).toFixed(2) : null;

      // Humidity
      const rhValues = Object.values(parameters.RH2M || {}).filter((v: any) => v !== -999) as number[];
      const avgHumidity = rhValues.length > 0 ? Math.round(rhValues.reduce((a, b) => a + b, 0) / rhValues.length) : null;

      // Wind
      const windValues = Object.values(parameters.WS2M || {}).filter((v: any) => v !== -999) as number[];
      const avgWind = windValues.length > 0 ? +(windValues.reduce((a, b) => a + b, 0) / windValues.length).toFixed(1) : null;

      // Growing Degree Days (base 10°C)
      const t2mValues = Object.values(parameters.T2M || {}).filter((v: any) => v !== -999) as number[];
      const gdd = t2mValues.reduce((sum, t) => sum + Math.max(0, t - 10), 0);

      // NDVI estimate from vegetation-correlated parameters
      // NOTE: This is a MODELED estimate, not satellite-measured.
      // Barren/mine areas may still show moderate scores if climate conditions are favorable.
      const soilM = (avgSoilMoisture ?? realtimeSoilMoisture ?? 30) / 100;
      const precipFactor = Math.min(1, totalPrecip / 120); // stricter threshold
      const tempFactor = avgTMax ? Math.max(0, 1 - Math.abs(avgTMax - 28) / 20) : 0.5;
      // Low soil moisture + low precip = likely barren
      const aridityPenalty = (soilM < 0.25 && precipFactor < 0.3) ? 0.15 : 0;
      const estimatedNDVI = +(0.1 + soilM * 0.3 + precipFactor * 0.3 + tempFactor * 0.15 - aridityPenalty).toFixed(2);
      const clampedNDVI = Math.min(0.85, Math.max(0.05, estimatedNDVI));

      // Irrigation need
      const effectiveSoil = realtimeSoilMoisture ?? avgSoilMoisture ?? 40;
      const et0_today = weatherData?.daily?.et0_fao_evapotranspiration?.[0] ?? 4;
      const waterDeficit = Math.max(0, et0_today - (effectiveSoil / 100) * 6);
      const irrigationLiters = +(waterDeficit * 1.2).toFixed(1);

      // 7-day forecast
      const forecast7d = weatherData?.daily ? {
        dates: weatherData.daily.time,
        temp_max: weatherData.daily.temperature_2m_max,
        temp_min: weatherData.daily.temperature_2m_min,
        precipitation: weatherData.daily.precipitation_sum,
        et0: weatherData.daily.et0_fao_evapotranspiration,
        uv_max: weatherData.daily.uv_index_max,
      } : null;

      // Crop suitability based on real climate
      const absLat = Math.abs(lat);
      const cropDB = [
        { name: "Maize", tOpt: [20, 32], waterNeed: 500, gddNeed: 1200, soilPref: "loam" },
        { name: "Wheat", tOpt: [12, 25], waterNeed: 450, gddNeed: 1000, soilPref: "clay-loam" },
        { name: "Spinach", tOpt: [15, 25], waterNeed: 350, gddNeed: 600, soilPref: "loam" },
        { name: "Tomatoes", tOpt: [20, 30], waterNeed: 600, gddNeed: 1100, soilPref: "sandy-loam" },
        { name: "Potatoes", tOpt: [15, 22], waterNeed: 500, gddNeed: 900, soilPref: "sandy-loam" },
        { name: "Beans", tOpt: [18, 28], waterNeed: 400, gddNeed: 800, soilPref: "loam" },
        { name: "Sorghum", tOpt: [25, 35], waterNeed: 400, gddNeed: 1200, soilPref: "clay" },
        { name: "Sunflower", tOpt: [20, 30], waterNeed: 500, gddNeed: 1100, soilPref: "loam" },
        { name: "Cabbage", tOpt: [15, 22], waterNeed: 380, gddNeed: 700, soilPref: "clay-loam" },
        { name: "Sweet Potato", tOpt: [22, 32], waterNeed: 500, gddNeed: 1300, soilPref: "sandy" },
      ];

      const cropSuitability = cropDB.map(c => {
        const tAvg = avgTMax && avgTMin ? (avgTMax + avgTMin) / 2 : 22;
        const tempScore = Math.max(0, 100 - Math.abs(tAvg - (c.tOpt[0] + c.tOpt[1]) / 2) * 6);
        const waterScore = Math.max(0, 100 - Math.abs(totalPrecip * 12 - c.waterNeed) / c.waterNeed * 80);
        const gddScore = Math.max(0, Math.min(100, (gdd / c.gddNeed) * 100 * 12));
        const suitability = Math.round(Math.min(98, tempScore * 0.4 + waterScore * 0.35 + Math.min(100, gddScore) * 0.25));
        const yieldFactor = suitability / 100;
        return {
          name: c.name,
          suitability,
          tempScore: Math.round(tempScore),
          waterScore: Math.round(waterScore),
          soilPref: c.soilPref,
          estimatedYield: c.name === "Maize" ? `${(5.5 * yieldFactor).toFixed(1)} t/ha`
            : c.name === "Wheat" ? `${(3.5 * yieldFactor).toFixed(1)} t/ha`
            : c.name === "Spinach" ? `${(15 * yieldFactor).toFixed(0)} t/ha`
            : c.name === "Tomatoes" ? `${(40 * yieldFactor).toFixed(0)} t/ha`
            : `${(8 * yieldFactor).toFixed(1)} t/ha`,
        };
      }).sort((a, b) => b.suitability - a.suitability).slice(0, 6);

      // Land degradation / mine rehabilitation assessment
      const degradationRisk = clampedNDVI < 0.25 ? "high" : clampedNDVI < 0.4 ? "moderate" : "low";
      const rehabilitation = {
        degradationRisk,
        ndviClass: clampedNDVI < 0.15 ? "Barren" : clampedNDVI < 0.25 ? "Severely Degraded" : clampedNDVI < 0.4 ? "Degraded" : clampedNDVI < 0.6 ? "Moderate Vegetation" : "Healthy Vegetation",
        recommendations: degradationRisk === "high" ? [
          "Soil testing for heavy metals (Pb, Cd, As) recommended",
          "Consider phytoremediation with vetiver grass or sunflowers",
          "Add organic compost at 20-30 t/ha to rebuild soil structure",
          "Install erosion control (contour bunds, check dams)",
          "Plant nitrogen-fixing cover crops (clover, alfalfa)",
        ] : degradationRisk === "moderate" ? [
          "Apply lime if pH < 5.5 to correct acidity",
          "Introduce cover crops to improve organic matter",
          "Reduce tillage to prevent further degradation",
          "Monitor water runoff and erosion patterns",
        ] : [
          "Maintain current land management practices",
          "Rotate crops to maintain soil health",
          "Monitor NDVI trends seasonally",
        ],
        restorationTimeline: degradationRisk === "high" ? "3-7 years" : degradationRisk === "moderate" ? "1-3 years" : "Maintenance only",
      };

      return new Response(JSON.stringify({
        success: true,
        source: "NASA_POWER + Open-Meteo",
        climate: {
          avgTempMax: avgTMax,
          avgTempMin: avgTMin,
          currentTemp: currentSoil?.temperature_2m ?? null,
          totalPrecipitation30d: +totalPrecip.toFixed(1),
          avgSolarRadiation: avgSolar,
          avgHumidity,
          avgWind,
          avgET,
          gdd: Math.round(gdd),
        },
        soil: {
          moisture30dAvg: avgSoilMoisture,
          moistureRealtime: realtimeSoilMoisture,
          soilTemp: currentSoil?.soil_temperature_0cm ?? null,
        },
        ndvi: {
          estimated: clampedNDVI,
          healthClass: clampedNDVI >= 0.6 ? "Healthy" : clampedNDVI >= 0.4 ? "Moderate" : clampedNDVI >= 0.25 ? "Stressed" : "Bare/Degraded",
          healthScore: Math.round(clampedNDVI * 100),
        },
        irrigation: {
          waterDeficitMM: +waterDeficit.toFixed(1),
          recommendedLiters: irrigationLiters,
          et0Today: et0_today,
          advice: irrigationLiters <= 0.5 ? "No irrigation needed" : irrigationLiters < 3 ? "Light irrigation recommended" : "Irrigate now — significant deficit",
          nextCheck: irrigationLiters <= 0.5 ? "Check in 2-3 days" : "Tomorrow morning",
          efficiency: effectiveSoil >= 60 ? 92 : effectiveSoil >= 40 ? 75 : 52,
        },
        crops: cropSuitability,
        rehabilitation,
        forecast7d,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Detect buildings and water features via Overpass API ──
    if (action === "features") {
      const radius = 1000;
      const bbox = bounds
        ? `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
        : `${lat - 0.009},${lng - 0.012},${lat + 0.009},${lng + 0.012}`;

      const overpassQuery = `
        [out:json][timeout:25];
        (
          way["building"](${bbox});
          relation["building"](${bbox});
          node["building"](${bbox});
          way["building:part"](${bbox});
          way["amenity"~"school|hospital|clinic|church|fuel"](${bbox});
          node["amenity"~"school|hospital|clinic|church|fuel"](${bbox});
          way["shop"](${bbox});
          node["shop"](${bbox});
          way["industrial"](${bbox});
          way["natural"="water"](${bbox});
          relation["natural"="water"](${bbox});
          way["waterway"](${bbox});
          way["landuse"="reservoir"](${bbox});
          way["landuse"="basin"](${bbox});
          node["man_made"="water_well"](${bbox});
          node["amenity"="drinking_water"](${bbox});
          node["natural"="spring"](${bbox});
          way["man_made"="reservoir_covered"](${bbox});
        );
        out body geom;
      `;

      try {
        const overpassResp = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(overpassQuery)}`,
        });

        if (!overpassResp.ok) {
          const errText = await overpassResp.text();
          console.error("Overpass error:", errText);
          return new Response(JSON.stringify({ 
            success: true, buildings: [], waterFeatures: [],
            note: "Overpass API temporarily unavailable" 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const overpassData = await overpassResp.json();
        const buildings: any[] = [];
        const waterFeatures: any[] = [];

        for (const el of overpassData.elements || []) {
          const tags = el.tags || {};
          const geom = el.geometry?.map((g: any) => [g.lat, g.lon]) || [];
          
          // Handle node elements (points without polygon geometry)
          const isNode = el.type === "node";
          const pointGeom = isNode && el.lat && el.lon ? [[el.lat, el.lon]] : [];
          const effectiveGeom = geom.length >= 2 ? geom : pointGeom;
          
          if (effectiveGeom.length === 0) continue;

          // Classify as building
          const isBuilding = tags.building || tags["building:part"] || tags.industrial ||
            (tags.amenity && ["school","hospital","clinic","church","fuel"].includes(tags.amenity)) ||
            tags.shop;
          
          // Classify as water
          const isWater = tags.natural === "water" || tags.waterway || 
            tags.landuse === "reservoir" || tags.landuse === "basin" ||
            tags["man_made"] === "water_well" || tags["man_made"] === "reservoir_covered" ||
            tags.amenity === "drinking_water" || tags.natural === "spring";

          if (isBuilding) {
            const bldType = tags.amenity || tags.shop || tags.industrial || tags.building || "yes";
            buildings.push({
              id: el.id,
              type: bldType,
              name: tags.name || tags["addr:street"] || null,
              geometry: effectiveGeom,
              isPoint: effectiveGeom.length === 1,
            });
          } else if (isWater) {
            const wtrType = tags.waterway || tags.natural || tags.landuse || 
              (tags["man_made"] === "water_well" ? "water_well" : tags.amenity === "drinking_water" ? "drinking_water" : "water");
            waterFeatures.push({
              id: el.id,
              type: wtrType,
              name: tags.name || null,
              geometry: effectiveGeom,
            });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          buildings: buildings.slice(0, 200),
          waterFeatures: waterFeatures.slice(0, 100),
          total: { buildings: buildings.length, water: waterFeatures.length },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Overpass fetch error:", e);
        return new Response(JSON.stringify({
          success: true, buildings: [], waterFeatures: [],
          note: "Feature detection temporarily unavailable",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("geo-intelligence error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
