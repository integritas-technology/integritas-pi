import type { MinimaNodeStatus } from "../../app/types";
import { MinimaStatCell, MinimaStatGrid } from "./MinimaStatCell";

function formatContainerMemory(status: MinimaNodeStatus | null) {
  const memory = status?.container?.memory;
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
  onRestart
}: {
  status: MinimaNodeStatus | null;
  loading: boolean;
  busy?: boolean;
  onRestart?: () => void;
}) {
  const container = status?.container;
  const unavailable = loading && !container ? "Checking…" : "—";

  const cpuLabel = container?.cpuPercent != null ? `${container.cpuPercent}%` : unavailable;
  const memoryLabel = formatContainerMemory(status) ?? unavailable;
  const stateLabel = formatContainerState(container?.state) ?? unavailable;
  const runtimeLabel = container?.status ?? unavailable;

  return (
    <div className="grid gap-4">
      <MinimaStatGrid
        title="Container"
        description="Docker runtime for the Minima service. CPU is only available from Docker."
      >
        <MinimaStatCell label="CPU load" value={cpuLabel} />
        <MinimaStatCell label="Container memory" value={memoryLabel} />
        <MinimaStatCell label="State" value={stateLabel} />
        <MinimaStatCell label="Runtime" value={runtimeLabel} />
      </MinimaStatGrid>

      {onRestart && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="w-fit rounded-[14px] border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 disabled:opacity-60"
            disabled={busy}
            onClick={onRestart}
          >
            Restart container
          </button>
          <p className="m-0 text-xs leading-5 text-slate-500">
            Restarts the Minima Docker service. RPC may be unavailable for a short time.
          </p>
        </div>
      )}
    </div>
  );
}
