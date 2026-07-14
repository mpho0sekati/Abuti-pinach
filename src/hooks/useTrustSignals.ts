import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrustSignals {
  isVerified: boolean;
  successfulDeals: number;
  averageRating: number | null;
  ratingCount: number;
}

/**
 * Trust signals for a seller in the marketplace.
 * - isVerified: profile.verified flag (set when phone is confirmed or admin verifies)
 * - successfulDeals: number of offers accepted on listings owned by this seller
 * - averageRating / ratingCount: aggregated from seller_ratings
 */
export function useTrustSignals(userId: string | undefined) {
  return useQuery({
    queryKey: ["trust-signals", userId],
    queryFn: async (): Promise<TrustSignals> => {
      if (!userId)
        return { isVerified: false, successfulDeals: 0, averageRating: null, ratingCount: 0 };

      const [{ data: profile }, { count: deals }, { data: ratings }] = await Promise.all([
        supabase.from("profiles").select("verified, phone").eq("id", userId).maybeSingle(),
        supabase
          .from("offers")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", userId)
          .eq("status", "accepted"),
        supabase.from("seller_ratings").select("stars").eq("seller_id", userId),
      ]);

      const stars = (ratings ?? []).map((r: any) => r.stars as number);
      const avg = stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null;

      return {
        isVerified: !!(profile?.verified ?? profile?.phone),
        successfulDeals: deals ?? 0,
        averageRating: avg,
        ratingCount: stars.length,
      };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
