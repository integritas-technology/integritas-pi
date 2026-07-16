import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bug, Layers3, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { nav } from "../app/nav";
import type { StatusOverview } from "../app/types";
import { SidebarUserBox } from "../features/auth/SidebarUserBox";
import type { AuthUser } from "../features/auth/types";
import { getDebugPing } from "../features/debug/debugApi";
import { FeedbackModal } from "../features/feedback/FeedbackModal";
import { useUpdateStatusRefresh } from "../features/update/useUpdateStatusRefresh";
import { cx } from "../lib/cx";
import { Button } from "./Button";
import { Card } from "./Card";
import { Clock } from "./Clock";
import { StatusBadge } from "./StatusBadge";

export function AppShell({
  user,
  onSignOut,
  children,
}: {
  user: AuthUser;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const activeItem = useMemo(() => {
    const item = nav.find((navItem) => pathname === `/${navItem.id}`);
    if (item) return item;
    if (pathname === "/settings") return { ...nav[0], id: "settings" as const, label: "Settings" };
    return nav[0];
  }, [pathname]);

  const [overview, setOverview] = useState<StatusOverview | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    fetch("/api/status/overview")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<StatusOverview>;
      })
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  const serviceIsOk = (name: string) =>
    Boolean(overview?.services.find((service) => service.name === name)?.ok);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  useUpdateStatusRefresh((status) => {
    setUpdateAvailable(
      Boolean(status?.services.some((service) => !service.upToDate)),
    );
  });

  const [debugPinging, setDebugPinging] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);

  function pingDebugEndpoint() {
    setDebugPinging(true);
    setDebugMessage(null);
    getDebugPing()
      .then((data) => setDebugMessage(data.message))
      .catch((error) => setDebugMessage(`Error: ${error.message}`))
      .finally(() => setDebugPinging(false));
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
          <div className="flex items-center gap-3 rounded-[24px] bg-slate-950 p-4 text-white">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10"><Layers3 size={24} /></div>
            <div><p className="m-0 text-[0.86rem] text-slate-400">Minima Edge Stack</p><h1 className="m-0 mt-0.5 text-base font-bold">Edge Workbench</h1></div>
          </div>

          <SidebarUserBox
            user={user}
            onSignOut={onSignOut}
            onSettings={() => navigate("/settings")}
          />

          <nav className="mt-3 grid gap-1">
            {nav.map(({ id, label, icon: Icon, badge }) => (
              <NavLink
                key={id}
                to={`/${id}`}
                className={({ isActive }) => cx(
                  "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950",
                  isActive && "bg-slate-950 text-white hover:bg-slate-950 hover:text-white"
                )}
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-3 text-[0.92rem] font-semibold"><Icon size={19} />{label}</span>
                    {badge && <span className={cx("rounded-full bg-violet-100 px-2 py-0.5 text-[0.63rem] font-extrabold text-violet-700", isActive && "bg-white/15 text-white")}>{badge}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {updateAvailable && (
            <a
              href="/update"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-violet-700 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-800"
            >
              <Sparkles size={16} /> Update available
            </a>
          )}

          <Button className="mt-4 w-full" size="sm" variant="secondary" onClick={() => setFeedbackOpen(true)}>
            <MessageSquare size={16} /> Feedback
          </Button>

          <Card className="mt-6 bg-slate-50">
            <div className="flex items-center gap-2 font-bold"><ShieldCheck size={18} /> Edge gateway prototype</div>
            <p className="mt-3 text-slate-500">A browser-first workbench for node, wallet, verified data, and automation workflows at the edge.</p>
          </Card>

          <Card className="mt-4 bg-slate-50">
            <div className="flex items-center gap-2 font-bold"><Bug size={18} /> debug v1</div>
            <p className="mt-3 text-slate-500">
              Checks that the frontend and backend you&apos;re looking at were both built from this change.
            </p>
            <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={pingDebugEndpoint} disabled={debugPinging}>
              {debugPinging ? "Pinging…" : "Ping backend"}
            </Button>
            {debugMessage && <p className="mt-2 wrap-break-word text-sm text-slate-500">{debugMessage}</p>}
          </Card>
        </aside>

        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <header className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex items-center gap-3">
                <div><p className="m-0 text-[0.86rem] text-slate-400">Current section</p><h2 className="m-0 mt-0.5 text-xl font-extrabold tracking-[-0.03em] text-slate-950">{activeItem.label}</h2></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge ok={serviceIsOk("backend")}>Node online</StatusBadge>
                <StatusBadge ok={serviceIsOk("minima")}>Wallet ready</StatusBadge>
                <StatusBadge ok={serviceIsOk("integritas")}>Integritas connected</StatusBadge>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
              <Button size="sm" variant="secondary" className="lg:hidden" onClick={() => setFeedbackOpen(true)}>
                <MessageSquare size={16} /> Feedback
              </Button>
              <Clock />
            </div>
          </header>

          <div className="my-4 flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {nav.map(({ id, label }) => (
              <NavLink
                key={id}
                to={`/${id}`}
                className={({ isActive }) => cx(
                  "whitespace-nowrap rounded-full bg-white px-3 py-2 text-sm font-bold text-slate-600",
                  isActive && "bg-slate-950 text-white"
                )}
              >
                {label}
              </NavLink>
            ))}
            {updateAvailable && (
              <a href="/update" className="whitespace-nowrap rounded-full bg-violet-700 px-3 py-2 text-sm font-bold text-white">
                Update
              </a>
            )}
          </div>

          {children}
        </main>
      </div>
      {feedbackOpen && <FeedbackModal pagePath={`${pathname}${search}`} pageLabel={activeItem.label} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
