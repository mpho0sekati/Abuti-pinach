import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── CrewAI-style Agent Definitions ──────────────────────────────────
const AGENTS = {
  market_analyst: {
    role: "Senior Market Analyst",
    goal: "Analyze South African agricultural markets and identify the best pricing opportunities with deep trend analysis",
    backstory: `You are a veteran produce market analyst with 20 years of experience in South African fresh produce markets (Johannesburg, Cape Town, Tshwane, Durban, Port Elizabeth). You track price trends from the National Department of Agriculture, understand seasonal demand patterns, export opportunities, BRICS trade corridors, and local supply chains. You provide granular ZAR pricing with confidence intervals and identify arbitrage opportunities between markets. You analyze weather impact on supply, competitor farm output, and transport cost fluctuations.`,
  },
  negotiator: {
    role: "Expert Deal Negotiator",
    goal: "Negotiate the highest possible price for the farmer's produce above their minimum price floor using advanced negotiation tactics",
    backstory: `You are a skilled agricultural trade negotiator who represents smallholder farmers in South Africa. You understand buyer psychology — wholesalers want volume discounts, restaurants want quality premiums, processors want consistency, export agents want certification. You NEVER accept below the farmer's price floor and always push for 15-30% above market average. You create competitive tension between buyers, use anchoring tactics, and leverage scarcity. You know every major buyer in SA agriculture.`,
  },
  logistics_coordinator: {
    role: "Logistics & Supply Chain Coordinator",
    goal: "Arrange cost-effective and timely delivery with cold chain integrity and regulatory compliance",
    backstory: `You coordinate agricultural logistics across South Africa, from rural farms to urban markets and export hubs. You know bakkie rates, refrigerated truck costs, cold chain requirements for perishables, phytosanitary certificates for exports, and delivery windows for major markets. You optimize for cost while ensuring produce arrives fresh. You work with local transport networks, co-ops, and cross-border logistics. You track fuel prices and route congestion.`,
  },
  quality_inspector: {
    role: "Quality Assurance & Grading Inspector",
    goal: "Assess produce quality, grade classification, and shelf-life to maximize sale value",
    backstory: `You are a certified agricultural produce quality inspector with expertise in South African grading standards (Class 1, Class 2, Class 3) per DALRRD regulations. You assess freshness, size uniformity, blemish percentage, moisture content, and packaging requirements. You understand how quality grades affect pricing — Class 1 commands 40-60% premiums over Class 2. You advise on post-harvest handling to maximize grade and shelf life. You know cold storage requirements for every crop.`,
  },
  risk_analyst: {
    role: "Agricultural Risk & Intelligence Analyst",
    goal: "Identify threats, forecast risks, and provide strategic intelligence for farming operations",
    backstory: `You are an agricultural intelligence analyst specializing in South African farming risk. You monitor weather patterns (El Niño/La Niña cycles), pest outbreaks (fall armyworm, locust swarms, fruit fly), disease vectors, water scarcity projections, political/regulatory changes, load shedding impacts on cold storage, fuel price volatility, and currency fluctuations affecting exports. You provide risk scores (1-10) and actionable mitigation strategies. You follow DALRRD, SASRI, ARC, and BFAP reports.`,
  },
  supply_chain_optimizer: {
    role: "Supply Chain & Distribution Strategist",
    goal: "Optimize the entire farm-to-market pipeline for maximum efficiency and profitability",
    backstory: `You design optimal supply chain strategies for South African farmers. You analyze direct-to-consumer vs wholesale vs export channels. You know markup structures: farm gate → packhouse (15-20%) → cold storage (8-12%) → transport (10-15%) → market agent commission (5-7.5%) → retail markup (30-50%). You identify disintermediation opportunities, cooperative aggregation benefits, and value-add processing options. You understand informal markets (spaza shops, hawkers) and formal retail (Pick n Pay, Checkers, Woolworths, SPAR).`,
  },
};

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string) {
  const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("Gemini error:", resp.status, t);
    throw new Error(`Gemini API error: ${resp.status}`);
  }

  const result = await resp.json();
  return JSON.parse(result.choices[0].message.content);
}

