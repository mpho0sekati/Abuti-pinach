// Scrapes https://joburgmarket.co.za/daily-price-list/ via Firecrawl
// and returns a normalized list of commodity prices (low / avg / high per unit).
// Cached upstream; safe to call frequently from the client.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE_URL = "https://joburgmarket.co.za/daily-price-list/";

type Row = { commodity: string; unit: string; low: number | null; high: number | null; avg: number | null };

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[, R\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Parse markdown tables / rows from the daily price list page.
// The page mixes HTML tables and bullet text; we look for rows that contain
// a commodity name followed by 2-3 numbers and an optional unit.
function extractRows(markdown: string): Row[] {
  const rows: Row[] = [];
  const seen = new Set<string>();
  const lines = markdown.split(/\r?\n/);

  const unitRe = /\b(kg|ton|tonne|crate|bag|bunch|each|head|pocket|punnet|case|box|10kg|5kg|2kg)\b/i;
  const numRe = /R?\s*\d{1,4}(?:[.,]\d{1,2})?/g;

  for (const raw of lines) {
    const line = raw.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    if (line.length < 4 || line.length > 200) continue;
    const nums = line.match(numRe);
    if (!nums || nums.length < 2) continue;

    // commodity candidate = leading alpha words
    const m = line.match(/^([A-Za-z][A-Za-z '\-/]{2,40})\b/);
    if (!m) continue;
    const commodity = m[1].trim().replace(/\s+/g, " ");
    if (/^(price|commodity|unit|date|low|high|avg|average|market|total|product)$/i.test(commodity)) continue;
    const key = commodity.toLowerCase();
    if (seen.has(key)) continue;

    const parsed = nums.map(parseNum).filter((n): n is number => n != null && n > 0 && n < 100000);
    if (parsed.length < 1) continue;
    parsed.sort((a, b) => a - b);
    const low = parsed[0];
    const high = parsed[parsed.length - 1];
    const avg = parsed.length >= 3 ? parsed[Math.floor(parsed.length / 2)] : (low + high) / 2;

    const unitMatch = line.match(unitRe);
    const unit = unitMatch ? unitMatch[1].toLowerCase() : "kg";

    seen.add(key);
    rows.push({
      commodity: commodity.replace(/\b\w/g, (c) => c.toUpperCase()),
      unit,
      low,
      high,
      avg,
    });
  }

  return rows.slice(0, 60);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured", prices: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: SOURCE_URL,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2500,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("firecrawl scrape error", json);
      return new Response(
        JSON.stringify({ success: false, error: json?.error ?? "scrape failed", prices: [] }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const markdown: string = json?.data?.markdown ?? json?.markdown ?? "";
    const prices = extractRows(markdown);

    return new Response(
      JSON.stringify({
        success: true,
        source_url: SOURCE_URL,
        date: new Date().toISOString().split("T")[0],
        prices,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "unknown", prices: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
