import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft, Wallet, CalendarDays, Calculator, Beef, Users,
  Plus, Trash2, CheckCircle2, Circle, TrendingUp, TrendingDown,
} from "lucide-react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";
const ZAR = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

// ─── LEDGER ────────────────────────────────────────────────────────────
type Ledger = {
  id: string; kind: "income" | "expense"; category: string;
  amount: number; crop: string | null; note: string | null; occurred_on: string;
};
const LEDGER_CATS = ["Seed", "Fertilizer", "Feed", "Fuel", "Labour", "Transport", "Repairs", "Sale", "Other"];

function LedgerTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Ledger[]>([]);
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("Seed");
  const [amount, setAmount] = useState("");
  const [crop, setCrop] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    const { data } = await supabase.from("farm_ledger" as any).select("*")
      .order("occurred_on", { ascending: false }).limit(100);
    setRows((data as any) ?? []);
  };
  useEffect(() => { load(); }, [userId]);

  const add = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const { error } = await supabase.from("farm_ledger" as any).insert({
      user_id: userId, kind, category, amount: amt,
      crop: crop || null, note: note || null, occurred_on: today(),
    });
    if (error) return toast.error(error.message);
    setAmount(""); setCrop(""); setNote("");
    toast.success("Saved");
    load();
  };
  const del = async (id: string) => {
    await supabase.from("farm_ledger" as any).delete().eq("id", id);
    load();
  };

  const totals = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const inMonth = rows.filter(r => new Date(r.occurred_on) >= monthStart);
    const income = inMonth.filter(r => r.kind === "income").reduce((s, r) => s + Number(r.amount), 0);
    const expense = inMonth.filter(r => r.kind === "expense").reduce((s, r) => s + Number(r.amount), 0);
    return { income, expense, profit: income - expense };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Income</div>
          <div className="text-base font-semibold text-emerald-600 flex items-center gap-1">
            <TrendingUp size={14} />{ZAR(totals.income)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Expense</div>
          <div className="text-base font-semibold text-rose-600 flex items-center gap-1">
            <TrendingDown size={14} />{ZAR(totals.expense)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Profit</div>
          <div className={`text-base font-semibold ${totals.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {ZAR(totals.profit)}
          </div>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LEDGER_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" inputMode="decimal" placeholder="Amount (R)" value={amount} onChange={e => setAmount(e.target.value)} />
          <Input placeholder="Crop (optional)" value={crop} onChange={e => setCrop(e.target.value)} />
        </div>
        <Input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
        <Button onClick={add} className="w-full"><Plus size={16} /> Add entry</Button>
      </Card>

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No entries yet.</p>}
        {rows.map(r => (
          <Card key={r.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                {r.category}{r.crop ? ` · ${r.crop}` : ""}
              </div>
              <div className="text-[11px] text-muted-foreground">{r.occurred_on}{r.note ? ` · ${r.note}` : ""}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${r.kind === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                {r.kind === "income" ? "+" : "-"}{ZAR(Number(r.amount))}
              </span>
              <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-rose-500">
                <Trash2 size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── CALENDAR ──────────────────────────────────────────────────────────
type Task = { id: string; crop: string; task: string; due_date: string; done: boolean };
function CalendarTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Task[]>([]);
  const [crop, setCrop] = useState("");
  const [task, setTask] = useState("");
  const [due, setDue] = useState(today());

  const load = async () => {
    const { data } = await supabase.from("crop_calendar" as any).select("*").order("due_date");
    setRows((data as any) ?? []);
  };
  useEffect(() => { load(); }, [userId]);

  const add = async () => {
    if (!crop.trim() || !task.trim()) return toast.error("Crop and task required");
    const { error } = await supabase.from("crop_calendar" as any).insert({
      user_id: userId, crop, task, due_date: due,
    });
    if (error) return toast.error(error.message);
    setCrop(""); setTask("");
    load();
  };
  const toggle = async (t: Task) => {
    await supabase.from("crop_calendar" as any).update({ done: !t.done }).eq("id", t.id);
    load();
  };
  const del = async (id: string) => {
    await supabase.from("crop_calendar" as any).delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Crop (e.g. Maize)" value={crop} onChange={e => setCrop(e.target.value)} />
          <Input type="date" value={due} onChange={e => setDue(e.target.value)} />
        </div>
        <Input placeholder="Task (e.g. Plant seeds, Apply fertilizer)" value={task} onChange={e => setTask(e.target.value)} />
        <Button onClick={add} className="w-full"><Plus size={16} /> Add task</Button>
      </Card>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No tasks yet.</p>}
        {rows.map(t => (
          <Card key={t.id} className={`p-3 flex items-center gap-3 ${t.done ? "opacity-60" : ""}`}>
            <button onClick={() => toggle(t)} className="text-emerald-600">
              {t.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </button>
            <div className="flex-1">
              <div className={`text-sm font-medium ${t.done ? "line-through" : ""}`}>{t.task}</div>
              <div className="text-[11px] text-muted-foreground">{t.crop} · due {t.due_date}</div>
            </div>
            <button onClick={() => del(t.id)} className="text-muted-foreground hover:text-rose-500">
              <Trash2 size={14} />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── INPUT COST CALCULATOR ─────────────────────────────────────────────
const CROP_PRESETS: Record<string, { seedKgPerHa: number; seedCostPerKg: number; fertKgPerHa: number; fertCostPerKg: number; waterM3PerHa: number; expectedYieldTonPerHa: number; pricePerTon: number }> = {
  Maize:     { seedKgPerHa: 25,  seedCostPerKg: 40,  fertKgPerHa: 250, fertCostPerKg: 15, waterM3PerHa: 5000, expectedYieldTonPerHa: 5,   pricePerTon: 4500 },
  Spinach:   { seedKgPerHa: 8,   seedCostPerKg: 220, fertKgPerHa: 180, fertCostPerKg: 18, waterM3PerHa: 4000, expectedYieldTonPerHa: 12,  pricePerTon: 8000 },
  Tomato:    { seedKgPerHa: 0.4, seedCostPerKg: 4200,fertKgPerHa: 300, fertCostPerKg: 20, waterM3PerHa: 6000, expectedYieldTonPerHa: 40,  pricePerTon: 9000 },
  Cabbage:   { seedKgPerHa: 0.5, seedCostPerKg: 3200,fertKgPerHa: 220, fertCostPerKg: 17, waterM3PerHa: 4500, expectedYieldTonPerHa: 30,  pricePerTon: 5500 },
  Potato:    { seedKgPerHa: 2000,seedCostPerKg: 12,  fertKgPerHa: 400, fertCostPerKg: 16, waterM3PerHa: 5500, expectedYieldTonPerHa: 25,  pricePerTon: 6500 },
  Sunflower: { seedKgPerHa: 5,   seedCostPerKg: 120, fertKgPerHa: 150, fertCostPerKg: 15, waterM3PerHa: 3500, expectedYieldTonPerHa: 1.5, pricePerTon: 9500 },
};
function CalculatorTab() {
  const [crop, setCrop] = useState<keyof typeof CROP_PRESETS>("Maize");
  const [ha, setHa] = useState("1");
  const p = CROP_PRESETS[crop];
  const size = parseFloat(ha) || 0;
  const seedCost = p.seedKgPerHa * p.seedCostPerKg * size;
  const fertCost = p.fertKgPerHa * p.fertCostPerKg * size;
  const waterM3 = p.waterM3PerHa * size;
  const totalInput = seedCost + fertCost;
  const expectedRevenue = p.expectedYieldTonPerHa * p.pricePerTon * size;
  const expectedProfit = expectedRevenue - totalInput;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Crop</Label>
            <Select value={crop} onValueChange={(v) => setCrop(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(CROP_PRESETS).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Hectares</Label>
            <Input type="number" inputMode="decimal" value={ha} onChange={e => setHa(e.target.value)} />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3"><div className="text-[11px] text-muted-foreground uppercase">Seed needed</div>
          <div className="text-sm font-semibold">{(p.seedKgPerHa * size).toFixed(1)} kg</div>
          <div className="text-[11px] text-muted-foreground">{ZAR(seedCost)}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted-foreground uppercase">Fertilizer</div>
          <div className="text-sm font-semibold">{(p.fertKgPerHa * size).toFixed(0)} kg</div>
          <div className="text-[11px] text-muted-foreground">{ZAR(fertCost)}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted-foreground uppercase">Water</div>
          <div className="text-sm font-semibold">{waterM3.toLocaleString()} m³</div>
          <div className="text-[11px] text-muted-foreground">≈ per season</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted-foreground uppercase">Total input cost</div>
          <div className="text-sm font-semibold">{ZAR(totalInput)}</div></Card>
      </div>
      <Card className="p-4 bg-emerald-50/60 border-emerald-200">
        <div className="text-[11px] text-emerald-700 uppercase tracking-wider">Expected outcome</div>
        <div className="text-sm mt-1">Yield: <b>{(p.expectedYieldTonPerHa * size).toFixed(1)} tons</b> @ {ZAR(p.pricePerTon)}/t</div>
        <div className="text-sm">Revenue: <b>{ZAR(expectedRevenue)}</b></div>
        <div className={`text-base font-bold mt-1 ${expectedProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
          Profit estimate: {ZAR(expectedProfit)}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Ballpark figures based on SA averages. Actual costs vary by region and season.</p>
      </Card>
    </div>
  );
}

// ─── LIVESTOCK ─────────────────────────────────────────────────────────
type Animal = {
  id: string; species: string; tag: string | null; count: number;
  birth_date: string | null; last_vaccination: string | null; last_health_check: string | null; notes: string | null;
};
function LivestockTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Animal[]>([]);
  const [species, setSpecies] = useState("Cattle");
  const [tag, setTag] = useState("");
  const [count, setCount] = useState("1");
  const [vax, setVax] = useState("");

  const load = async () => {
    const { data } = await supabase.from("livestock" as any).select("*").order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  };
  useEffect(() => { load(); }, [userId]);

  const add = async () => {
    const c = parseInt(count) || 1;
    const { error } = await supabase.from("livestock" as any).insert({
      user_id: userId, species, tag: tag || null, count: c,
      last_vaccination: vax || null,
    });
    if (error) return toast.error(error.message);
    setTag(""); setCount("1"); setVax("");
    load();
  };
  const del = async (id: string) => {
    await supabase.from("livestock" as any).delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={species} onValueChange={setSpecies}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Cattle", "Goats", "Sheep", "Chickens", "Pigs", "Ducks", "Other"].map(s =>
                <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Count" value={count} onChange={e => setCount(e.target.value)} />
        </div>
        <Input placeholder="Tag / group name (optional)" value={tag} onChange={e => setTag(e.target.value)} />
        <div>
          <Label className="text-xs">Last vaccination</Label>
          <Input type="date" value={vax} onChange={e => setVax(e.target.value)} />
        </div>
        <Button onClick={add} className="w-full"><Plus size={16} /> Add to register</Button>
      </Card>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No animals registered.</p>}
        {rows.map(a => {
          const overdue = a.last_vaccination && (Date.now() - new Date(a.last_vaccination).getTime()) > 1000 * 60 * 60 * 24 * 180;
          return (
            <Card key={a.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{a.count}× {a.species}{a.tag ? ` · ${a.tag}` : ""}</div>
                <div className="text-[11px] text-muted-foreground">
                  {a.last_vaccination ? `Vax: ${a.last_vaccination}` : "No vax record"}
                  {overdue && <span className="ml-2 text-rose-600 font-semibold">Vax overdue</span>}
                </div>
              </div>
              <button onClick={() => del(a.id)} className="text-muted-foreground hover:text-rose-500">
                <Trash2 size={14} />
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── COMMUNITY ─────────────────────────────────────────────────────────
type Post = { id: string; user_id: string; province: string | null; title: string; body: string; tag: string | null; created_at: string };
type Reply = { id: string; post_id: string; user_id: string; body: string; created_at: string };
function CommunityTab({ userId, province }: { userId: string; province: string | null }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [reply, setReply] = useState("");

  const load = async () => {
    const { data } = await supabase.from("community_posts" as any).select("*")
      .order("created_at", { ascending: false }).limit(50);
    setPosts((data as any) ?? []);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!openId) { setReplies([]); return; }
    supabase.from("community_replies" as any).select("*").eq("post_id", openId).order("created_at")
      .then(({ data }) => setReplies((data as any) ?? []));
  }, [openId]);

  const post = async () => {
    if (title.trim().length < 3) return toast.error("Title too short");
    if (!body.trim()) return toast.error("Add some detail");
    const { error } = await supabase.from("community_posts" as any).insert({
      user_id: userId, title, body, tag: tag || null, province,
    });
    if (error) return toast.error(error.message);
    setTitle(""); setBody(""); setTag("");
    toast.success("Posted");
    load();
  };
  const sendReply = async () => {
    if (!openId || !reply.trim()) return;
    const { error } = await supabase.from("community_replies" as any).insert({
      post_id: openId, user_id: userId, body: reply,
    });
    if (error) return toast.error(error.message);
    setReply("");
    const { data } = await supabase.from("community_replies" as any).select("*").eq("post_id", openId).order("created_at");
    setReplies((data as any) ?? []);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Ask fellow farmers</div>
        <Input placeholder="Question title" value={title} onChange={e => setTitle(e.target.value)} maxLength={140} />
        <Textarea placeholder="Details, symptoms, what you've tried…" value={body} onChange={e => setBody(e.target.value)} maxLength={4000} rows={3} />
        <Input placeholder="Tag (e.g. pests, weather, prices)" value={tag} onChange={e => setTag(e.target.value)} />
        <Button onClick={post} className="w-full"><Plus size={16} /> Post</Button>
      </Card>

      <div className="space-y-2">
        {posts.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No posts yet — be the first.</p>}
        {posts.map(p => (
          <Card key={p.id} className="p-3">
            <button onClick={() => setOpenId(openId === p.id ? null : p.id)} className="w-full text-left">
              <div className="text-sm font-semibold">{p.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {p.province ?? "—"} · {new Date(p.created_at).toLocaleDateString()}
                {p.tag && <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">#{p.tag}</span>}
              </div>
              <p className="text-sm mt-2 whitespace-pre-wrap">{p.body}</p>
            </button>
            {openId === p.id && (
              <div className="mt-3 pt-3 border-t space-y-2">
                {replies.map(r => (
                  <div key={r.id} className="text-sm bg-muted/40 rounded-md p-2">
                    {r.body}
                    <div className="text-[10px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input placeholder="Write a reply…" value={reply} onChange={e => setReply(e.target.value)} />
                  <Button onClick={sendReply} size="sm">Reply</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── PAGE ──────────────────────────────────────────────────────────────
export default function FarmerToolkit() {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) navigate("/auth", { state: { from: "/toolkit" } });
  }, [loading, session, navigate]);

  if (!session) return null;
  const userId = session.user.id;

  return (
    <div className="min-h-dvh mx-auto w-full max-w-[720px] px-4 pb-24 pt-4" style={{ fontFamily: FONT, background: "linear-gradient(180deg,#f7faf5 0%,#eef4ea 100%)" }}>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-full hover:bg-black/5"><ArrowLeft size={18} /></button>
        <h1 className="text-lg font-bold tracking-tight">Farmer Toolkit</h1>
      </div>

      <Tabs defaultValue="ledger">
        <TabsList className="grid grid-cols-5 w-full h-auto p-1 bg-white/70 backdrop-blur">
          <TabsTrigger value="ledger" className="flex-col gap-0.5 py-2 text-[10px]"><Wallet size={16} />Ledger</TabsTrigger>
          <TabsTrigger value="calendar" className="flex-col gap-0.5 py-2 text-[10px]"><CalendarDays size={16} />Calendar</TabsTrigger>
          <TabsTrigger value="calc" className="flex-col gap-0.5 py-2 text-[10px]"><Calculator size={16} />Costs</TabsTrigger>
          <TabsTrigger value="livestock" className="flex-col gap-0.5 py-2 text-[10px]"><Beef size={16} />Livestock</TabsTrigger>
          <TabsTrigger value="community" className="flex-col gap-0.5 py-2 text-[10px]"><Users size={16} />Peers</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="ledger"><LedgerTab userId={userId} /></TabsContent>
          <TabsContent value="calendar"><CalendarTab userId={userId} /></TabsContent>
          <TabsContent value="calc"><CalculatorTab /></TabsContent>
          <TabsContent value="livestock"><LivestockTab userId={userId} /></TabsContent>
          <TabsContent value="community"><CommunityTab userId={userId} province={profile?.province ?? null} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
