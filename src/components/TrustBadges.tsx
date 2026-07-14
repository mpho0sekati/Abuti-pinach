import { ShieldCheck, Star, HandshakeIcon } from "lucide-react";
import { useTrustSignals } from "@/hooks/useTrustSignals";

type Size = "sm" | "md";

export function TrustBadges({ sellerId, size = "md", inline = false }: { sellerId?: string; size?: Size; inline?: boolean }) {
  const { data: trust } = useTrustSignals(sellerId);
  if (!trust) return null;

  const fs = size === "sm" ? 10 : 11;
  const ic = size === "sm" ? 10 : 12;

  return (
    <div className={inline ? "inline-flex items-center gap-1.5" : "flex items-center gap-1.5 flex-wrap"}>
      {trust.isVerified && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
          style={{ background: "hsl(130, 50%, 92%)", color: "#1f5e2a", fontSize: fs, fontWeight: 700 }}
          title="Verified seller">
          <ShieldCheck size={ic} /> Verified
        </span>
      )}
      {trust.averageRating != null && trust.ratingCount > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
          style={{ background: "#FEF3C7", color: "#7c5a07", fontSize: fs, fontWeight: 700 }}
          title={`${trust.ratingCount} ratings`}>
          <Star size={ic} fill="#EAB308" color="#EAB308" /> {trust.averageRating.toFixed(1)}
        </span>
      )}
      {trust.successfulDeals > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
          style={{ background: "hsl(200, 60%, 92%)", color: "#0d4a6e", fontSize: fs, fontWeight: 700 }}
          title="Successful deals">
          <HandshakeIcon size={ic} /> {trust.successfulDeals} deal{trust.successfulDeals === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