// ── Agent Task Runners ──────────────────────────────────────────────
async function runMarketAnalyst(apiKey: string, crop: string, quantityKg: number, minPrice: number) {
  const agent = AGENTS.market_analyst;
  const systemPrompt = `You are: ${agent.role}\nGoal: ${agent.goal}\nBackstory: ${agent.backstory}\n\nReturn JSON with: { agent: "market_analyst", current_price_range: {min, max}, demand_level: "high"|"medium"|"low", demand_trend: "rising"|"stable"|"falling", supply_level: "surplus"|"balanced"|"deficit", best_markets: [{name, avg_price, distance_km, volume_capacity_tons, payment_terms}], recommended_price: number, confidence: number (0-1), seasonal_notes: string, competitor_analysis: string, export_opportunity: {viable: boolean, markets: string[], premium_pct: number}, weather_impact: string, price_forecast_30d: {direction: "up"|"stable"|"down", magnitude_pct: number, reasoning: string} }. All prices in ZAR.`;
  const userPrompt = `Analyze market for ${crop}, quantity: ${quantityKg}kg. Farmer's floor price: R${minPrice || "negotiable"}/kg. Today: ${new Date().toISOString().split("T")[0]}. Provide deep market intelligence.`;
  return callGemini(apiKey, systemPrompt, userPrompt);
}

async function runNegotiator(apiKey: string, crop: string, quantityKg: number, minPrice: number, marketData: any, candidateBuyers: any[], farmerHistory: any) {
  const agent = AGENTS.negotiator;
  const buyerList = candidateBuyers.length > 0
    ? `\n\nREAL BUYER POOL (negotiate ONLY against these — do not invent buyers):\n${JSON.stringify(candidateBuyers.map(b => ({
        id: b.id, name: b.name, type: b.buyer_type, region: b.region, city: b.city,
        price_range: `R${b.min_price_per_kg}-R${b.max_price_per_kg}/kg`,
        volume_capacity: `${b.min_volume_kg}-${b.max_volume_kg}kg`,
        payment_terms: b.payment_terms, reliability: b.reliability_score, verified: b.verified,
      })))}\nReturn each buyer's UUID in the buyer_id field.`
    : "";
  const historyContext = farmerHistory?.deals_closed > 0
    ? `\n\nFARMER HISTORY for ${crop}: ${farmerHistory.deals_closed} closed deals, avg achieved R${Number(farmerHistory.avg_achieved_price).toFixed(2)}/kg, win rate ${Math.round((farmerHistory.deals_won / farmerHistory.deals_closed) * 100)}%, avg rating ${farmerHistory.avg_rating?.toFixed(1) || "n/a"}/5. Use this as a benchmark.`
    : "";
  const systemPrompt = `You are: ${agent.role}\nGoal: ${agent.goal}\nBackstory: ${agent.backstory}\n\nMarket intelligence:\n${JSON.stringify(marketData)}${buyerList}${historyContext}\n\nNEVER accept below R${minPrice}/kg.\n\nReturn JSON: { agent: "negotiator", buyers: [{buyer_id: string|null, name, type, initial_offer, counter_offer, final_price, accepted: boolean, rejection_reason: string|null, negotiation_rounds: number, payment_terms: string, volume_committed_kg: number}], best_deal: {buyer_id: string|null, buyer_name, final_price, total_value, savings_vs_market_avg: string, payment_terms: string}, negotiation_summary: string, strategy_used: string, total_revenue: number, avg_price_achieved: number }. All prices in ZAR.`;
  const userPrompt = `Negotiate sale of ${quantityKg}kg ${crop}. Floor: R${minPrice}/kg. Recommended: R${marketData.recommended_price}/kg.`;
  return callGemini(apiKey, systemPrompt, userPrompt);
}

