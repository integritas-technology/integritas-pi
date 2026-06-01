import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BellRing,
  ChevronRight,
  Cloud,
  Database,
  FileClock,
  Gauge,
  HardDrive,
  KeyRound,
  Layers3,
  LineChart,
  RadioTower,
  Settings,
  ShieldCheck,
  Wallet
} from "lucide-react";

type Tone = "neutral" | "good" | "warn" | "future";
type NavId = "dashboard" | "setup" | "node" | "wallet" | "integritas" | "data" | "automation" | "diagnostics" | "marketplace";

type NavItem = { id: NavId; label: string; icon: LucideIcon; badge?: string };
type Health = { status: string; service: string };
type FileItem = { name: string; type: "file" | "directory" | "other"; size?: number };
type FilesResponse = { path: string; items: FileItem[] };
type MinimaStatus = { ok: boolean; status?: number; source: string; body?: unknown; error?: string };
type IntegritasConfig = { baseUrl: string; requestId: string; hasApiKey: boolean; apiKeySource: "database" | "environment" | "none" };
type StatusOverview = {
  generatedAt: string;
  services: Array<{ name: string; ok: boolean; status: string; details?: unknown; error?: string }>;
  resources?: {
    containers?: Array<{
      service: string;
      containerId: string;
      state: string;
      status: string;
      cpuPercent: number | null;
      memory: { usage?: string | null; limit?: string | null } | null;
      disk: { rootFs?: string | null };
    }>;
    disks?: Array<{ path: string; used: string; total: string; free: string; usedPercent: number }>;
    error?: string;
  };
};

const nav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "setup", label: "Setup", icon: Settings },
  { id: "node", label: "Minima Core", icon: RadioTower },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "integritas", label: "Integritas", icon: ShieldCheck },
  { id: "data", label: "Data Sources", icon: Database },
  { id: "automation", label: "Automation", icon: BellRing },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
  { id: "marketplace", label: "Marketplace", icon: LineChart, badge: "V2 Preview" }
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function joinPath(currentPath: string, child: string) {
  return currentPath === "/" ? `/${child}` : `${currentPath}/${child}`;
}

function parentPath(currentPath: string) {
  if (currentPath === "/") return "/";
  const parts = currentPath.split("/").filter(Boolean);
  parts.pop();
  return parts.length === 0 ? "/" : `/${parts.join("/")}`;
}

function formatSize(size?: number) {
  if (size === undefined) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as T;
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={cx("pill", `pill-${tone}`)}>{children}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={cx("card", className)}>{children}</section>;
}

