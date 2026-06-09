import { useState } from "react";
import type { NavId } from "./app/types";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "./features/auth";
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
  onSignOut,
}: {
  active: NavId;
  setActive: (id: NavId) => void;
  onSignOut: () => void;
}) {
  const pages: Record<NavId, React.ReactNode> = {
    dashboard: <DashboardPage onStartSetup={() => setActive("setup")} />,
    setup: <SetupPage onSignOut={onSignOut} />,
    node: <MinimaPage />,
    wallet: <WalletPage />,
    integritas: <IntegritasPage />,
    data: <DataSourcesPage />,
    automation: <AutomationPage />,
    diagnostics: <DiagnosticsPage />
  };
  return <>{pages[active]}</>;
}

function AppContent() {
  const [active, setActive] = useState<NavId>("dashboard");
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <AppShell
      active={active}
      setActive={setActive}
      user={user}
      onSignOut={() => void signOut()}
    >
      <ActivePage
        active={active}
        setActive={setActive}
        onSignOut={() => void signOut()}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
