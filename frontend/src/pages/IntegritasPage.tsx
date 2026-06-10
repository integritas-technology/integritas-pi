import { useEffect, useState } from "react";
import type { IntegritasConfig } from "../app/types";
import { JsonPreview } from "../components/JsonPreview";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { getJson, postJson } from "../lib/api";
import { stampFile, verifyProofFile } from "../features/integritas/integritasApi";
import { IntegritasRuntimeConfig } from "../features/integritas/IntegritasRuntimeConfig";
import { StampFilePanel } from "../features/integritas/StampFilePanel";
import { StampResultModal } from "../features/integritas/StampResultModal";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";
import { VerifyProofPanel } from "../features/integritas/VerifyProofPanel";

export function IntegritasPage() {
  const [config, setConfig] = useState<IntegritasConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [stampUpload, setStampUpload] = useState<File | null>(null);
  const [verifyUpload, setVerifyUpload] = useState<File | null>(null);
  const [stampModalRecord, setStampModalRecord] = useState<IntegritasProofRecord | null>(null);
  const [stampModalDetails, setStampModalDetails] = useState<unknown>(null);
  const [verifyResult, setVerifyResult] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    refreshConfig().catch((err: Error) => setError(err.message));
  }, []);

  async function refreshConfig() {
    setConfig(await getJson<IntegritasConfig>("/api/integritas/config"));
  }

  async function run(action: () => Promise<unknown>, showResult = true) {
    setBusy(true);
    setError(null);
    try {
      const response = await action();
      if (showResult) setResult(response);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page eyebrow="Integritas" title="Prove local data" desc="Generate timestamp proofs from local files, poll proof status, export proof payloads, and verify JSON proof files." action={<button type="button" className="section-action-button" onClick={() => setConfigOpen(true)}>Configure Integritas</button>}>
      {configOpen && (
        <Modal title="Runtime configuration" onClose={() => setConfigOpen(false)}>
          <IntegritasRuntimeConfig
            config={config}
            apiKeyInput={apiKeyInput}
            setApiKeyInput={setApiKeyInput}
            busy={busy}
            onSave={() => run(async () => { const response = await postJson("/api/integritas/api-key", { apiKey: apiKeyInput }); setApiKeyInput(""); await refreshConfig(); return response; }, false)}
            onClear={() => run(async () => { const response = await fetch("/api/integritas/api-key", { method: "DELETE" }); const parsed = await response.json(); if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`); await refreshConfig(); return parsed; }, false)}
          />
        </Modal>
      )}

      {stampModalRecord && (
        <StampResultModal
          record={stampModalRecord}
          technicalDetails={stampModalDetails ?? undefined}
          onClose={() => {
            setStampModalRecord(null);
            setStampModalDetails(null);
          }}
        />
      )}

      <div className="integritas-upload-grid">
        <StampFilePanel
          file={stampUpload}
          setFile={setStampUpload}
          busy={busy}
          onStamp={() => run(async () => {
            if (!stampUpload) throw new Error("Select a file first");
            const response = await stampFile(stampUpload);
            setStampUpload(null);
            setStampModalRecord(response.record);
            setStampModalDetails(response);
            return response;
          }, false)}
        />
        <VerifyProofPanel file={verifyUpload} setFile={(file) => { setVerifyUpload(file); setVerifyResult(null); }} busy={busy} result={verifyResult} onVerifyFile={() => run(async () => { if (!verifyUpload) throw new Error("Select a proof JSON file first"); const response = await verifyProofFile(verifyUpload); setVerifyUpload(null); setVerifyResult(response); setResult(null); return response; }, false)} />
      </div>

      {error && <p className="error-text">{error}</p>}
      {result !== null && <JsonPreview value={result} />}
    </Page>
  );
}
