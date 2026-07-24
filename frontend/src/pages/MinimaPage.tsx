import { useCallback, useState } from "react";
import { Settings } from "lucide-react";
import type { MinimaNodeStatus } from "../app/types";
import { Card } from "../components/Card";
import { IconButton } from "../components/Button";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import {
  getMinimaNodeStatus,
  resyncMegammr,
  restartMinimaContainer
} from "../features/minima/minimaApi";
import { MinimaConsolePanel } from "../features/minima/MinimaConsolePanel";
import { MinimaConsoleWhitelistModal } from "../features/minima/MinimaConsoleWhitelistModal";
import { MinimaContainerCard } from "../features/minima/MinimaContainerCard";
import { MinimaHealthCard } from "../features/minima/MinimaHealthCard";
import { mergeMinimaStatus } from "../features/minima/mergeMinimaStatus";
import { parseMegammrResyncResult, resyncToastForResult } from "../features/minima/minimaResync";
import { MinimaSummaryGrid } from "../features/minima/MinimaSummaryGrid";
import { useMinimaStatusRefresh } from "../features/minima/useMinimaStatusRefresh";

// A real container restart (JVM stop/start, chain reload) can easily take longer than a
// few seconds — this needs to stay in the same ballpark as the backend's own operation
// window (minima-monitoring.ts, ~120s) so the toast doesn't give up on a restart the
// backend still considers normal and in-progress.
const REFRESH_AFTER_OPERATION_INTERVAL_MS = 3000;
const REFRESH_AFTER_OPERATION_MAX_MS = 90000;

export function MinimaPage() {
  const { showToast } = useToast();
  const [nodeStatus, setNodeStatus] = useState<MinimaNodeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [consoleWhitelistOpen, setConsoleWhitelistOpen] = useState(false);

  const handleStatus = useCallback((status: MinimaNodeStatus) => {
    setNodeStatus((previous) => mergeMinimaStatus(previous, status));
    setStatusError(null);
    setStatusLoading(false);
  }, []);

  const handleStatusError = useCallback((message: string) => {
    setStatusError(message);
    setStatusLoading(false);
  }, []);

  useMinimaStatusRefresh(handleStatus, handleStatusError, {
    enabled: !resyncing && !restarting && !busy
  });

  async function refreshAfterOperation(): Promise<boolean> {
    setStatusError(null);
    const deadline = Date.now() + REFRESH_AFTER_OPERATION_MAX_MS;

    while (true) {
      try {
        const status = await getMinimaNodeStatus();
        handleStatus(status);
        if (status.rpc.ok) return true;
      } catch {
        // Keep last known stats; polling will retry when enabled.
      }
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => window.setTimeout(resolve, REFRESH_AFTER_OPERATION_INTERVAL_MS));
    }
  }

  async function restartContainer(options?: { silent?: boolean }) {
    setRestarting(true);
    setStatusError("Minima container restart in progress. RPC may be briefly unavailable.");

    let commandSucceeded = false;

    try {
      const result = await restartMinimaContainer();
      commandSucceeded = true;
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
      const recovered = await refreshAfterOperation();
      setRestarting(false);

      if (commandSucceeded && !options?.silent) {
        showToast(
          recovered
            ? { tone: "success", title: "Restart complete", message: "Minima container is back online.", timeoutMs: 8000 }
            : {
                tone: "error",
                title: "Restart taking longer than expected",
                message: "Minima RPC hasn't responded yet — check Node health.",
                timeoutMs: 9000
              }
        );
      }
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
        await restartContainer({ silent: true });
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

  // Only let Resync/Restart be pressed once we have a confirmed status and it isn't
  // already mid-operation — before the first successful load, we don't know enough
  // to say either action would do anything useful.
  const actionsBlocked = busy || !nodeStatus || nodeStatus.state === "restarting";

  // Prefer the specific local message for whoever triggered the operation; fall back to
  // a generic one driven by backend truth so the banner survives navigating away and back
  // mid-operation (a fresh mount has no local statusError, but the node status still does).
  const operationBanner = statusError ?? (nodeStatus?.state === "restarting" ? "Minima is restarting. RPC may be briefly unavailable." : null);

  return (
    <Page
      eyebrow="Minima node"
      title="Run the Minima node"
      desc="Start, monitor, and manage the Minima Core node running on the Raspberry Pi Edition."
    >
      {operationBanner && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {operationBanner}
        </div>
      )}

      <MinimaSummaryGrid
        status={nodeStatus}
        loading={statusLoading && !nodeStatus}
        busy={actionsBlocked}
        refreshing={resyncing || restarting || nodeStatus?.state === "restarting"}
        onResync={runResync}
      />
      <section className="grid items-stretch gap-4 lg:grid-cols-2">
        <MinimaHealthCard
          status={nodeStatus}
          loading={statusLoading && !nodeStatus}
          refreshing={resyncing || restarting || nodeStatus?.state === "restarting"}
        />
        <MinimaContainerCard
          status={nodeStatus}
          loading={statusLoading && !nodeStatus}
          busy={actionsBlocked}
          refreshing={restarting || nodeStatus?.state === "restarting"}
          onRestart={runRestart}
        />
      </section>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="m-0">RPC console</h3>
            <p className="mt-1 text-sm text-slate-500">Run whitelisted Minima RPC commands and see the raw response.</p>
          </div>
          <IconButton
            aria-label="Edit console command whitelist"
            variant="secondary"
            onClick={() => setConsoleWhitelistOpen(true)}
          >
            <Settings size={16} />
          </IconButton>
        </div>
        <MinimaConsolePanel disabled={actionsBlocked} />
      </Card>

      {consoleWhitelistOpen && <MinimaConsoleWhitelistModal onClose={() => setConsoleWhitelistOpen(false)} />}
    </Page>
  );
}
