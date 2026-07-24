import { useEffect, useState } from "react";
import type { MinimaConfig, MinimaNodeState, MinimaPeersResponse } from "../../app/types";
import { Card } from "../../components/Card";
import { ErrorText } from "../../components/Text";
import { useToast } from "../../components/ToastProvider";
import { addMinimaPeers, getMinimaConfig, getMinimaPeers, saveMinimaConfig } from "./minimaApi";
import { MinimaRuntimeConfig } from "./MinimaRuntimeConfig";
import { useMinimaStatusRefresh } from "./useMinimaStatusRefresh";

export function MinimaSettingsPanel() {
  const { showToast } = useToast();
  const [minimaState, setMinimaState] = useState<MinimaNodeState | null>(null);
  useMinimaStatusRefresh(
    (status) => setMinimaState(status.state),
    () => {}
  );
  // Same "confirmed running" gate used on the Wallet settings panel and the Minima
  // Core page's own Resync/Restart buttons — config/peer RPC calls would just fail
  // while the node isn't up.
  const actionsBlocked = minimaState !== "running";

  const [config, setConfig] = useState<MinimaConfig | null>(null);
  const [megammrHostInput, setMegammrHostInput] = useState("megammr.minima.global:9001");
  const [peerslistInput, setPeerslistInput] = useState("megammr.minima.global:9001");
  const [peers, setPeers] = useState<MinimaPeersResponse | null>(null);
  const [peersLoading, setPeersLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    refreshConfig().catch((err: Error) => setConfigError(err.message));
    refreshPeers().catch(() => undefined);
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

  async function saveConfig() {
    setBusy(true);
    setConfigError(null);
    try {
      const parsed = await saveMinimaConfig(megammrHostInput);
      setConfig(parsed);
      setMegammrHostInput(parsed.megammrHost);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "Unknown error");
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
      await refreshPeers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Add peers failed";
      setConfigError(message);
      showToast({ tone: "error", title: "Add peers failed", message, timeoutMs: 9000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="grid gap-1" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Minima node settings</h3>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
          Configure the megammr sync host and manage peer connections.
        </p>
      </div>

      {actionsBlocked && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3" style={{ marginBottom: 16 }}>
          <p className="text-sm text-amber-800" style={{ margin: 0 }}>
            Unavailable until Minima is running.
          </p>
        </div>
      )}

      <MinimaRuntimeConfig
        config={config}
        megammrHostInput={megammrHostInput}
        setMegammrHostInput={setMegammrHostInput}
        peers={peers}
        peersLoading={peersLoading}
        peerslistInput={peerslistInput}
        setPeerslistInput={setPeerslistInput}
        busy={busy || actionsBlocked}
        onSave={saveConfig}
        onAddPeers={runAddPeers}
      />
      {configError && <ErrorText>{configError}</ErrorText>}
    </Card>
  );
}
