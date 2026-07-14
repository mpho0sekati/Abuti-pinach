import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, sessionId, plans, planId, status } = await req.json();

    // GET plans for a session
    if (action === "get") {
      const { data, error } = await supabase
        .from("farm_plans")
        .select("*")
        .eq("session_id", sessionId)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return new Response(JSON.stringify({ plans: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SAVE multiple plans (from AI-generated calendar)
    if (action === "save") {
      if (!Array.isArray(plans) || plans.length === 0) {
        return new Response(JSON.stringify({ error: "No plans provided" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rows = plans.map((p: any) => ({
        session_id: sessionId,
        farmer_name: p.farmer_name || null,
        task_title: p.task_title,
        task_description: p.task_description || null,
        due_date: p.due_date,
        category: p.category || "general",
        status: "pending",
      }));

      const { data, error } = await supabase
        .from("farm_plans")
        .insert(rows)
        .select();

      if (error) throw error;
      return new Response(JSON.stringify({ saved: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE plan status
    if (action === "update") {
      const { error } = await supabase
        .from("farm_plans")
        .update({
          status,
          completed_at: status === "done" ? new Date().toISOString() : null,
        })
        .eq("id", planId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("farm-plans error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
