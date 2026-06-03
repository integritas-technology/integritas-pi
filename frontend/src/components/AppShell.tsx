import { useMemo } from "react";
import { Layers3, ShieldCheck } from "lucide-react";
import { nav } from "../app/nav";
import type { NavId } from "../app/types";
import { cx } from "../lib/cx";
import { Card } from "./Card";
import { Clock } from "./Clock";
import { Pill } from "./Pill";

export function AppShell({ active, setActive, children }: { active: NavId; setActive: (id: NavId) => void; children: React.ReactNode }) {
  const activeItem = useMemo(() => nav.find((item) => item.id === active) ?? nav[0], [active]);

  return (
    <div className="app-root">
      <div className="workbench">
        <aside className="desktop-sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon"><Layers3 size={24} /></div>
            <div><p>Minima Edge Stack</p><h1>Edge Workbench</h1></div>
          </div>

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
            <div className="topbar-title">
              <div className="mobile-brand-icon"><Layers3 size={22} /></div>
              <div><p>Current section</p><h2>{activeItem.label}</h2></div>
            </div>
            <div className="topbar-right"><Clock /><div className="topbar-pills"><Pill tone="neutral">Pi Edition</Pill><Pill tone="neutral">Prototype</Pill></div></div>
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