async function runQualityInspector(apiKey: string, crop: string, quantityKg: number) {
  const agent = AGENTS.quality_inspector;
  const systemPrompt = `You are: ${agent.role}\nGoal: ${agent.goal}\nBackstory: ${agent.backstory}\n\nReturn JSON: { agent: "quality_inspector", grade_assessment: {probable_grade: "Class 1"|"Class 2"|"Class 3", confidence: number (0-1), factors: string[]}, shelf_life_days: number, storage_requirements: {temperature_c: number, humidity_pct: number, method: string}, packaging_recommendation: string, price_premium_for_grade: {class_1_premium_pct: number, class_2_baseline: boolean, class_3_discount_pct: number}, post_harvest_tips: string[], certification_needed: string[], quality_score: number (1-100) }`;
  const userPrompt = `Assess quality parameters for ${quantityKg}kg of ${crop}. Provide grading assessment, storage requirements, and quality optimization recommendations.`;
  return callGemini(apiKey, systemPrompt, userPrompt);
}

async function runRiskAnalyst(apiKey: string, crop: string, quantityKg: number, marketData: any) {
  const agent = AGENTS.risk_analyst;
  const systemPrompt = `You are: ${agent.role}\nGoal: ${agent.goal}\nBackstory: ${agent.backstory}\n\nMarket context:\n${JSON.stringify(marketData)}\n\nReturn JSON: { agent: "risk_analyst", overall_risk_score: number (1-10), risk_factors: [{category: "weather"|"pest"|"market"|"logistics"|"regulatory"|"infrastructure", description: string, severity: "critical"|"high"|"medium"|"low", probability: number (0-1), mitigation: string}], opportunities: [{description: string, potential_gain_pct: number, action_required: string}], threat_level: "green"|"amber"|"red", strategic_recommendations: string[], 30_day_outlook: string, insurance_recommendation: string }`;
  const userPrompt = `Analyze risks for ${quantityKg}kg ${crop} transaction. Today: ${new Date().toISOString().split("T")[0]}. Identify all threats and opportunities.`;
  return callGemini(apiKey, systemPrompt, userPrompt);
}

async function runSupplyChainOptimizer(apiKey: string, crop: string, quantityKg: number, marketData: any, negotiationData: any) {
  const agent = AGENTS.supply_chain_optimizer;
  const systemPrompt = `You are: ${agent.role}\nGoal: ${agent.goal}\nBackstory: ${agent.backstory}\n\nMarket data:\n${JSON.stringify(marketData)}\nNegotiation data:\n${JSON.stringify(negotiationData)}\n\nReturn JSON: { agent: "supply_chain_optimizer", optimal_channel: {name: string, reason: string, margin_pct: number}, channel_comparison: [{channel: string, revenue: number, costs: number, net_margin: number, risk: string}], value_add_opportunities: [{process: string, investment: number, revenue_increase_pct: number, feasibility: string}], aggregation_benefit: {cooperative_premium_pct: number, volume_discount_transport_pct: number}, timeline: {harvest_to_sale_days: number, optimal_sale_window: string}, total_supply_chain_cost: number, efficiency_score: number (1-100) }`;
  const userPrompt = `Optimize supply chain for ${quantityKg}kg ${crop}. Best buyer: ${negotiationData?.best_deal?.buyer_name || "TBD"} at R${negotiationData?.best_deal?.final_price || "TBD"}/kg. Design the most profitable farm-to-market pipeline.`;
  return callGemini(apiKey, systemPrompt, userPrompt);
}

