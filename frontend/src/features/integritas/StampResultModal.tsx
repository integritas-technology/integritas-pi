import { useEffect, useState } from "react";
import { JsonPreview } from "../../components/JsonPreview";
import { Modal } from "../../components/Modal";
import { StatusBadge } from "../../components/StatusBadge";
import { pollRecord } from "./integritasApi";
import type { IntegritasProofRecord } from "./integritasTypes";

const POLL_INTERVAL_MS = 30_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

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
  return "Proof requested. On-chain confirmation usually completes within a few minutes. You can close this dialog and check Diagnostics later.";
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

    async function refresh() {
      try {
        const response = await pollRecord(record.id);
        if (cancelled) return;
        setRecord(response.record);
        if (response.record.proof_status !== "pending") {
          setPolling(false);
        }
      } catch {
        // Background refresh only; operator can use Diagnostics if needed.
      }
    }

    const initialPoll = window.setTimeout(() => {
      void refresh();
    }, 5000);

    const interval = window.setInterval(() => {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setPolling(false);
        window.clearInterval(interval);
        return;
      }
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(initialPoll);
      window.clearInterval(interval);
    };
  }, [record.id, record.proof_status]);

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
