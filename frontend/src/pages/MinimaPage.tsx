import { useEffect, useState } from "react";
import type { MinimaCommandResult, MinimaConfig, MinimaStatus } from "../app/types";
import { Card } from "../components/Card";
import { JsonPreview } from "../components/JsonPreview";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { StatusBadge } from "../components/StatusBadge";
import { MinimaActionCards } from "../features/minima/MinimaActionCards";
import { MinimaRuntimeConfig } from "../features/minima/MinimaRuntimeConfig";

export function MinimaPage() {
  const [config, setConfig] = useState<MinimaConfig | null>(null);
  const [megammrHostInput, setMegammrHostInput] = useState("megammr.minima.global:9001");
  const [configOpen, setConfigOpen] = useState(false);
  const [minimaStatus, setMinimaStatus] = useState<MinimaStatus | null>(null);
  const [minimaError, setMinimaError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<MinimaCommandResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshConfig().catch((err: Error) => setConfigError(err.message));
    fetch("/api/minima/status")
      .then((response) => response.json() as Promise<MinimaStatus>)
      .then(setMinimaStatus)
      .catch((err: Error) => setMinimaError(err.message));
  }, []);

  async function refreshConfig() {
    const response = await fetch("/api/minima/config");
    const parsed = await response.json() as MinimaConfig;
    if (!response.ok) throw new Error((parsed as { error?: string })?.error || `HTTP ${response.status}`);
    setConfig(parsed);
    setMegammrHostInput(parsed.megammrHost);
  }

  async function saveConfig() {
    setBusy(true);
    setConfigError(null);
    try {
      const response = await fetch("/api/minima/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ megammrHost: megammrHostInput }) });
      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
      setConfig(parsed as MinimaConfig);
      setMegammrHostInput((parsed as MinimaConfig).megammrHost);
      setConfigOpen(false);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function resyncMegammr() {
    setBusy(true);
    setActionError(null);
    setActionResult(null);
    try {
      const response = await fetch("/api/minima/megammrsync/resync", { method: "POST" });
      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
      setActionResult(parsed as MinimaCommandResult);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page eyebrow="Minima Core" title="Run the Minima node" desc="Read Minima node status through the backend and Docker network." action={<button type="button" className="section-action-button" onClick={() => setConfigOpen(true)}>Configure Minima</button>}>
      {configOpen && (
        <Modal title="Configure Minima" onClose={() => setConfigOpen(false)}>
          <MinimaRuntimeConfig config={config} megammrHostInput={megammrHostInput} setMegammrHostInput={setMegammrHostInput} busy={busy} onSave={saveConfig} />
          {configError && <p className="error-text">{configError}</p>}
        </Modal>
      )}

      {!configOpen && configError && <p className="error-text">{configError}</p>}
      <MinimaActionCards config={config} result={actionResult} busy={busy} error={actionError} onResync={resyncMegammr} />
      <Card>
        <div className="status-row"><strong>Minima status</strong><StatusBadge ok={Boolean(minimaStatus?.ok)}>{minimaStatus ? `HTTP ${minimaStatus.status}` : minimaError ? "error" : "checking"}</StatusBadge></div>
        {minimaStatus?.source && <code>{minimaStatus.source}</code>}
        {minimaStatus?.error && <p className="error-text">{minimaStatus.error}</p>}
        {minimaStatus?.body !== undefined && <JsonPreview value={minimaStatus.body} />}
      </Card>
    </Page>
  );
}