async function runLogisticsCoordinator(apiKey: string, crop: string, quantityKg: number, buyerName: string, farmerName: string) {
  const agent = AGENTS.logistics_coordinator;
  const systemPrompt = `You are: ${agent.role}\nGoal: ${agent.goal}\nBackstory: ${agent.backstory}\n\nReturn JSON: { agent: "logistics_coordinator", transport_options: [{provider, vehicle_type, estimated_cost, delivery_time_hours, cold_chain: boolean, reliability_score: number}], recommended_option: {provider, reason, cost: number}, pickup: {location: string, time_window: string, instructions: string}, delivery: {location: string, time_window: string, instructions: string}, total_cost: number, freshness_guarantee: string, insurance_cost: number, documents_needed: string[] }. All costs in ZAR.`;
  const userPrompt = `Arrange delivery of ${quantityKg}kg ${crop} from farmer ${farmerName} to buyer ${buyerName}. Optimize for freshness and cost.`;
  return callGemini(apiKey, systemPrompt, userPrompt);
}

// ── Orchestrator ────────────────────────────────────────────────────
// Agents NEVER act autonomously. They only feed signals to the orchestrator.
// The orchestrator synthesizes a GO / HOLD / NO_GO recommendation. The
// farmer must approve before Negotiator runs and before Logistics groups.

function synthesizeDecision(market: any, quality: any, risk: any, minPrice: number) {
  // Demand signal (0-1)
  const demandMap: Record<string, number> = { high: 1, medium: 0.6, low: 0.25 };
  const demandSignal = demandMap[market?.demand_level] ?? 0.5;

  // Price gap vs floor
  const recPrice = Number(market?.recommended_price) || 0;
  const priceMargin = minPrice > 0 ? (recPrice - minPrice) / minPrice : 0.2;

  // Risk inverse (risk_score 1-10 → 0..1, lower is better)
  const riskScore = Number(risk?.overall_risk_score) || 5;
  const riskFactor = Math.max(0, (10 - riskScore) / 10);

  // Quality factor (1-100)
  const qScore = Number(quality?.quality_score) || 60;
  const qualityFactor = Math.min(1, qScore / 100);

  // Market analyst's own confidence
  const marketConf = Number(market?.confidence) || 0.6;

  // Weighted confidence
  const confidence = Math.max(0, Math.min(1,
    0.30 * demandSignal +
    0.20 * Math.max(0, Math.min(1, priceMargin + 0.5)) +
    0.25 * riskFactor +
    0.10 * qualityFactor +
    0.15 * marketConf
  ));

  let recommendation: "GO" | "HOLD" | "NO_GO";
  if (confidence >= 0.65 && priceMargin >= -0.05 && riskScore <= 7) recommendation = "GO";
  else if (confidence >= 0.45) recommendation = "HOLD";
  else recommendation = "NO_GO";

  return {
    recommendation,
    confidence: Math.round(confidence * 100) / 100,
    signals: {
      demand: market?.demand_level || "unknown",
      demand_signal: Math.round(demandSignal * 100) / 100,
      price_margin_pct: Math.round(priceMargin * 100),
      risk_level: risk?.threat_level || "unknown",
      risk_score: riskScore,
      quality_score: qScore,
    },
    rationale: `Demand ${market?.demand_level}, risk ${risk?.threat_level} (${riskScore}/10), recommended R${recPrice}/kg vs floor R${minPrice}/kg.`,
  };
}

// Phase 1: Intelligence gathering only — NO negotiation, NO deal creation.
async function runOrchestratorAnalysis(apiKey: string, crop: string, quantityKg: number, minPrice: number) {
  const [marketData, qualityData] = await Promise.all([
    runMarketAnalyst(apiKey, crop, quantityKg, minPrice),
    runQualityInspector(apiKey, crop, quantityKg),
  ]);
  const riskAnalysis = await runRiskAnalyst(apiKey, crop, quantityKg, marketData);

  const decision = synthesizeDecision(marketData, qualityData, riskAnalysis, minPrice);

  return {
    phase: "analysis",
    market_analysis: marketData,
    quality_assessment: qualityData,
    risk_analysis: riskAnalysis,
    decision,
    agents_used: [
      { name: AGENTS.market_analyst.role, status: "completed", role: "demand_signal" },
      { name: AGENTS.quality_inspector.role, status: "completed", role: "grading_signal" },
      { name: AGENTS.risk_analyst.role, status: "completed", role: "confidence_modifier" },
    ],
    intelligence_summary: {
      crop,
      quantity_kg: quantityKg,
      quality_score: qualityData.quality_score,
      risk_level: riskAnalysis.threat_level,
      risk_score: riskAnalysis.overall_risk_score,
      recommended_price: marketData.recommended_price,
      confidence: decision.confidence,
      recommendation: decision.recommendation,
    },
  };
}

