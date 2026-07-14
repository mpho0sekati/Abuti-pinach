import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// South African fresh produce market sources to scrape
const MARKET_SOURCES = [
  {
    name: "Johannesburg Fresh Produce Market",
    url: "https://www.joburgmarket.co.za/dailyprices",
    fallback: "https://www.joburgmarket.co.za",
  },
  {
    name: "Cape Town Market",
    url: "https://www.capetownmarket.co.za/market-prices",
    fallback: "https://www.capetownmarket.co.za",
  },
  {
    name: "AgriHub SA",
    url: "https://www.agrihub.co.za/market-prices",
    fallback: "https://www.agrihub.co.za",
  },
];

// Backup: well-known agriculture price pages
const BACKUP_SOURCES = [
  "https://www.safex.co.za",
  "https://www.grainsa.co.za/pages/industry-reports/market-highlights",
  "https://www.namc.co.za",
];

interface ScrapedPrice {
  crop: string;
  price_min: number | null;
  price_max: number | null;
  unit: string;
  source: string;
  date: string;
  quality?: string;
}

// Parse price data from scraped markdown using patterns
function extractPricesFromMarkdown(markdown: string, sourceName: string): ScrapedPrice[] {
  const prices: ScrapedPrice[] = [];
  const today = new Date().toISOString().split("T")[0];

  // Common SA crops to look for
  const cropPatterns = [
    "tomato", "tomatoes", "potato", "potatoes", "onion", "onions",
    "spinach", "cabbage", "carrot", "carrots", "pepper", "peppers",
    "butternut", "gem squash", "pumpkin", "beetroot", "broccoli",
    "cauliflower", "lettuce", "cucumber", "mushroom", "mushrooms",
    "avocado", "banana", "apple", "orange", "grape", "grapes",
    "mango", "peach", "pear", "watermelon", "strawberry",
    "maize", "wheat", "soybean", "sunflower", "sorghum",
    "green beans", "sweet potato", "baby marrow", "chilli",
  ];

  // Pattern: crop name followed by R amount (e.g., "Tomatoes R12.50/kg" or "R8 - R15")
  const lines = markdown.split("\n");
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const crop of cropPatterns) {
      if (!lower.includes(crop)) continue;

      // Match price patterns: R12, R12.50, R12-R15, R12 - R15, R12/kg, R12 per kg
      const priceMatches = line.match(/R\s?(\d+(?:[.,]\d+)?)\s*(?:[-–—to]\s*R?\s*(\d+(?:[.,]\d+)?))?/gi);
      if (!priceMatches || priceMatches.length === 0) continue;

      for (const match of priceMatches) {
        const nums = match.match(/(\d+(?:[.,]\d+)?)/g);
        if (!nums) continue;

        const p1 = parseFloat(nums[0].replace(",", "."));
        const p2 = nums.length > 1 ? parseFloat(nums[1].replace(",", ".")) : null;

        // Determine unit
        const unitMatch = line.match(/(?:per|\/)\s*(kg|ton|tonne|crate|bag|bunch|each|head|pocket|punnet|case)/i);
        const unit = unitMatch ? unitMatch[1].toLowerCase() : "kg";

        // Skip unreasonable prices
        if (p1 > 50000 || p1 < 0.5) continue;

        prices.push({
          crop: crop.charAt(0).toUpperCase() + crop.slice(1),
          price_min: p1,
          price_max: p2 || p1,
          unit,
          source: sourceName,
          date: today,
        });
        break; // One match per crop per line is enough
      }
    }
  }

  return prices;
}

// Deduplicate and average prices across sources
function consolidatePrices(allPrices: ScrapedPrice[]): ScrapedPrice[] {
  const grouped = new Map<string, ScrapedPrice[]>();
  for (const p of allPrices) {
    const key = p.crop.toLowerCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  const consolidated: ScrapedPrice[] = [];
  for (const [, items] of grouped) {
    const mins = items.filter(i => i.price_min !== null).map(i => i.price_min!);
    const maxs = items.filter(i => i.price_max !== null).map(i => i.price_max!);
    const sources = [...new Set(items.map(i => i.source))];

    consolidated.push({
      crop: items[0].crop,
      price_min: mins.length > 0 ? Math.min(...mins) : null,
      price_max: maxs.length > 0 ? Math.max(...maxs) : null,
      unit: items[0].unit,
      source: sources.join(", "),
      date: items[0].date,
    });
  }

  return consolidated.sort((a, b) => a.crop.localeCompare(b.crop));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const requestedCrops = body.crops as string[] | undefined;

    console.log("Scraping market prices...", requestedCrops ? `for: ${requestedCrops.join(", ")}` : "all crops");

    const allPrices: ScrapedPrice[] = [];
    const errors: string[] = [];

    // Scrape primary sources
    const scrapePromises = MARKET_SOURCES.map(async (source) => {
      for (const url of [source.url, source.fallback]) {
        try {
          console.log(`Scraping: ${url}`);
          const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url,
              formats: ["markdown"],
              onlyMainContent: true,
              waitFor: 3000,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            console.error(`Firecrawl error for ${url}:`, data);
            continue;
          }

          const markdown = data.data?.markdown || data.markdown || "";
          if (markdown) {
            const prices = extractPricesFromMarkdown(markdown, source.name);
            console.log(`Found ${prices.length} prices from ${source.name}`);
            allPrices.push(...prices);
            return; // Success, skip fallback
          }
        } catch (err) {
          console.error(`Error scraping ${url}:`, err);
        }
      }
      errors.push(`Failed to scrape ${source.name}`);
    });

    // Also try backup sources
    const backupPromises = BACKUP_SOURCES.map(async (url) => {
      try {
        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            formats: ["markdown"],
            onlyMainContent: true,
            waitFor: 3000,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          const markdown = data.data?.markdown || data.markdown || "";
          if (markdown) {
            const sourceName = new URL(url).hostname.replace("www.", "");
            const prices = extractPricesFromMarkdown(markdown, sourceName);
            console.log(`Found ${prices.length} prices from ${sourceName}`);
            allPrices.push(...prices);
          }
        }
      } catch (err) {
        console.error(`Error scraping backup ${url}:`, err);
      }
    });

    await Promise.allSettled([...scrapePromises, ...backupPromises]);

    // Consolidate
    let consolidated = consolidatePrices(allPrices);

    // Filter by requested crops if specified
    if (requestedCrops && requestedCrops.length > 0) {
      const lowerCrops = requestedCrops.map(c => c.toLowerCase());
      consolidated = consolidated.filter(p =>
        lowerCrops.some(c => p.crop.toLowerCase().includes(c) || c.includes(p.crop.toLowerCase()))
      );
    }

    console.log(`Returning ${consolidated.length} consolidated prices`);

    return new Response(
      JSON.stringify({
        success: true,
        prices: consolidated,
        sources_scraped: MARKET_SOURCES.length + BACKUP_SOURCES.length,
        errors: errors.length > 0 ? errors : undefined,
        scraped_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Market prices error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
