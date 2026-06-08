import { useState } from "react";
import type { NavId } from "./app/types";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { DataSourcesPage } from "./pages/DataSourcesPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { IntegritasPage } from "./pages/IntegritasPage";
import { MinimaPage } from "./pages/MinimaPage";
import { AutomationPage } from "./pages/AutomationPage";
import { SetupPage } from "./pages/SetupPage";
import { WalletPage } from "./pages/WalletPage";

function ActivePage({ active, setActive }: { active: NavId; setActive: (id: NavId) => void }) {
  const pages: Record<NavId, React.ReactNode> = {
    dashboard: <DashboardPage onStartSetup={() => setActive("setup")} />,
    setup: <SetupPage />,
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
  return <AppShell active={active} setActive={setActive}><ActivePage active={active} setActive={setActive} /></AppShell>;
}