// Phase 2: Execute GO decision — Negotiator runs against real buyers, supply chain plan generated.
async function executeGoDecision(apiKey: string, crop: string, quantityKg: number, minPrice: number, marketData: any, candidateBuyers: any[], farmerHistory: any) {
  const negotiation = await runNegotiator(apiKey, crop, quantityKg, minPrice, marketData, candidateBuyers, farmerHistory);
  const supplyChain = await runSupplyChainOptimizer(apiKey, crop, quantityKg, marketData, negotiation);
  return { negotiation, supply_chain: supplyChain };
}

async function recomputeFarmerStats(supabase: any, farmerName: string, crop: string) {
  const { data: outcomes } = await supabase
    .from("deal_outcomes").select("*")
    .eq("farmer_name", farmerName).eq("crop", crop);
  if (!outcomes || outcomes.length === 0) return;
  const closed = outcomes.length;
  const won = outcomes.filter((o: any) => o.outcome === "won" || o.outcome === "paid").length;
  const actualPrices = outcomes.filter((o: any) => o.actual_price).map((o: any) => Number(o.actual_price));
  const predictedPrices = outcomes.filter((o: any) => o.predicted_price).map((o: any) => Number(o.predicted_price));
  const ratings = outcomes.filter((o: any) => o.farmer_rating).map((o: any) => Number(o.farmer_rating));
  const avgActual = actualPrices.length ? actualPrices.reduce((a: number, b: number) => a + b, 0) / actualPrices.length : null;
  const avgPredicted = predictedPrices.length ? predictedPrices.reduce((a: number, b: number) => a + b, 0) / predictedPrices.length : null;
  const avgRating = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null;
  let accuracy = null;
  const pairs = outcomes.filter((o: any) => o.predicted_price && o.actual_price);
  if (pairs.length) {
    const errs = pairs.map((o: any) => Math.abs(Number(o.actual_price) - Number(o.predicted_price)) / Number(o.predicted_price));
    accuracy = Math.max(0, 1 - errs.reduce((a: number, b: number) => a + b, 0) / errs.length);
  }
  const payload = {
    farmer_name: farmerName, crop,
    deals_closed: closed, deals_won: won,
    avg_achieved_price: avgActual, avg_predicted_price: avgPredicted,
    avg_rating: avgRating, prediction_accuracy: accuracy,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase
    .from("farmer_crop_stats").select("id")
    .eq("farmer_name", farmerName).eq("crop", crop).maybeSingle();
  if (existing) await supabase.from("farmer_crop_stats").update(payload).eq("id", existing.id);
  else await supabase.from("farmer_crop_stats").insert(payload);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, farmer_name, crop, quantity_kg, deal_id } = body;

    if (!farmer_name) {
      return new Response(JSON.stringify({ error: "farmer_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: perms } = await supabase
      .from("agent_permissions")
      .select("*")
      .eq("farmer_name", farmer_name)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    // ── Actions that don't require auto_negotiate ────────────────
    if (action === "get_permissions") {
      return new Response(JSON.stringify({ success: true, permissions: perms || { auto_negotiate: false, min_price_per_kg: null, crops: [], max_deal_value: null, allow_logistics: false } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_deals") {
      const { data: deals } = await supabase
        .from("agent_deals")
        .select("*")
        .eq("farmer_name", farmer_name)
        .order("created_at", { ascending: false })
        .limit(20);
      return new Response(JSON.stringify({ success: true, deals: deals || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_permissions") {
      const { auto_negotiate, min_price_per_kg, crops, max_deal_value, allow_logistics } = body;
      const updateData: any = { updated_at: new Date().toISOString() };
      if (auto_negotiate !== undefined) updateData.auto_negotiate = auto_negotiate;
      if (min_price_per_kg !== undefined) updateData.min_price_per_kg = min_price_per_kg;
      if (crops !== undefined) updateData.crops = crops;
      if (max_deal_value !== undefined) updateData.max_deal_value = max_deal_value;
      if (allow_logistics !== undefined) updateData.allow_logistics = allow_logistics;

      if (perms) {
        await supabase.from("agent_permissions").update(updateData).eq("id", perms.id);
      } else {
        await supabase.from("agent_permissions").insert({ farmer_name, ...updateData });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Public actions (no auto_negotiate gate) ──────────────────
    if (action === "get_buyers") {
      let q = supabase.from("buyers").select("*").eq("active", true).order("reliability_score", { ascending: false });
      if (crop) q = q.contains("crops", [crop]);
      const { data: buyers } = await q;
      return new Response(JSON.stringify({ success: true, buyers: buyers || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_outcomes") {
      const { data: outcomes } = await supabase
        .from("deal_outcomes").select("*")
        .eq("farmer_name", farmer_name).order("created_at", { ascending: false }).limit(50);
      const { data: stats } = await supabase
        .from("farmer_crop_stats").select("*").eq("farmer_name", farmer_name);
      return new Response(JSON.stringify({ success: true, outcomes: outcomes || [], stats: stats || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "mark_paid") {
      const { paid_amount, payment_reference, payment_method } = body;
      if (!deal_id) return new Response(JSON.stringify({ error: "deal_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: deal } = await supabase.from("agent_deals").select("*").eq("id", deal_id).single();
      if (!deal) throw new Error("Deal not found");
      await supabase.from("agent_deals").update({
        payment_status: "paid", paid_amount, paid_at: new Date().toISOString(),
        payment_reference, payment_method, status: "completed",
      }).eq("id", deal_id);
      const days = deal.executed_at
        ? Math.max(0, Math.floor((Date.now() - new Date(deal.executed_at).getTime()) / 86400000))
        : null;
      const actualPrice = deal.quantity_kg ? Number(paid_amount) / Number(deal.quantity_kg) : null;
      await supabase.from("deal_outcomes").insert({
        deal_id, farmer_name, crop: deal.crop,
        predicted_price: deal.predicted_price, actual_price: actualPrice,
        predicted_confidence: deal.confidence, recommendation: deal.recommendation,
        outcome: "paid", days_to_close: days,
      });
      await recomputeFarmerStats(supabase, farmer_name, deal.crop);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "draft_offer") {
      const { buyer_name, buyer_type, region, price_per_kg, language, market_price } = body;
      if (!crop) return new Response(JSON.stringify({ error: "crop required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const lang = language === "zu" ? "isiZulu" : "South African English (en-ZA)";
      const sys = `You draft short, polite, professional WhatsApp/SMS offer messages from a smallholder farmer to a produce buyer. Reply ONLY with JSON: { "message": string }. Keep under 320 characters. Mention farmer name, crop, quantity in kg, asking price per kg in ZAR, brief quality note, and a clear call-to-action ("Reply YES to confirm or call back"). No emojis. Language: ${lang}.`;
      const ctx = `Farmer: ${farmer_name}\nCrop: ${crop}\nQuantity: ${quantity_kg || 100}kg\nAsking: R${price_per_kg}/kg\nBuyer: ${buyer_name} (${buyer_type || "buyer"}, ${region || "SA"})${market_price ? `\nCurrent SA market avg: R${market_price}/kg` : ""}`;
      try {
        const drafted = await callGemini(GEMINI_API_KEY, sys, ctx);
        return new Response(JSON.stringify({ success: true, message: drafted.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        const fallback = `Hi ${buyer_name}, this is ${farmer_name}. I have ${quantity_kg || 100}kg of fresh ${crop} available at R${price_per_kg}/kg. Quality grade. Reply YES to confirm or call me back. Thanks.`;
        return new Response(JSON.stringify({ success: true, message: fallback, fallback: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "rate_deal") {
      const { rating, feedback_note } = body;
      if (!deal_id) return new Response(JSON.stringify({ error: "deal_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: deal } = await supabase.from("agent_deals").select("*").eq("id", deal_id).single();
      if (!deal) throw new Error("Deal not found");
      await supabase.from("agent_deals").update({ farmer_rating: rating, feedback_note }).eq("id", deal_id);
      const { data: existing } = await supabase.from("deal_outcomes").select("id").eq("deal_id", deal_id).maybeSingle();
      if (existing) {
        await supabase.from("deal_outcomes").update({ farmer_rating: rating, feedback_note }).eq("id", existing.id);
      } else {
        await supabase.from("deal_outcomes").insert({
          deal_id, farmer_name, crop: deal.crop,
          predicted_price: deal.predicted_price, actual_price: deal.negotiated_price,
          predicted_confidence: deal.confidence, recommendation: deal.recommendation,
          outcome: "rated", farmer_rating: rating, feedback_note,
        });
      }
      await recomputeFarmerStats(supabase, farmer_name, deal.crop);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Actions requiring auto_negotiate permission ──────────────
    if (!perms || !perms.auto_negotiate) {
      return new Response(JSON.stringify({
        error: "Agent not authorized. Enable auto-negotiate in your Permissions tab first.",
        needs_permission: true,
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const minPrice = perms.min_price_per_kg || 0;

    if (action === "scan_market") {
      const analysis = await runMarketAnalyst(GEMINI_API_KEY, crop, quantity_kg || 100, minPrice);
      return new Response(JSON.stringify({ success: true, analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "assess_quality") {
      const quality = await runQualityInspector(GEMINI_API_KEY, crop, quantity_kg || 100);
      return new Response(JSON.stringify({ success: true, quality }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyze_risk") {
      const marketData = await runMarketAnalyst(GEMINI_API_KEY, crop, quantity_kg || 100, minPrice);
      const risk = await runRiskAnalyst(GEMINI_API_KEY, crop, quantity_kg || 100, marketData);
      return new Response(JSON.stringify({ success: true, risk, market_context: marketData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Orchestrator: Phase 1 — analysis only (no negotiation, no deal) ──
    if (action === "find_buyers" || action === "orchestrator_analyze") {
      const analysis = await runOrchestratorAnalysis(GEMINI_API_KEY, crop, quantity_kg || 100, minPrice);

      // Learning loop: bias confidence by farmer's prior prediction accuracy + win rate for this crop
      const { data: history } = await supabase
        .from("farmer_crop_stats").select("*")
        .eq("farmer_name", farmer_name).eq("crop", crop).maybeSingle();
      const { count: matchingBuyers } = await supabase
        .from("buyers").select("*", { count: "exact", head: true })
        .eq("active", true).contains("crops", [crop]);

      if (history && history.deals_closed >= 2) {
        const winRate = history.deals_won / history.deals_closed;
        const accuracy = Number(history.prediction_accuracy ?? 0.5);
        // Blend: 70% original confidence + 30% farmer-personal signal (winRate * accuracy)
        const personal = Math.max(0, Math.min(1, 0.5 * winRate + 0.5 * accuracy));
        const blended = 0.7 * analysis.decision.confidence + 0.3 * personal;
        analysis.decision.confidence = Math.round(blended * 100) / 100;
        analysis.decision.rationale += ` Personalized: ${history.deals_closed} prior deals, ${Math.round(winRate * 100)}% win rate.`;
        // Re-evaluate recommendation gates with blended confidence
        const recPrice = Number(analysis.market_analysis?.recommended_price) || 0;
        const priceMargin = minPrice > 0 ? (recPrice - minPrice) / minPrice : 0.2;
        const riskScore = Number(analysis.risk_analysis?.overall_risk_score) || 5;
        if (analysis.decision.confidence >= 0.65 && priceMargin >= -0.05 && riskScore <= 7) analysis.decision.recommendation = "GO";
        else if (analysis.decision.confidence >= 0.45) analysis.decision.recommendation = "HOLD";
        else analysis.decision.recommendation = "NO_GO";
      }
      analysis.candidate_buyer_count = matchingBuyers || 0;
      analysis.farmer_history = history || null;

      return new Response(JSON.stringify({ success: true, crew: analysis, requires_decision: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // (moved above auth gate)

    // ── Orchestrator: Phase 2 — execute GO decision (farmer-approved) ─────
    if (action === "execute_decision") {
      const { decision, market_analysis, quality_assessment, risk_analysis } = body;
      if (decision !== "GO") {
        return new Response(JSON.stringify({ success: true, message: `Decision ${decision} acknowledged. No agents dispatched.` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!market_analysis) {
        return new Response(JSON.stringify({ error: "market_analysis required from prior orchestrator phase" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Pull real candidate buyers + farmer history (learning loop input)
      const { data: buyers } = await supabase
        .from("buyers").select("*").eq("active", true).contains("crops", [crop])
        .order("reliability_score", { ascending: false }).limit(8);
      const { data: history } = await supabase
        .from("farmer_crop_stats").select("*")
        .eq("farmer_name", farmer_name).eq("crop", crop).maybeSingle();

      const exec = await executeGoDecision(GEMINI_API_KEY, crop, quantity_kg || 100, minPrice, market_analysis, buyers || [], history);

      let dealId: string | null = null;
      if (exec.negotiation?.best_deal) {
        const finalPrice = parseFloat(exec.negotiation.best_deal.final_price) || minPrice;
        const candidateBuyerId = exec.negotiation.best_deal.buyer_id || null;
        const validatedBuyerId = candidateBuyerId && (buyers || []).some((b: any) => b.id === candidateBuyerId)
          ? candidateBuyerId : null;
        const { data: inserted } = await supabase.from("agent_deals").insert({
          farmer_name, crop,
          quantity_kg: quantity_kg || 100,
          asking_price: minPrice,
          negotiated_price: finalPrice,
          buyer_name: exec.negotiation.best_deal.buyer_name,
          buyer_id: validatedBuyerId,
          status: "negotiated",
          approval_state: "approved",
          approved_at: new Date().toISOString(),
          executed_at: new Date().toISOString(),
          predicted_price: market_analysis.recommended_price,
          recommendation: "GO",
          confidence: body.confidence ?? null,
          payment_status: "unpaid",
          notes: JSON.stringify({
            orchestrator_decision: "GO",
            strategy: exec.negotiation.strategy_used,
            quality_score: quality_assessment?.quality_score,
            risk_level: risk_analysis?.threat_level,
            channel: exec.supply_chain?.optimal_channel?.name,
            payment_terms: exec.negotiation.best_deal.payment_terms,
          }),
        }).select("id").single();
        dealId = inserted?.id || null;
      }

      return new Response(JSON.stringify({
        success: true, execution: exec, deal_id: dealId,
        candidate_buyer_count: (buyers || []).length,
        farmer_history: history || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "arrange_logistics") {
      if (!perms.allow_logistics) {
        return new Response(JSON.stringify({ error: "Logistics permission not granted" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!deal_id) {
        return new Response(JSON.stringify({ error: "deal_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: deal } = await supabase.from("agent_deals").select("*").eq("id", deal_id).single();
      if (!deal) throw new Error("Deal not found");

      const logistics = await runLogisticsCoordinator(GEMINI_API_KEY, deal.crop, deal.quantity_kg || 100, deal.buyer_name || "TBD", farmer_name);

      await supabase.from("agent_deals")
        .update({ logistics_status: "arranged", delivery_date: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0] })
        .eq("id", deal_id);

      return new Response(JSON.stringify({ success: true, logistics, agent: AGENTS.logistics_coordinator.role }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-negotiate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
