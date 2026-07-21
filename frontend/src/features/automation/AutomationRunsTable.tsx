import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { DataTable, RowActions, TableWrap, tableCellClass, tableHeaderCellClass, tableHeadRowClass, tableRowClass } from "../../components/DataTable";
import { JsonPreview } from "../../components/JsonPreview";
import { cx } from "../../lib/cx";
import { formatLocalTime } from "../../lib/time";
import type { AutomationRun } from "./automationTypes";

const mutedText = "text-sm text-slate-500";
const softCardClass = "rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm";
const statusRowClass = "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";

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
            <Fragment key={run.id}>
              <tr className={tableRowClass}>
                <td className={tableCellClass}>{formatLocalTime(run.startedAt)}</td>
                {!compact && <td className={tableCellClass}>{run.workflowName}</td>}
                <td className={tableCellClass}>{run.triggerType}</td>
                <td className={tableCellClass}><StatusPill status={run.status} /></td>
                <td className={tableCellClass}>{formatDuration(run.durationMs)}</td>
                <td className={tableCellClass}>{run.blocks.filter((block) => block.status === "success").length}/{run.blockCount}</td>
                <td className={tableCellClass}><RowActions>{run.workflowId ? <Link className="font-bold text-blue-700 hover:text-blue-900" to={`/automation?flow=watch&id=${encodeURIComponent(run.workflowId)}&run=${encodeURIComponent(run.id)}`}>Show on canvas</Link> : <span className={mutedText}>Workflow deleted</span>}<Button type="button" variant="secondary" className="rounded-full px-3 py-1.5" onClick={() => setRawRunId(rawRunId === run.id ? null : run.id)}>{rawRunId === run.id ? "Hide raw" : "Raw details"}</Button></RowActions></td>
              </tr>
              {rawRunId === run.id && (
                <tr className={tableRowClass}>
                  <td className={tableCellClass} colSpan={compact ? 6 : 7}>
                    <RawRunDetails run={run} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </DataTable>
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

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cx("inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide", status === "success" ? "bg-emerald-100 text-emerald-700" : status === "failed" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

function formatDuration(ms: number | null) {
  if (ms === null) return "Running";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
