import { useEffect, useState } from "react";
import type { IntegritasConfig } from "../app/types";
import { JsonPreview } from "../components/JsonPreview";
import { Page } from "../components/Page";
import { postJson } from "../lib/api";
import { stampFile, verifyProofFile } from "../features/integritas/integritasApi";
import { IntegritasRuntimeConfig } from "../features/integritas/IntegritasRuntimeConfig";
import { StampFilePanel } from "../features/integritas/StampFilePanel";
import { VerifyProofPanel } from "../features/integritas/VerifyProofPanel";

export function IntegritasPage() {
  const [config, setConfig] = useState<IntegritasConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [stampUpload, setStampUpload] = useState<File | null>(null);
  const [verifyUpload, setVerifyUpload] = useState<File | null>(null);
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
    <Page eyebrow="Integritas" title="Prove local data" desc="Generate timestamp proofs from local files, poll proof status, export proof payloads, and verify JSON proof files.">
      <IntegritasRuntimeConfig
        config={config}
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        busy={busy}
        onSave={() => run(async () => { const response = await postJson("/api/integritas/api-key", { apiKey: apiKeyInput }); setApiKeyInput(""); await refreshConfig(); return response; })}
        onClear={() => run(async () => { const response = await fetch("/api/integritas/api-key", { method: "DELETE" }); const parsed = await response.json(); if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`); await refreshConfig(); return parsed; })}
      />

      <div className="integritas-upload-grid">
        <StampFilePanel file={stampUpload} setFile={setStampUpload} busy={busy} onStamp={() => run(async () => { if (!stampUpload) throw new Error("Select a file first"); const response = await stampFile(stampUpload); setStampUpload(null); return response; })} />
        <VerifyProofPanel file={verifyUpload} setFile={setVerifyUpload} busy={busy} onVerifyFile={() => run(async () => { if (!verifyUpload) throw new Error("Select a proof JSON file first"); const response = await verifyProofFile(verifyUpload); setVerifyUpload(null); return response; })} />
      </div>

      {error && <p className="error-text">{error}</p>}
      {result !== null && <JsonPreview value={result} />}
    </Page>
  );
}
