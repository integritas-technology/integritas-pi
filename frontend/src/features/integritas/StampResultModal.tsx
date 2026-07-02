import { useEffect, useState } from "react";
import { JsonPreview } from "../../components/JsonPreview";
import { Modal } from "../../components/Modal";
import { StatusBadge } from "../../components/StatusBadge";
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
      <div className="stamp-result-modal">
        {statusBadge(record)}
        <p className="stamp-result-message">{statusMessage(record)}</p>
        <dl className="stamp-result-meta">
          {record.file_name && (
            <>
              <dt>File</dt>
              <dd>{record.file_name}</dd>
            </>
          )}
          <dt>Proof UID</dt>
          <dd><code>{record.proof_uid ?? "—"}</code></dd>
          <dt>Data hash</dt>
          <dd><code>{record.hash}</code></dd>
        </dl>
        {polling && <p className="muted">Checking on-chain status…</p>}
        {technicalDetails !== undefined && (
          <JsonPreview value={technicalDetails} label="View technical details" />
        )}
      </div>
    </Modal>
  );
}
