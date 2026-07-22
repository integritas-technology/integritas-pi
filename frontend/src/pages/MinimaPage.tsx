import { Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { MinimaConfig, MinimaNodeStatus, MinimaPeersResponse } from "../app/types";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { IconButton } from "../components/Button";
import { ErrorText } from "../components/Text";
import { useToast } from "../components/ToastProvider";
import {
  addMinimaPeers,
  getMinimaConfig,
  getMinimaNodeStatus,
  getMinimaPeers,
  resyncMegammr,
  restartMinimaContainer,
  saveMinimaConfig
} from "../features/minima/minimaApi";
import { MinimaContainerCard } from "../features/minima/MinimaContainerCard";
import { MinimaHealthCard } from "../features/minima/MinimaHealthCard";
import { mergeMinimaStatus } from "../features/minima/mergeMinimaStatus";
import { parseMegammrResyncResult, resyncToastForResult } from "../features/minima/minimaResync";
import { MinimaRuntimeConfig } from "../features/minima/MinimaRuntimeConfig";
import { MinimaSummaryGrid } from "../features/minima/MinimaSummaryGrid";
import { useMinimaStatusRefresh } from "../features/minima/useMinimaStatusRefresh";

export function MinimaPage() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<MinimaConfig | null>(null);
  const [megammrHostInput, setMegammrHostInput] = useState("megammr.minima.global:9001");
  const [peerslistInput, setPeerslistInput] = useState("megammr.minima.global:9001");
  const [configOpen, setConfigOpen] = useState(false);
  const [nodeStatus, setNodeStatus] = useState<MinimaNodeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [peers, setPeers] = useState<MinimaPeersResponse | null>(null);
  const [peersLoading, setPeersLoading] = useState(false);

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
    enabled: !resyncing && !restarting && !busy
  });

  async function refreshAfterOperation() {
    setStatusError(null);
    const delays = [0, 2000, 4000, 6000];

    for (const delayMs of delays) {
      if (delayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      try {
        const status = await getMinimaNodeStatus();
        handleStatus(status);
        if (status.rpc.ok) return;
      } catch {
        // Keep last known stats; polling will retry when enabled.
      }
    }
  }

  useEffect(() => {
    refreshConfig().catch((err: Error) => setConfigError(err.message));
  }, []);

  async function refreshConfig() {
    const parsed = await getMinimaConfig();
    setConfig(parsed);
    setMegammrHostInput(parsed.megammrHost);
  }

  async function refreshPeers() {
    setPeersLoading(true);
    try {
      setPeers(await getMinimaPeers());
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

  function openConfig() {
    setConfigOpen(true);
    refreshPeers().catch(() => undefined);
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

  async function restartContainer() {
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
      throw error;
    } finally {
      await refreshAfterOperation();
      setRestarting(false);
    }
  }

  async function runRestart() {
    if (!window.confirm("Restart the Minima Docker container? RPC will be briefly unavailable.")) return;

    setBusy(true);
    try {
      await restartContainer();
    } finally {
      setBusy(false);
    }
  }

  async function runAddPeers() {
    if (!peerslistInput.trim()) return;

    setBusy(true);
    setConfigError(null);
    try {
      await addMinimaPeers(peerslistInput);
      showToast({
        tone: "success",
        title: "Peers added",
        message: "Minima accepted the add-peers request.",
        timeoutMs: 8000
      });
      await Promise.all([refresh(), refreshPeers()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Add peers failed";
      setConfigError(message);
      showToast({ tone: "error", title: "Add peers failed", message, timeoutMs: 9000 });
    } finally {
      setBusy(false);
    }
  }

  async function runResync() {
    setBusy(true);
    setResyncing(true);
    setStatusError("Megammr resync in progress. Minima RPC may be briefly unavailable.");

    let restartedContainer = false;

    try {
      const parsed = await resyncMegammr();
      const meta = parseMegammrResyncResult(parsed);

      if (!meta.rpcOk) {
        showToast(resyncToastForResult(parsed));
        return;
      }

      if (meta.needsRestart) {
        setStatusError("Resync complete. Restarting Minima container…");
        setResyncing(false);
        await restartContainer();
        restartedContainer = true;
      }

      const toast = resyncToastForResult(parsed, { restartedContainer });
      showToast({ ...toast, timeoutMs: toast.tone === "info" ? 12000 : 8000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resync failed";
      showToast({ tone: "error", title: "Megammr resync failed", message, timeoutMs: 9000 });
    } finally {
      if (!restartedContainer) {
        await refreshAfterOperation();
      }
      setBusy(false);
      setResyncing(false);
      setRestarting(false);
    }
  }

  return (
    <Page
      eyebrow="Minima node"
      title="Run the Minima node"
      desc="Start, monitor, and manage the Minima Core node running on the Raspberry Pi Edition."
      action={
        <IconButton
          variant="primary"
          onClick={openConfig}
          aria-label="Configure Minima"
        >
          <Settings size={20} />
        </IconButton>
      }
    >
      {configOpen && (
        <Modal title="Configure Minima" onClose={() => setConfigOpen(false)}>
          <MinimaRuntimeConfig
            config={config}
            megammrHostInput={megammrHostInput}
            setMegammrHostInput={setMegammrHostInput}
            peers={peers}
            peersLoading={peersLoading}
            peerslistInput={peerslistInput}
            setPeerslistInput={setPeerslistInput}
            busy={busy}
            onSave={saveConfig}
            onAddPeers={runAddPeers}
          />
          {configError && <ErrorText>{configError}</ErrorText>}
        </Modal>
      )}

      {!configOpen && configError && <ErrorText>{configError}</ErrorText>}

      <MinimaSummaryGrid
        status={nodeStatus}
        loading={statusLoading && !nodeStatus}
        busy={busy}
        refreshing={resyncing || restarting}
        onResync={runResync}
      />
      <section className="grid items-stretch gap-4 lg:grid-cols-2">
        <MinimaHealthCard
          status={nodeStatus}
          error={statusError}
          loading={statusLoading && !nodeStatus}
          refreshing={resyncing || restarting}
        />
        <MinimaContainerCard
          status={nodeStatus}
          loading={statusLoading && !nodeStatus}
          busy={busy}
          refreshing={restarting}
          onRestart={runRestart}
        />
      </section>
    </Page>
  );
}
