import { useCallback, useEffect, useState } from "react";
import type { MinimaCommandResult, MinimaConfig, MinimaNodeStatus, MinimaPeersResponse } from "../app/types";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import {
  addMinimaPeers,
  getMinimaConfig,
  getMinimaPeers,
  resyncMegammr,
  restartMinimaContainer,
  saveMinimaConfig
} from "../features/minima/minimaApi";
import { MinimaContainerCard } from "../features/minima/MinimaContainerCard";
import { MinimaHealthCard } from "../features/minima/MinimaHealthCard";
import { MinimaPeersCard } from "../features/minima/MinimaPeersCard";
import { mergeMinimaStatus } from "../features/minima/mergeMinimaStatus";
import { resyncToastForResult } from "../features/minima/minimaResync";
import { MinimaRuntimeConfig } from "../features/minima/MinimaRuntimeConfig";
import { MinimaSummaryGrid } from "../features/minima/MinimaSummaryGrid";
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
  const [resyncing, setResyncing] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [peers, setPeers] = useState<MinimaPeersResponse | null>(null);
  const [peersLoading, setPeersLoading] = useState(true);

  const handleStatus = useCallback((status: MinimaNodeStatus) => {
    setNodeStatus((previous) => mergeMinimaStatus(previous, status));
    setStatusError(null);
    setStatusLoading(false);
  }, []);

  const handleStatusError = useCallback((message: string) => {
    setStatusError(message);
    setStatusLoading(false);
  }, []);

  const { refresh } = useMinimaStatusRefresh(handleStatus, handleStatusError, {
    enabled: !resyncing && !restarting
  });

  async function refreshPeers() {
    setPeersLoading(true);
    try {
      const parsed = await getMinimaPeers();
      setPeers(parsed);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Failed to load peers",
        message: error instanceof Error ? error.message : "Unknown error",
        timeoutMs: 8000
      });
    } finally {
      setPeersLoading(false);
    }
  }

  useEffect(() => {
    refreshConfig().catch((err: Error) => setConfigError(err.message));
    refreshPeers().catch(() => undefined);
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

  async function runRestart() {
    if (!window.confirm("Restart the Minima Docker container? RPC will be briefly unavailable.")) return;

    setBusy(true);
    setRestarting(true);
    setStatusError("Minima container restart in progress. RPC may be briefly unavailable.");

    try {
      const result = await restartMinimaContainer();
      showToast({
        tone: "info",
        title: "Minima container restarting",
        message: `Docker service ${result.service} (${result.containerId}) is restarting.`,
        timeoutMs: 10000
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restart failed";
      showToast({ tone: "error", title: "Minima restart failed", message, timeoutMs: 9000 });
    } finally {
      setBusy(false);
      setRestarting(false);
      await Promise.all([refresh(), refreshPeers()]);
    }
  }

  async function runAddPeers(peerslist: string) {
    setBusy(true);
    try {
      await addMinimaPeers(peerslist);
      showToast({
        tone: "success",
        title: "Peers added",
        message: "Minima accepted the add-peers request.",
        timeoutMs: 8000
      });
      await Promise.all([refreshPeers(), refresh()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Add peers failed";
      showToast({ tone: "error", title: "Add peers failed", message, timeoutMs: 9000 });
    } finally {
      setBusy(false);
    }
  }

  async function runResync() {
    setBusy(true);
    setResyncing(true);
    setActionResult(null);
    setStatusError("Megammr resync in progress. Minima RPC may be briefly unavailable.");

    try {
      const parsed = await resyncMegammr();
      setActionResult(parsed);
      const toast = resyncToastForResult(parsed);
      showToast({ ...toast, timeoutMs: toast.tone === "info" ? 12000 : 8000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resync failed";
      showToast({ tone: "error", title: "Megammr resync failed", message, timeoutMs: 9000 });
    } finally {
      setBusy(false);
      setResyncing(false);
      await refresh();
    }
  }

  return (
    <Page
      eyebrow="Minima node"
      title="Run the Minima node"
      desc="Start, monitor, and manage the Minima Core node running on the Raspberry Pi Edition."
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

      <MinimaSummaryGrid
        status={nodeStatus}
        config={config}
        loading={statusLoading && !nodeStatus}
        busy={busy}
        result={actionResult}
        onResync={runResync}
      />
      <section className="grid gap-4 lg:grid-cols-2">
        <MinimaHealthCard status={nodeStatus} error={statusError} loading={statusLoading && !nodeStatus} />
        <MinimaContainerCard
          status={nodeStatus}
          loading={statusLoading && !nodeStatus}
          busy={busy}
          onRestart={runRestart}
        />
      </section>
      <MinimaPeersCard peers={peers} loading={peersLoading} busy={busy} onAddPeer={runAddPeers} />
    </Page>
  );
}
