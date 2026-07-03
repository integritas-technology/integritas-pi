import { useState } from "react";
import { JsonPreview } from "../../components/JsonPreview";
import { formatLocalTime } from "../../lib/time";
import type { AutomationRun } from "./automationTypes";

export function AutomationRunsTable({ runs, compact = false }: { runs: AutomationRun[]; compact?: boolean }) {
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  if (runs.length === 0) return <p className="muted">No workflow runs recorded yet.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Started</th>
            {!compact && <th>Workflow</th>}
            <th>Trigger</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Blocks</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>{formatLocalTime(run.startedAt)}</td>
              {!compact && <td>{run.workflowName}</td>}
              <td>{run.triggerType}</td>
              <td><span className={`pill ${run.status === "success" ? "pill-good" : run.status === "failed" ? "pill-warn" : "pill-neutral"}`}>{run.status}</span></td>
              <td>{formatDuration(run.durationMs)}</td>
              <td>{run.blocks.filter((block) => block.status === "success" || block.status === "skipped").length}/{run.blockCount}</td>
              <td><button type="button" onClick={() => setOpenRunId(openRunId === run.id ? null : run.id)}>{openRunId === run.id ? "Hide" : "View"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {runs.map((run) => openRunId === run.id ? <RunDetails key={`${run.id}-details`} run={run} compact={compact} /> : null)}
    </div>
  );
}

function RunDetails({ run, compact }: { run: AutomationRun; compact: boolean }) {
  return (
    <section className="card soft-card">
      <div className="status-row">
        <div>
          <strong>{compact ? "Run details" : run.workflowName}</strong>
          <p className="muted">Started {formatLocalTime(run.startedAt)} · trigger {run.triggerType} · {formatDuration(run.durationMs)}</p>
        </div>
        <span className={`pill ${run.status === "success" ? "pill-good" : run.status === "failed" ? "pill-warn" : "pill-neutral"}`}>{run.status}</span>
      </div>
      {run.error && <p className="error-text">{run.error}</p>}
      <div className="grid-list">
        {run.blocks.map((block) => (
          <div key={block.id} className="card">
            <div className="status-row">
              <div><strong>{block.blockType === "stamp_integritas" ? "+ " : `${block.order}. `}{block.blockLabel}</strong><p className="muted">{blockTypeLabel(block.blockType)} · {formatDuration(block.durationMs)}</p></div>
              <span className={`pill ${block.status === "success" ? "pill-good" : block.status === "failed" ? "pill-warn" : "pill-neutral"}`}>{block.status}</span>
            </div>
            {block.error && <p className="error-text">{block.error}</p>}
            {block.output !== null && <JsonPreview value={block.output} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function blockTypeLabel(type: string) {
  if (type === "stamp_integritas") return "Attached side block";
  return type;
}

function formatDuration(ms: number | null) {
  if (ms === null) return "Running";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
