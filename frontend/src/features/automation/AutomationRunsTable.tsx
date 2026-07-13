import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { DataTable, RowActions, TableWrap, tableCellClass, tableHeaderCellClass, tableHeadRowClass, tableRowClass } from "../../components/DataTable";
import { JsonPreview } from "../../components/JsonPreview";
import { getDataSourceRead } from "../data-reads/dataReadsApi";
import type { DataSourceRead } from "../data-reads/dataReadTypes";
import { cx } from "../../lib/cx";
import { formatLocalTime } from "../../lib/time";
import type { AutomationRun } from "./automationTypes";

const mutedText = "text-sm text-slate-500";
const cardClass = "rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm";
const softCardClass = "rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm";
const statusRowClass = "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";
const gridListClass = "grid gap-4 md:grid-cols-2";

export function AutomationRunsTable({ runs, compact = false }: { runs: AutomationRun[]; compact?: boolean }) {
  const [rawRunId, setRawRunId] = useState<string | null>(null);

  if (runs.length === 0) return <p className={mutedText}>No workflow runs recorded yet.</p>;

  return (
    <TableWrap>
      <DataTable>
        <thead>
          <tr className={tableHeadRowClass}>
            <th className={tableHeaderCellClass}>Started</th>
            {!compact && <th className={tableHeaderCellClass}>Workflow</th>}
            <th className={tableHeaderCellClass}>Trigger</th>
            <th className={tableHeaderCellClass}>Status</th>
            <th className={tableHeaderCellClass}>Duration</th>
            <th className={tableHeaderCellClass}>Blocks</th>
            <th className={tableHeaderCellClass}>Details</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className={tableRowClass}>
              <td className={tableCellClass}>{formatLocalTime(run.startedAt)}</td>
              {!compact && <td className={tableCellClass}>{run.workflowName}</td>}
              <td className={tableCellClass}>{run.triggerType}</td>
              <td className={tableCellClass}><StatusPill status={run.status} /></td>
              <td className={tableCellClass}>{formatDuration(run.durationMs)}</td>
              <td className={tableCellClass}>{run.blocks.filter((block) => block.status === "success").length}/{run.blockCount}</td>
              <td className={tableCellClass}><RowActions><Link className="font-bold text-blue-700 hover:text-blue-900" to={`/automation?flow=watch&id=${encodeURIComponent(run.workflowId)}&run=${encodeURIComponent(run.id)}`}>Show on canvas</Link><Button type="button" variant="secondary" className="rounded-full px-3 py-1.5" onClick={() => setRawRunId(rawRunId === run.id ? null : run.id)}>{rawRunId === run.id ? "Hide raw" : "Raw details"}</Button></RowActions></td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {runs.map((run) => rawRunId === run.id ? <RawRunDetails key={`${run.id}-raw`} run={run} /> : null)}
    </TableWrap>
  );
}

function RawRunDetails({ run }: { run: AutomationRun }) {
  return (
    <section className={softCardClass}>
      <div className={statusRowClass}>
        <div><strong>Raw workflow run JSON</strong><p className={mutedText}>Full stored run payload for diagnostics.</p></div>
        <StatusPill status={run.status} />
      </div>
      <JsonPreview value={run} />
    </section>
  );
}

function RunDetails({ run, compact }: { run: AutomationRun; compact: boolean }) {
  return (
    <section className={softCardClass}>
      <div className={statusRowClass}>
        <div>
          <strong>{compact ? "Run details" : run.workflowName}</strong>
          <p className={mutedText}>Started {formatLocalTime(run.startedAt)} · trigger {run.triggerType} · {formatDuration(run.durationMs)}</p>
        </div>
        <StatusPill status={run.status} />
      </div>
      {run.error && <p className="text-sm font-semibold text-red-700">{run.error}</p>}
      <div className={gridListClass}>
        <div className={cardClass}>
          <strong>Trigger payload started the run</strong>
          <p className={mutedText}>This is why the workflow ran. For Run now tests, this is the synthetic manual test payload.</p>
          {run.triggerPayload !== null && run.triggerPayload !== undefined ? <JsonPreview value={run.triggerPayload} /> : <p className={mutedText}>No trigger payload recorded.</p>}
        </div>
      </div>
      <div className={gridListClass}>
        {run.blocks.map((block) => <BlockRunDetails key={block.id} block={block} />)}
      </div>
    </section>
  );
}

function BlockRunDetails({ block }: { block: AutomationRun["blocks"][number] }) {
  const readId = readIdFromOutput(block.output);
  const proofId = proofIdFromOutput(block.output);

  return (
    <div className={cardClass}>
      <div className={statusRowClass}>
        <div><strong>{block.blockType === "stamp_integritas" ? "+ " : `${block.order}. `}{block.blockLabel}</strong><p className={mutedText}>{blockTypeLabel(block.blockType)} · {formatDuration(block.durationMs)}</p></div>
        <StatusPill status={block.status} />
      </div>
      {block.error && <p className="text-sm font-semibold text-red-700">{block.error}</p>}
      {block.output !== null && <JsonPreview value={block.output} />}
      {proofId && <p className={mutedText}><Link className="font-bold text-blue-700 hover:text-blue-900" to={diagnosticsLink("proofs", proofId)}>Open proof in Diagnostics</Link></p>}
      {readId && <ReadPreview readId={readId} blockType={block.blockType} />}
    </div>
  );
}

function ReadPreview({ readId, blockType }: { readId: string; blockType: string }) {
  const [read, setRead] = useState<DataSourceRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRead(null);
    setError(null);

    getDataSourceRead(readId)
      .then((response) => {
        if (!cancelled) setRead(response.item);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load data read.");
      });

    return () => {
      cancelled = true;
    };
  }, [readId]);

  return (
    <div className={softCardClass}>
      <div className={statusRowClass}>
        <div>
          <strong>Fetched data preview</strong>
          <p className={mutedText}>This is the stored JSON {blockType === "record_trigger_event" ? "recorded from the trigger" : "fetched from the device/source"}. Data conditions evaluate this preview when their source is Data.</p>
          <p className={mutedText}>Read <code>{readId}</code>{read ? ` · ${read.sourceName}` : ""}</p>
          <p className={mutedText}><Link className="font-bold text-blue-700 hover:text-blue-900" to={diagnosticsLink("reads", readId)}>Open read in Diagnostics</Link></p>
        </div>
        {read && <StatusPill status={read.status} />}
      </div>
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : read ? read.preview ? <JsonPreview value={read.preview} /> : <p className={mutedText}>No stored preview for this read.</p> : <p className={mutedText}>Loading data read...</p>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cx("inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide", status === "success" ? "bg-emerald-100 text-emerald-700" : status === "failed" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

function diagnosticsLink(tab: "proofs" | "reads", id: string) {
  const params = new URLSearchParams({ tab, page: "1", pageSize: "25", q: id });
  return `/diagnostics?${params.toString()}`;
}

function readIdFromOutput(output: unknown) {
  if (!output || typeof output !== "object") return null;
  const record = output as { readId?: unknown; data?: { readId?: unknown } };
  if (typeof record.readId === "string") return record.readId;
  if (record.data && typeof record.data.readId === "string") return record.data.readId;
  return null;
}

function proofIdFromOutput(output: unknown) {
  if (!output || typeof output !== "object") return null;
  const record = output as { proofId?: unknown };
  return typeof record.proofId === "string" ? record.proofId : null;
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
