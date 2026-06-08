import { useState } from "react";
import type { NavId } from "./app/types";
import { AppShell } from "./components/AppShell";
import { OnboardingWizard, isOnboardingComplete, markOnboardingComplete, resetOnboarding } from "./mock/onboarding";
import {
  LoginScreen,
  getSession,
  logout,
  markAdminLogin,
  markGuestLogin,
  type MockSession,
} from "./mock/login";
import { DashboardPage } from "./pages/DashboardPage";
import { DataSourcesPage } from "./pages/DataSourcesPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { IntegritasPage } from "./pages/IntegritasPage";
import { MinimaPage } from "./pages/MinimaPage";
import { AutomationPage } from "./pages/AutomationPage";
import { SetupPage } from "./pages/SetupPage";
import { WalletPage } from "./pages/WalletPage";

function ActivePage({
  active,
  setActive,
  onRestartOnboarding,
  onSignOut,
}: {
  active: NavId;
  setActive: (id: NavId) => void;
  onRestartOnboarding: () => void;
  onSignOut: () => void;
}) {
  const pages: Record<NavId, React.ReactNode> = {
    dashboard: <DashboardPage onStartSetup={() => setActive("setup")} />,
    setup: (
      <SetupPage
        onRestartOnboarding={onRestartOnboarding}
        onSignOut={onSignOut}
      />
    ),
    node: <MinimaPage />,
    wallet: <WalletPage />,
    integritas: <IntegritasPage />,
    data: <DataSourcesPage />,
    automation: <AutomationPage />,
    diagnostics: <DiagnosticsPage />
  };
  return <>{pages[active]}</>;
}

export default function App() {
  const [active, setActive] = useState<NavId>("dashboard");
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete());
  const [session, setSession] = useState<MockSession | null>(() => getSession());

  const syncSession = () => {
    setSession(getSession());
  };

  const finishOnboarding = () => {
    markOnboardingComplete();
    markAdminLogin("admin");
    syncSession();
    setShowOnboarding(false);
  };

  const skipOnboardingAsGuest = () => {
    markOnboardingComplete();
    markGuestLogin();
    syncSession();
    setShowOnboarding(false);
  };

  const handleAdminLogin = (username: string) => {
    markAdminLogin(username);
    syncSession();
  };

  const handleGuestLogin = () => {
    markGuestLogin();
    syncSession();
  };

  const handleSignOut = () => {
    logout();
    setSession(null);
  };

  const restartOnboarding = () => {
    resetOnboarding();
    logout();
    setSession(null);
    setShowOnboarding(true);
  };

  const startAdminSetup = () => {
    resetOnboarding();
    setShowOnboarding(true);
  };

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={finishOnboarding}
        onSkip={skipOnboardingAsGuest}
      />
    );
  }

  if (!session) {
    return (
      <LoginScreen
        onAdminLogin={handleAdminLogin}
        onGuestLogin={handleGuestLogin}
      />
    );
  }

  return (
    <AppShell
      active={active}
      setActive={setActive}
      session={session}
      onSignOut={handleSignOut}
      onCreateAdminAccount={session.mode === "guest" ? startAdminSetup : undefined}
    >
      <ActivePage
        active={active}
        setActive={setActive}
        onRestartOnboarding={restartOnboarding}
        onSignOut={handleSignOut}
      />
    </AppShell>
  );
}
