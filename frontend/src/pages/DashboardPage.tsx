import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Page } from "../components/Page";
import { listDataReads } from "../features/data-reads/dataReadsApi";
import type { DataSourceRead } from "../features/data-reads/dataReadTypes";
import { getHistory } from "../features/integritas/integritasApi";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";
import { formatLocalTime } from "../lib/time";

type ActivityItem = {
  id: string;
  createdAt: string;
  category: string;
  message: string;
  status: string;
  good: boolean;
};

const useCaseSteps = [
  { number: "01", title: "Connect data", text: "Sensor, file, API, webhook, or device log" },
  { number: "02", title: "Prove data", text: "Integritas timestamp, integrity check, and provenance" },
  { number: "03", title: "Trigger action", text: "Run workflows from data, proofs, or token events" },
  { number: "04", title: "Settle value", text: "Wallet payments, token access, and future marketplace revenue" }
];

const buildSteps = [
  { number: "1", title: "Deploy Edge Stack", text: "Install the Raspberry Pi Edition bundle and open Edge Workbench." },
  { number: "2", title: "Create wallet", text: "Create or import a Minima wallet for payments, tokens, and future marketplace revenue." },
  { number: "3", title: "Connect data", text: "Bring in sensor streams, device logs, local files, or APIs." },
  { number: "4", title: "Verify with Integritas", text: "Timestamp and attest selected data so it can be trusted." },
  { number: "5", title: "Automate events", text: "Trigger actions when payments, tokens, data, or proofs change." },
  { number: "6", title: "Build the use case", text: "Combine node, wallet, data, proof, and automation tools into a working edge workflow." }
];

export function DashboardPage() {
  const [proofs, setProofs] = useState<IntegritasProofRecord[]>([]);
  const [reads, setReads] = useState<DataSourceRead[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getHistory(), listDataReads()])
      .then(([proofHistory, readHistory]) => {
        setProofs(proofHistory.items);
        setReads(readHistory.items);
      })
      .catch((err: Error) => setActivityError(err.message));
  }, []);

  const activity = useMemo(() => buildActivity(proofs, reads), [proofs, reads]);

  return (
    <Page eyebrow="Dashboard" title="Minima Edge Workbench" desc="A browser-first workspace for trusted data, proofs, automation, and value flows at the edge.">
      <section className="hero-card use-case-hero">
        <div>
          <p className="eyebrow">Use case builder</p>
          <h1>Data to value</h1>
          <p>Connect. Prove. Trigger. Settle.</p>
        </div>
        <div className="use-case-grid">
          {useCaseSteps.map((step) => (
            <article className="use-case-step" key={step.number}>
              <span>{step.number}</span>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <Card className="build-flow-card">
        <div>
          <p className="eyebrow">Build flow</p>
          <h3>From setup to trusted edge workflow</h3>
          <p className="muted">Each step has one job: deploy, connect, prove, automate, then build.</p>
        </div>
        <div className="build-flow-grid">
          {buildSteps.map((step) => (
            <article className="build-flow-step" key={step.number}>
              <span>{step.number}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </Card>

      <Card className="live-activity-card">
        <div>
          <p className="eyebrow">Live activity</p>
          <h3>Events, attestations, and actions</h3>
          <p className="muted">A clear activity layer helps users understand what the Pi is doing in the background.</p>
        </div>
        {activityError && <p className="error-text">{activityError}</p>}
        <div className="activity-list">
          {activity.map((item) => (
            <article className="activity-item" key={item.id}>
              <div>
                <strong>{item.category}</strong>
                <p>{item.message}</p>
              </div>
              <time>{formatLocalTime(item.createdAt)}</time>
              <span className={item.good ? "pill pill-good" : "pill pill-warn"}>{item.status}</span>
            </article>
          ))}
        </div>
        {activity.length === 0 && !activityError && <p className="muted">No Diagnostics history entries yet.</p>}
      </Card>
    </Page>
  );
}

function buildActivity(proofs: IntegritasProofRecord[], reads: DataSourceRead[]) {
  const proofItems: ActivityItem[] = proofs.map((proof) => ({
    id: `proof-${proof.id}`,
    createdAt: proof.created_at,
    category: "Integritas API log",
    message: `Attestation created for ${proof.file_name ?? proof.hash.slice(0, 16)}`,
    status: proof.proof_status === "ready" ? "Success" : proof.proof_status === "failed" ? "Failed" : "Pending",
    good: proof.proof_status !== "failed"
  }));

  const readItems: ActivityItem[] = reads.map((read) => ({
    id: `read-${read.id}`,
    createdAt: read.createdAt,
    category: read.triggerType === "automation" ? "Trigger history" : "Data read log",
    message: `${read.sourceName} ${read.triggerType === "automation" ? "automation poll" : "manual read"}`,
    status: read.status === "success" ? "Success" : "Failed",
    good: read.status === "success"
  }));

  return [...proofItems, ...readItems]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 10);
}
