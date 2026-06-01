import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import type { Health, StatusOverview } from "../app/types";
import { Card } from "../components/Card";
import { JsonPreview } from "../components/JsonPreview";
import { Page } from "../components/Page";
import { Pill } from "../components/Pill";
import { Section } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";

export function DashboardPage() {
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
                <div className="status-row compact"><strong>{service.name}</strong><StatusBadge ok={service.ok}>{service.status}</StatusBadge></div>
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