function Section({ eyebrow, title, desc, action }: { eyebrow: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function Page({ eyebrow, title, desc, action, children }: { eyebrow: string; title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="page-stack"><Section eyebrow={eyebrow} title={title} desc={desc} action={action} />{children}</div>;
}

function EmptyPage({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <Page eyebrow={eyebrow} title={title} desc={desc}>
      <Card className="empty-card">
        <Layers3 size={26} />
        <h3>No implementation yet</h3>
        <p>This page is included to define the product structure. No mock data or placeholder actions are wired here.</p>
      </Card>
    </Page>
  );
}

function JsonPreview({ value }: { value: unknown }) {
  return <pre className="json-preview">{JSON.stringify(value, null, 2)}</pre>;
}

function StatusBadge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <Pill tone={ok ? "good" : "warn"}>{children}</Pill>;
}

function AppShell({ active, setActive, children }: { active: NavId; setActive: (id: NavId) => void; children: React.ReactNode }) {
  const activeItem = useMemo(() => nav.find((item) => item.id === active) ?? nav[0], [active]);

  return (
    <div className="app-root">
      <div className="workbench">
        <aside className="desktop-sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon"><Layers3 size={24} /></div>
            <div>
              <p>Minima Edge Stack</p>
              <h1>Edge Workbench</h1>
            </div>
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
              <div>
                <p>Current section</p>
                <h2>{activeItem.label}</h2>
              </div>
            </div>
            <div className="topbar-pills">
              <Pill tone="neutral">Pi Edition</Pill>
              <Pill tone="neutral">Prototype</Pill>
            </div>
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

function DashboardPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [overview, setOverview] = useState<StatusOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err: Error) => setHealthError(err.message));

    fetch("/api/status/overview")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<StatusOverview>;
      })
      .then(setOverview)
      .catch((err: Error) => setOverviewError(err.message));
  }, []);

  const displayedServices = [
    { name: "frontend", ok: true, status: "ok", details: { service: "integritas-pi-frontend", note: "UI loaded in browser" } },
    ...(overview?.services ?? [])
  ];

  return (
    <Page eyebrow="Dashboard" title="Minima Edge Workbench" desc="A real-time overview of the services currently wired into this Raspberry Pi prototype.">
      <section className="hero-card">
        <div>
          <div className="hero-pills"><Pill>Pi Edition</Pill><Pill>Edge Workbench</Pill><Pill>Prototype</Pill></div>
          <h1>Trusted edge services from one browser UI</h1>
          <p>Monitor the backend, Minima node, Integritas API connection, and Docker resource usage without dropping into the command line.</p>
        </div>
        <div className="hero-panel">
          <p>Backend health</p>
          <h3>{health ? health.status : healthError ? "error" : "checking"}</h3>
          <span>{health?.service ?? healthError ?? "Waiting for backend response"}</span>
        </div>
      </section>

      <div className="metrics-grid">
        {displayedServices.map((service) => (
          <Card className="metric-card" key={service.name}>
            <div className="metric-icon"><Activity size={21} /></div>
            <p>{service.name}</p>
            <h3>{service.status}</h3>
            <StatusBadge ok={service.ok}>{service.ok ? "Online" : "Attention"}</StatusBadge>
          </Card>
        ))}
      </div>

      {overviewError && <Card><p className="error-text">{overviewError}</p></Card>}

      <section className="two-column">
        <Card>
          <Section eyebrow="Services" title="Service details" />
          <div className="status-grid">
            {displayedServices.map((service) => (
              <article className="status-card" key={service.name}>
                <div className="status-row compact">
                  <strong>{service.name}</strong>
                  <StatusBadge ok={service.ok}>{service.status}</StatusBadge>
                </div>
                {service.error && <p className="error-text">{service.error}</p>}
                {service.details !== undefined && <JsonPreview value={service.details} />}
              </article>
            ))}
          </div>
        </Card>

        <Card>
          <Section eyebrow="Resources" title="Container usage" desc="Read from Docker when the backend can access the socket." />
          {overview?.resources?.error && <p className="error-text">{overview.resources.error}</p>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Service</th><th>State</th><th>CPU</th><th>Memory</th><th>Image disk</th></tr></thead>
              <tbody>
                {overview?.resources?.containers?.map((container) => (
                  <tr key={container.containerId}>
                    <td>{container.service}</td>
                    <td>{container.status}</td>
                    <td>{container.cpuPercent === null ? "n/a" : `${container.cpuPercent}%`}</td>
                    <td>{container.memory?.usage ?? "n/a"}</td>
                    <td>{container.disk.rootFs ?? "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </Page>
  );
}

function MinimaPage() {
  const [minimaStatus, setMinimaStatus] = useState<MinimaStatus | null>(null);
  const [minimaError, setMinimaError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/minima/status")
      .then((response) => response.json() as Promise<MinimaStatus>)
      .then(setMinimaStatus)
      .catch((err: Error) => setMinimaError(err.message));
  }, []);

  return (
    <Page eyebrow="Minima Core" title="Run the Minima node" desc="Read Minima node status through the backend and Docker network.">
      <Card>
        <div className="status-row">
          <strong>Minima status</strong>
          <StatusBadge ok={Boolean(minimaStatus?.ok)}>{minimaStatus ? `HTTP ${minimaStatus.status}` : minimaError ? "error" : "checking"}</StatusBadge>
        </div>
        {minimaStatus?.source && <code>{minimaStatus.source}</code>}
        {minimaStatus?.error && <p className="error-text">{minimaStatus.error}</p>}
        {minimaStatus?.body !== undefined && <JsonPreview value={minimaStatus.body} />}
      </Card>
    </Page>
  );
}

function IntegritasPage() {
  const [config, setConfig] = useState<IntegritasConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [canonicalBytes, setCanonicalBytes] = useState("{\n  \"message\": \"Hello Integritas\"\n}\n");
  const [hash, setHash] = useState("");
  const [proofUid, setProofUid] = useState("");
  const [proofPayload, setProofPayload] = useState("[]");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshConfig().catch((err: Error) => setError(err.message));
  }, []);

  async function refreshConfig() {
    const response = await fetch("/api/integritas/config");
    setConfig(await response.json() as IntegritasConfig);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await action();
      setResult(response);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page eyebrow="Integritas" title="Prove local data" desc="Hash canonical bytes, request a timestamp, poll proof status, and verify stored proofs through backend-only API calls.">
      <Card className="config-card">
        <div>
          <strong>Runtime configuration</strong>
          <code>baseUrl: {config?.baseUrl ?? "loading..."}</code>
          <code>requestId: {config?.requestId ?? "loading..."}</code>
          <code>apiKeySource: {config?.apiKeySource ?? "loading..."}</code>
        </div>
        <StatusBadge ok={Boolean(config?.hasApiKey)}>{config?.hasApiKey ? "API key configured" : "API key missing"}</StatusBadge>
      </Card>

      <Card className="form-card">
        <label>Integritas API key<input value={apiKeyInput} onChange={(event) => setApiKeyInput(event.target.value)} placeholder="Paste API key to store encrypted in SQLite" type="password" /></label>
        <div className="button-row">
          <button type="button" disabled={busy || !apiKeyInput} onClick={() => run(async () => {
            const response = await postJson("/api/integritas/api-key", { apiKey: apiKeyInput });
            setApiKeyInput("");
            await refreshConfig();
            return response;
          })}>Save API key</button>
          <button type="button" disabled={busy || !config?.hasApiKey} onClick={() => run(async () => {
            const response = await fetch("/api/integritas/api-key", { method: "DELETE" });
            const parsed = await response.json();
            if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
            await refreshConfig();
            return parsed;
          })}>Clear stored key</button>
        </div>

        <label>Canonical bytes<textarea value={canonicalBytes} onChange={(event) => setCanonicalBytes(event.target.value)} rows={8} /></label>
        <div className="button-row">
          <button type="button" disabled={busy} onClick={() => run(async () => {
            const response = await postJson<{ hash: string }>("/api/integritas/hash", { canonicalBytes });
            setHash(response.hash);
            return response;
          })}>Hash bytes</button>
          <button type="button" disabled={busy} onClick={() => run(async () => {
            const response = await postJson<{ hash: string; proofUid: string }>("/api/integritas/stamp", { canonicalBytes });
            setHash(response.hash);
            setProofUid(response.proofUid);
            return response;
          })}>Stamp hash</button>
        </div>

        <label>SHA3-256 hash<input value={hash} onChange={(event) => setHash(event.target.value)} placeholder="Generated hash" /></label>
        <label>Proof UID<input value={proofUid} onChange={(event) => setProofUid(event.target.value)} placeholder="UID from stamp request" /></label>
        <button type="button" disabled={busy || !proofUid} onClick={() => run(async () => {
          const response = await postJson<{ proofPayloads: Array<{ uid?: string; proofPayload: unknown }> }>("/api/integritas/status", { uids: [proofUid] });
          const readyPayload = response.proofPayloads.find((item) => item.proofPayload)?.proofPayload;
          if (readyPayload) setProofPayload(JSON.stringify(readyPayload, null, 2));
          return response;
        })}>Poll proof status</button>
        <label>Proof payload JSON<textarea value={proofPayload} onChange={(event) => setProofPayload(event.target.value)} rows={8} /></label>
        <button type="button" disabled={busy} onClick={() => run(async () => postJson("/api/integritas/verify", { canonicalBytes, storedHash: hash, proofPayload: JSON.parse(proofPayload) }))}>Verify proof</button>

        {error && <p className="error-text">{error}</p>}
        {result !== null && <JsonPreview value={result} />}
      </Card>
    </Page>
  );
}

function DataSourcesPage() {
  return (
    <Page eyebrow="Data Sources" title="Local data access" desc="Current implementation: read-only file explorer for the configured host directory.">
      <FilesPanel />
    </Page>
  );
}

function FilesPanel() {
  const [currentPath, setCurrentPath] = useState("/");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/files?path=${encodeURIComponent(currentPath)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load files: HTTP ${response.status}`);
        return response.json() as Promise<FilesResponse>;
      })
      .then((data) => {
        setCurrentPath(data.path);
        setItems(data.items);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [currentPath]);

  return (
    <Card>
      <div className="status-row">
        <div><strong>File explorer</strong><code>{currentPath}</code></div>
        <button type="button" onClick={() => setCurrentPath(parentPath(currentPath))} disabled={currentPath === "/"}>Back</button>
      </div>
      {loading && <p className="muted">Loading files...</p>}
      {error && <p className="error-text">{error}</p>}
      <ul className="file-list">
        {items.map((item) => (
          <li key={`${item.type}-${item.name}`}>
            {item.type === "directory" ? <button type="button" className="file-button" onClick={() => setCurrentPath(joinPath(currentPath, item.name))}><span>Directory</span><strong>{item.name}</strong><ChevronRight size={17} /></button> : <div className="file-row"><span>{item.type}</span><strong>{item.name}</strong><small>{formatSize(item.size)}</small></div>}
          </li>
        ))}
      </ul>
      {!loading && items.length === 0 && !error && <p className="muted">No files found in this directory.</p>}
    </Card>
  );
}

function ActivePage({ active }: { active: NavId }) {
  const pages: Record<NavId, React.ReactNode> = {
    dashboard: <DashboardPage />,
    setup: <EmptyPage eyebrow="Setup" title="Guided setup" desc="Installation and access setup flow is not implemented yet." />,
    node: <MinimaPage />,
    wallet: <EmptyPage eyebrow="Wallet" title="Wallet and tokens" desc="Wallet management is not implemented yet." />,
    integritas: <IntegritasPage />,
    data: <DataSourcesPage />,
    automation: <EmptyPage eyebrow="Automation" title="Automation" desc="Rules, triggers, and actions are not implemented yet." />,
    diagnostics: <EmptyPage eyebrow="Diagnostics" title="Diagnostics" desc="Dedicated diagnostics tooling is not implemented yet. Current service health is available on Dashboard." />,
    marketplace: <EmptyPage eyebrow="Marketplace - V2 Preview" title="Marketplace" desc="Marketplace functionality is not implemented yet." />
  };
  return <>{pages[active]}</>;
}

export default function App() {
  const [active, setActive] = useState<NavId>("dashboard");
  return <AppShell active={active} setActive={setActive}><ActivePage active={active} /></AppShell>;
}
