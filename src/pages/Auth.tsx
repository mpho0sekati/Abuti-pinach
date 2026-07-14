import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Sprout, Mail, Phone as PhoneIcon, Lock, Loader2 } from "lucide-react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  displayName: z.string().trim().min(1, "Name required").max(80).optional(),
});
const phoneSchema = z.object({
  phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/, "Use international format e.g. +2782..."),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  displayName: z.string().trim().min(1, "Name required").max(80).optional(),
});

type Mode = "signin" | "signup";
type Method = "email" | "phone";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (method === "email") {
        const parsed = emailSchema.safeParse({ email, password, displayName: mode === "signup" ? displayName : undefined });
        if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
        if (mode === "signup") {
          const { error } = await supabase.auth.signUp({
            email, password,
            options: { emailRedirectTo: `${window.location.origin}/setup`, data: { display_name: displayName } },
          });
          if (error) throw error;
          toast.success("Account created — let's set up your profile");
          navigate("/setup");
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          navigate("/");
        }
      } else {
        const parsed = phoneSchema.safeParse({ phone, password, displayName: mode === "signup" ? displayName : undefined });
        if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
        if (mode === "signup") {
          const { error } = await supabase.auth.signUp({
            phone, password,
            options: { data: { display_name: displayName } },
          });
          if (error) throw error;
          toast.success("Account created");
          navigate("/setup");
        } else {
          const { error } = await supabase.auth.signInWithPassword({ phone, password });
          if (error) throw error;
          navigate("/");
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) { toast.error("Google sign-in failed"); return; }
      if (result.redirected) return;
      navigate("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 py-10" style={{
      fontFamily: FONT,
      background: "radial-gradient(ellipse at top, hsl(120, 35%, 92%) 0%, hsl(90, 25%, 97%) 60%)",
    }}>
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div className="flex flex-col items-center mb-6">
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, hsl(130, 70%, 55%), hsl(130, 55%, 32%))",
            boxShadow: "0 8px 28px hsla(130, 55%, 40%, 0.35), inset 0 -8px 18px hsla(130, 70%, 20%, 0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
          }}>
            <Sprout size={28} color="hsl(50, 95%, 70%)" strokeWidth={2.2} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "hsl(130, 30%, 22%)", margin: 0 }}>Abuti Spinach</h1>
          <p style={{ fontSize: 13, color: "hsl(130, 20%, 40%)", marginTop: 4 }}>
            {mode === "signin" ? "Welcome back" : "Join the marketplace"}
          </p>
        </div>

        <div style={{
          background: "hsla(0, 0%, 100%, 0.85)",
          backdropFilter: "blur(20px) saturate(1.4)",
          borderRadius: 22, padding: 22,
          boxShadow: "0 18px 48px hsla(130, 30%, 25%, 0.12), inset 0 0 0 1px hsla(0, 0%, 100%, 0.8)",
        }}>
          {/* Method tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: "hsla(130, 20%, 92%, 0.6)" }}>
            {(["email", "phone"] as const).map(m => (
              <button key={m} type="button" onClick={() => setMethod(m)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: method === m ? "white" : "transparent",
                  color: method === m ? "hsl(130, 35%, 28%)" : "hsl(130, 15%, 50%)",
                  boxShadow: method === m ? "0 2px 8px hsla(130, 30%, 25%, 0.08)" : "none",
                }}>
                {m === "email" ? <Mail size={13} /> : <PhoneIcon size={13} />}
                {m === "email" ? "Email" : "Phone"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <Field label="Your name" value={displayName} onChange={setDisplayName} placeholder="e.g. Thabo Nkosi" />
            )}
            {method === "email" ? (
              <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@farm.co.za" />
            ) : (
              <Field label="Phone" value={phone} onChange={setPhone} type="tel" placeholder="+27821234567" />
            )}
            <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 8 characters" icon={<Lock size={13} />} />

            <button type="submit" disabled={busy}
              className="mt-2 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: "linear-gradient(140deg, hsl(130, 55%, 38%), hsl(140, 50%, 30%))",
                color: "white", border: "none", cursor: busy ? "wait" : "pointer",
                boxShadow: "0 6px 18px hsla(130, 55%, 30%, 0.32)",
                opacity: busy ? 0.7 : 1,
              }}>
              {busy ? <Loader2 size={16} className="animate-spin inline" /> : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: "hsla(130, 20%, 70%, 0.3)" }} />
            <span style={{ fontSize: 10, color: "hsl(130, 15%, 50%)", letterSpacing: "0.1em" }}>OR</span>
            <div className="flex-1 h-px" style={{ background: "hsla(130, 20%, 70%, 0.3)" }} />
          </div>

          <button type="button" onClick={handleGoogle} disabled={busy}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: "white", color: "hsl(130, 30%, 22%)",
              border: "1px solid hsla(130, 20%, 60%, 0.25)", cursor: "pointer",
            }}>
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.3-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.5-4.6 2.4-7.3 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39 16.3 43.5 24 43.5z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.8l6.2 5.2c-.4.4 6.6-4.8 6.6-15 0-1.3-.1-2.3-.5-3.5z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center mt-5" style={{ fontSize: 12, color: "hsl(130, 18%, 45%)" }}>
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              style={{ color: "hsl(130, 55%, 35%)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="text-center mt-4" style={{ fontSize: 10, color: "hsl(130, 15%, 50%)" }}>
          Secure auth · Password leak detection enabled · Your location stays private
        </p>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, type = "text", placeholder, icon }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; icon?: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1">
    <span style={{ fontSize: 11, fontWeight: 600, color: "hsl(130, 25%, 35%)", letterSpacing: "0.02em" }}>{label}</span>
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{
        padding: "11px 14px", borderRadius: 12, border: "1px solid hsla(130, 20%, 60%, 0.25)",
        background: "white", fontSize: 14, color: "hsl(130, 30%, 18%)", fontFamily: FONT, outline: "none",
      }}
      required
    />
  </label>
);

export default Auth;
