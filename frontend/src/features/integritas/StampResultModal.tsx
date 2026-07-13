import { useEffect, useState } from "react";
import { JsonPreview } from "../../components/JsonPreview";
import { Modal } from "../../components/Modal";
import { StatusBadge } from "../../components/StatusBadge";
import { MutedText } from "../../components/Text";
import { useToast } from "../../components/ToastProvider";
import { getHistoryRecord } from "./integritasApi";
import { integritasErrorToast } from "./integritasErrors";
import type { IntegritasProofRecord } from "./integritasTypes";

const REFRESH_INTERVAL_MS = 15_000;
const REFRESH_TIMEOUT_MS = 5 * 60_000;

function statusBadge(record: IntegritasProofRecord) {
  if (record.proof_status === "ready") {
    return <StatusBadge ok>Confirmed on-chain</StatusBadge>;
  }
  if (record.proof_status === "failed") {
    return <StatusBadge ok={false}>Proof failed</StatusBadge>;
  }
  return <StatusBadge ok={false}>Waiting for on-chain confirmation</StatusBadge>;
}

function statusMessage(record: IntegritasProofRecord) {
  if (record.proof_status === "ready") {
    return "Your hash is confirmed on-chain. Export or verify the proof from Diagnostics when needed.";
  }
  if (record.proof_status === "failed") {
    return record.proof_error ?? "Integritas could not complete this proof. Check Diagnostics for details or try stamping again.";
  }
  return "Proof requested. Status updates automatically here and on Diagnostics (usually within a few minutes).";
}

export function StampResultModal({
  record: initialRecord,
  technicalDetails,
  onClose
}: {
  record: IntegritasProofRecord;
  technicalDetails?: unknown;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [record, setRecord] = useState(initialRecord);
  const [polling, setPolling] = useState(initialRecord.proof_status === "pending");

  useEffect(() => {
    setRecord(initialRecord);
    setPolling(initialRecord.proof_status === "pending");
  }, [initialRecord]);

  useEffect(() => {
    if (record.proof_status !== "pending") {
      setPolling(false);
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    async function refreshFromHistory() {
      try {
        const response = await getHistoryRecord(record.id);
        if (cancelled) return;
        setRecord(response.record);
        if (response.record.proof_status !== "pending") {
          setPolling(false);
        }
      } catch (error) {
        const err = error as { errorCode?: string };
        if (err.errorCode === "unauthorized") {
          setPolling(false);
          const { title, message } = integritasErrorToast(error);
          showToast({ tone: "error", title, message, timeoutMs: 9000 });
        }
      }
    }

    void refreshFromHistory();
    const interval = window.setInterval(() => {
      if (Date.now() - startedAt >= REFRESH_TIMEOUT_MS) {
        setPolling(false);
        window.clearInterval(interval);
        return;
      }
      void refreshFromHistory();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [record.id, record.proof_status, showToast]);

  return (
    <Modal title="Timestamp proof submitted" onClose={onClose}>
      <div className="grid gap-4">
        {statusBadge(record)}
        <p className="m-0 leading-relaxed text-slate-700">{statusMessage(record)}</p>
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          {record.file_name && (
            <>
              <dt className="m-0 font-semibold text-slate-500">File</dt>
              <dd className="m-0 break-all">{record.file_name}</dd>
            </>
          )}
          <dt className="m-0 font-semibold text-slate-500">Proof UID</dt>
          <dd className="m-0 break-all"><code>{record.proof_uid ?? "—"}</code></dd>
          <dt className="m-0 font-semibold text-slate-500">Data hash</dt>
          <dd className="m-0 break-all"><code>{record.hash}</code></dd>
        </dl>
        {polling && <MutedText>Checking on-chain status…</MutedText>}
        {technicalDetails !== undefined && (
          <JsonPreview value={technicalDetails} label="View technical details" />
        )}
      </div>
    </Modal>
  );
}
