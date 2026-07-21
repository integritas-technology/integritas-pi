import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { setUnauthorizedHandler } from "../../lib/api";
import { getMe, getSetupStatus, logout } from "./api";
import { AuthContext } from "./hooks";
import { OnboardingWizard } from "../setup/OnboardingWizard";
import type { AuthUser } from "./types";

type SetupMode = "fresh" | "resume" | null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState<SetupMode>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getSetupStatus();
      if (!status.localAdminCreated) {
        setSetupMode("fresh");
        setShowLogin(false);
        setUser(null);
        return;
      }

      try {
        const me = await getMe();
        setUser(me);
        setShowLogin(false);
        setSetupMode(status.setupComplete ? null : "resume");
      } catch {
        setUser(null);
        setShowLogin(true);
        setSetupMode(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setShowLogin(true);
      setSetupMode(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Clear local state even if logout request fails
    }
    setUser(null);
    setShowLogin(true);
    setSetupMode(null);
  }, []);

  const showSetup = setupMode !== null;
  const value = useMemo(
    () => ({
      user,
      loading,
      showSetup,
      showLogin,
      signOut,
      refreshSession,
    }),
    [user, loading, showSetup, showLogin, signOut, refreshSession],
  );

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-600">
        <p>Loading…</p>
      </div>
    );
  }

  if (showSetup) {
    return <OnboardingWizard resumeAtConnect={setupMode === "resume"} onComplete={() => void refreshSession()} />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
