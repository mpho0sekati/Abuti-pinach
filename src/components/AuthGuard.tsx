import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const AuthGuard = ({ children, requireOnboarded = true }: { children: ReactNode; requireOnboarded?: boolean }) => {
  const { session, profile, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "hsl(90, 25%, 97%)" }}>
        <div style={{ fontFamily: "'SF Pro Text', system-ui, sans-serif", color: "hsl(130, 25%, 35%)", fontSize: 14 }}>
          Loading…
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  if (requireOnboarded && profile && !profile.onboarded) return <Navigate to="/setup" replace />;
  return <>{children}</>;
};
