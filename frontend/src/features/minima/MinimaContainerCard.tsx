import type { MinimaNodeStatus } from "../../app/types";
import { LoadingDots } from "../../components/LoadingDots";
import { MinimaStatCell, MinimaStatGrid } from "./MinimaStatCell";

function formatContainerMemory(container: MinimaNodeStatus["container"] | undefined) {
  const memory = container?.memory;
  if (!memory?.usage) return null;
  return memory.limit ? `${memory.usage} / ${memory.limit}` : memory.usage;
}

function formatContainerState(state: string | undefined) {
  if (!state) return null;
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export function MinimaContainerCard({
  status,
  loading,
  busy,
  refreshing,
  onRestart
}: {
  status: MinimaNodeStatus | null;
  loading: boolean;
  busy?: boolean;
  refreshing?: boolean;
  onRestart?: () => void;
}) {
  const container = refreshing ? undefined : status?.container;
  const unavailable = (loading || refreshing) && !container ? <LoadingDots /> : "—";

  const cpuLabel = container?.cpuPercent != null ? `${container.cpuPercent}%` : unavailable;
  const memoryLabel = formatContainerMemory(container) ?? unavailable;
  const stateLabel = formatContainerState(container?.state) ?? unavailable;
  const runtimeLabel = container?.status ?? unavailable;

  const restartButton = onRestart ? (
    <button
      type="button"
      className="shrink-0 rounded-[14px] border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 disabled:opacity-60"
      disabled={busy}
      onClick={onRestart}
    >
      Restart
    </button>
  ) : null;

  return (
    <div className="h-full">
    <MinimaStatGrid title="Container" headerAction={restartButton}>
      <MinimaStatCell label="CPU load" value={cpuLabel} />
      <MinimaStatCell label="Container memory" value={memoryLabel} />
      <MinimaStatCell label="State" value={stateLabel} />
      <MinimaStatCell label="Runtime" value={runtimeLabel} />
    </MinimaStatGrid>
    </div>
  );
}
