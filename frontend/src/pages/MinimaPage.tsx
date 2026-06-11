import { useCallback, useEffect, useState } from "react";
import type { MinimaCommandResult, MinimaConfig, MinimaNodeStatus } from "../app/types";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import { MinimaActionCards } from "../features/minima/MinimaActionCards";
import { getMinimaConfig, resyncMegammr, saveMinimaConfig } from "../features/minima/minimaApi";
import { MinimaRuntimeConfig } from "../features/minima/MinimaRuntimeConfig";
import { MinimaStatusPanel } from "../features/minima/MinimaStatusPanel";
import { useMinimaStatusRefresh } from "../features/minima/useMinimaStatusRefresh";

export function MinimaPage() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<MinimaConfig | null>(null);
  const [megammrHostInput, setMegammrHostInput] = useState("megammr.minima.global:9001");
  const [configOpen, setConfigOpen] = useState(false);
  const [nodeStatus, setNodeStatus] = useState<MinimaNodeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<MinimaCommandResult | null>(null);
  const [busy, setBusy] = useState(false);

  const handleStatus = useCallback((status: MinimaNodeStatus) => {
    setNodeStatus(status);
    setStatusError(null);
    setStatusLoading(false);
  }, []);

  const handleStatusError = useCallback((message: string) => {
    setStatusError(message);
    setStatusLoading(false);
  }, []);

  useMinimaStatusRefresh(handleStatus, handleStatusError);

  useEffect(() => {
    refreshConfig().catch((err: Error) => setConfigError(err.message));
  }, []);

  async function refreshConfig() {
    const parsed = await getMinimaConfig();
    setConfig(parsed);
    setMegammrHostInput(parsed.megammrHost);
  }

  async function saveConfig() {
    setBusy(true);
    setConfigError(null);
    try {
      const parsed = await saveMinimaConfig(megammrHostInput);
      setConfig(parsed);
      setMegammrHostInput(parsed.megammrHost);
      setConfigOpen(false);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function runResync() {
    setBusy(true);
    setActionResult(null);
    try {
      const parsed = await resyncMegammr();
      setActionResult(parsed);
      showToast({ tone: "success", title: "Megammr resync started", message: "Check node health for sync progress.", timeoutMs: 6000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resync failed";
      showToast({ tone: "error", title: "Megammr resync failed", message, timeoutMs: 9000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      eyebrow="Minima Core"
      title="Run the Minima node"
      desc="Monitor node health, chain sync, and container resources through the backend."
      action={
        <button type="button" className="section-action-button" onClick={() => setConfigOpen(true)}>
          Configure Minima
        </button>
      }
    >
      {configOpen && (
        <Modal title="Configure Minima" onClose={() => setConfigOpen(false)}>
          <MinimaRuntimeConfig
            config={config}
            megammrHostInput={megammrHostInput}
            setMegammrHostInput={setMegammrHostInput}
            busy={busy}
            onSave={saveConfig}
          />
          {configError && <p className="error-text">{configError}</p>}
        </Modal>
      )}

      {!configOpen && configError && <p className="error-text">{configError}</p>}
      <MinimaActionCards config={config} result={actionResult} busy={busy} onResync={runResync} />
      <MinimaStatusPanel status={nodeStatus} error={statusError} loading={statusLoading} />
    </Page>
  );
}
