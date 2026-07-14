import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Check, X, Repeat, Send } from "lucide-react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(45, 90%, 50%)",
  accepted: "hsl(130, 55%, 38%)",
  countered: "hsl(210, 75%, 50%)",
  declined: "hsl(0, 70%, 50%)",
  withdrawn: "hsl(0, 0%, 50%)",
};

const OfferThread = ({ offer, listing, onUpdate }: { offer: any; listing: any; onUpdate: () => void }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [counter, setCounter] = useState("");
  const isSeller = user?.id === offer.seller_id;

  const loadMessages = async () => {
    const { data } = await supabase.from("offer_messages").select("*").eq("offer_id", offer.id).order("created_at");
    setMessages(data ?? []);
  };
  useEffect(() => { loadMessages(); }, [offer.id]);

  const sendMessage = async () => {
    if (!body.trim() || !user) return;
    const { error } = await supabase.from("offer_messages").insert({ offer_id: offer.id, sender_id: user.id, body: body.trim().slice(0, 1000) });
    if (error) { toast.error(error.message); return; }
    setBody(""); loadMessages();
  };

  const updateStatus = async (status: "accepted" | "declined" | "withdrawn" | "countered") => {
    const { error } = await supabase.from("offers").update({ status }).eq("id", offer.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Offer ${status}`);
    onUpdate();
  };

  const sendCounter = async () => {
    const amt = Number(counter);
    if (!amt || amt <= 0 || !user) return;
    await supabase.from("offers").update({ status: "countered" }).eq("id", offer.id);
    const { error } = await supabase.from("offers").insert({
      listing_id: offer.listing_id, buyer_id: offer.buyer_id, seller_id: offer.seller_id,
      amount: amt, parent_offer_id: offer.id, status: "pending",
    });
    if (error) { toast.error(error.message); return; }
    setCounter(""); toast.success("Counter sent");
    onUpdate();
  };

  return (
    <div className="mt-5 p-4 rounded-2xl" style={{ background: "white", border: "1px solid hsla(130, 20%, 60%, 0.2)", fontFamily: FONT }}>
      <div className="flex items-center justify-between">
        <div>
          <div style={{ fontSize: 11, color: "hsl(130, 18%, 45%)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
            {isSeller ? "Offer received" : "Your offer"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "hsl(130, 55%, 32%)" }}>R {offer.amount}/{listing.unit ?? "kg"}</div>
        </div>
        <span className="px-3 py-1 rounded-full capitalize" style={{
          background: `${STATUS_COLORS[offer.status]}20`, color: STATUS_COLORS[offer.status],
          fontSize: 11, fontWeight: 700,
        }}>{offer.status}</span>
      </div>

      {offer.message && <p style={{ fontSize: 13, color: "hsl(130, 22%, 30%)", marginTop: 8 }}>"{offer.message}"</p>}

      {isSeller && offer.status === "pending" && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <ActionBtn onClick={() => updateStatus("accepted")} color="hsl(130, 55%, 38%)" Icon={Check} label="Accept" />
          <ActionBtn onClick={() => updateStatus("declined")} color="hsl(0, 70%, 50%)" Icon={X} label="Decline" />
          <ActionBtn onClick={() => document.getElementById("counter-input")?.focus()} color="hsl(210, 75%, 50%)" Icon={Repeat} label="Counter" />
        </div>
      )}

      {isSeller && offer.status === "pending" && (
        <div className="flex gap-2 mt-3">
          <input id="counter-input" type="number" value={counter} onChange={(e) => setCounter(e.target.value)}
            placeholder="Counter price"
            style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid hsla(130, 20%, 60%, 0.25)", fontSize: 13, fontFamily: FONT, outline: "none" }} />
          <button onClick={sendCounter} className="px-4 rounded-xl font-semibold text-xs"
            style={{ background: "hsl(210, 75%, 50%)", color: "white", border: "none" }}>Send</button>
        </div>
      )}

      {!isSeller && offer.status === "pending" && (
        <button onClick={() => updateStatus("withdrawn")} className="mt-3 text-xs" style={{ color: "hsl(0, 70%, 45%)", background: "none", border: "none", cursor: "pointer" }}>
          Withdraw offer
        </button>
      )}

      {/* Messages */}
      <div className="mt-4 flex flex-col gap-2 max-h-60 overflow-y-auto">
        {messages.map(m => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="px-3 py-2 rounded-2xl max-w-[80%]" style={{
                background: mine ? "hsl(130, 50%, 38%)" : "hsl(130, 30%, 95%)",
                color: mine ? "white" : "hsl(130, 30%, 20%)", fontSize: 13,
              }}>{m.body}</div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-3">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a message…" maxLength={1000}
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid hsla(130, 20%, 60%, 0.25)", fontSize: 13, fontFamily: FONT, outline: "none" }} />
        <button onClick={sendMessage} className="px-4 rounded-xl"
          style={{ background: "hsl(130, 55%, 38%)", color: "white", border: "none" }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};

const ActionBtn = ({ onClick, color, Icon, label }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 py-2 rounded-xl"
    style={{ background: `${color}15`, color, border: `1px solid ${color}40`, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
    <Icon size={16} />{label}
  </button>
);

export default OfferThread;
