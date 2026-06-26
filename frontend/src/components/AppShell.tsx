import { useEffect, useMemo, useState } from "react";
import { Layers3, ShieldCheck } from "lucide-react";
import { nav } from "../app/nav";
import type { NavId, StatusOverview } from "../app/types";
import { SidebarUserBox } from "../features/auth/SidebarUserBox";
import type { AuthUser } from "../features/auth/types";
import { cx } from "../lib/cx";
import { Card } from "./Card";
import { Clock } from "./Clock";
import { StatusBadge } from "./StatusBadge";

export function AppShell({
  active,
  setActive,
  user,
  onSignOut,
  children,
}: {
  active: NavId;
  setActive: (id: NavId) => void;
  user: AuthUser;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const activeItem = useMemo(() => nav.find((item) => item.id === active) ?? nav[0], [active]);
  const [overview, setOverview] = useState<StatusOverview | null>(null);

  useEffect(() => {
    fetch("/api/status/overview")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<StatusOverview>;
      })
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  const serviceIsOk = (name: string) => Boolean(overview?.services.find((service) => service.name === name)?.ok);

  return (
    <div className="app-root">
      <div className="workbench">
        <aside className="desktop-sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon"><Layers3 size={24} /></div>
            <div><p>Minima Edge Stack</p><h1>Edge Workbench</h1></div>
          </div>

          <SidebarUserBox user={user} onSignOut={onSignOut} onSettings={() => setActive("settings")} />

          <nav className="nav-list">
            {nav.map(({ id, label, icon: Icon, badge }) => (
              <button key={id} type="button" onClick={() => setActive(id)} className={cx("nav-item", active === id && "active") }>
                <span><Icon size={19} />{label}</span>
                {badge && <span className="nav-badge">{badge}</span>}
              </button>
            ))}
          </nav>

          <Card className="sidebar-note">
            <div><ShieldCheck size={18} /> Edge gateway prototype</div>
            <p>A browser-first workbench for node, wallet, verified data, and automation workflows at the edge.</p>
          </Card>
        </aside>

        <main className="main-area">
          <header className="topbar">
            <div className="topbar-left">
              <div className="topbar-title">
                <div><p>Current section</p><h2>{activeItem.label}</h2></div>
              </div>
              <div className="topbar-pills">
                <StatusBadge ok={serviceIsOk("backend")}>Node online</StatusBadge>
                <StatusBadge ok={serviceIsOk("minima")}>Wallet ready</StatusBadge>
                <StatusBadge ok={serviceIsOk("integritas")}>Integritas connected</StatusBadge>
              </div>
            </div>
            <div className="topbar-right"><Clock /></div>
          </header>

          <div className="mobile-nav">
            {nav.map(({ id, label }) => (
              <button key={id} type="button" onClick={() => setActive(id)} className={cx(active === id && "active")}>{label}</button>
            ))}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
