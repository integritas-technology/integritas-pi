import { useState } from "react";
import type { NavId } from "./app/types";
import { AppShell } from "./components/AppShell";
import { OnboardingWizard, isOnboardingComplete, markOnboardingComplete, resetOnboarding } from "./mock/onboarding";
import { LoginScreen, isLoggedIn, logout, markLoggedIn } from "./mock/login";
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
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());

  const finishOnboarding = () => {
    markOnboardingComplete();
    setShowOnboarding(false);
  };

  const handleLogin = () => {
    markLoggedIn();
    setLoggedIn(true);
  };

  const handleSignOut = () => {
    logout();
    setLoggedIn(false);
  };

  const restartOnboarding = () => {
    resetOnboarding();
    logout();
    setLoggedIn(false);
    setShowOnboarding(true);
  };

  if (showOnboarding) {
    return <OnboardingWizard onComplete={finishOnboarding} onSkip={finishOnboarding} />;
  }

  if (!loggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <AppShell active={active} setActive={setActive}>
      <ActivePage
        active={active}
        setActive={setActive}
        onRestartOnboarding={restartOnboarding}
        onSignOut={handleSignOut}
      />
    </AppShell>
  );
}
