import { useState } from "react";
import type { NavId } from "./app/types";
import { AppShell } from "./components/AppShell";
import { EmptyPage } from "./components/EmptyPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DataSourcesPage } from "./pages/DataSourcesPage";
import { IntegritasPage } from "./pages/IntegritasPage";
import { MinimaPage } from "./pages/MinimaPage";

function ActivePage({ active }: { active: NavId }) {
  const pages: Record<NavId, React.ReactNode> = {
    dashboard: <DashboardPage />,
    setup: <EmptyPage eyebrow="Setup" title="Guided setup" desc="Installation and access setup flow is not implemented yet." />,
    node: <MinimaPage />,
    wallet: <EmptyPage eyebrow="Wallet" title="Wallet and tokens" desc="Wallet management is not implemented yet." />,
    integritas: <IntegritasPage />,
    data: <DataSourcesPage />,
    automation: <EmptyPage eyebrow="Automation" title="Automation" desc="Rules, triggers, and actions are not implemented yet." />,
    diagnostics: <EmptyPage eyebrow="Diagnostics" title="Diagnostics" desc="Dedicated diagnostics tooling is not implemented yet. Current service health is available on Dashboard." />
  };
  return <>{pages[active]}</>;
}

export default function App() {
  const [active, setActive] = useState<NavId>("dashboard");
  return <AppShell active={active} setActive={setActive}><ActivePage active={active} /></AppShell>;
}
