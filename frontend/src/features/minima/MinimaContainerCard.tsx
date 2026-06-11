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
  loading
}: {
  status: MinimaNodeStatus | null;
  loading: boolean;
}) {
  const container = status?.container;
  const unavailable = loading && !container ? "Checking…" : "—";

  const cpuLabel = container?.cpuPercent != null ? `${container.cpuPercent}%` : unavailable;
  const memoryLabel = formatContainerMemory(status) ?? unavailable;
  const stateLabel = formatContainerState(container?.state) ?? unavailable;
  const runtimeLabel = container?.status ?? unavailable;

  return (
    <MinimaStatGrid
      title="Container"
      description="Docker runtime for the Minima service. CPU is only available from Docker."
    >
      <MinimaStatCell label="CPU load" value={cpuLabel} />
      <MinimaStatCell label="Container memory" value={memoryLabel} />
      <MinimaStatCell label="State" value={stateLabel} />
      <MinimaStatCell label="Runtime" value={runtimeLabel} />
    </MinimaStatGrid>
  );
}
