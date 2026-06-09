import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { setUnauthorizedHandler } from "../../lib/api";
import { getMe, getSetupStatus, logout } from "./api";
import { AuthContext } from "./hooks";
import { LoginPage } from "./LoginPage";
import { OnboardingWizard } from "../setup/OnboardingWizard";
import type { AuthUser } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getSetupStatus();
      if (!status.setupComplete) {
        setShowSetup(true);
        setShowLogin(false);
        setUser(null);
        return;
      }

      setShowSetup(false);
      try {
        const me = await getMe();
        setUser(me);
        setShowLogin(false);
      } catch {
        setUser(null);
        setShowLogin(true);
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
      setShowSetup(false);
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
    setShowSetup(false);
  }, []);

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
      <div className="app-loading-root">
        <p>Loading…</p>
      </div>
    );
  }

  if (showSetup) {
    return <OnboardingWizard onComplete={() => void refreshSession()} />;
  }

  if (showLogin || !user) {
    return <LoginPage onSuccess={() => void refreshSession()} />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
