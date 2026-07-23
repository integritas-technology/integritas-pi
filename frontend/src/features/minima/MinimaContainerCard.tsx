import { RotateCcw } from "lucide-react";
import type { MinimaNodeStatus } from "../../app/types";
import { Button } from "../../components/Button";
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
    <Button type="button" size="sm" variant="secondary" className="w-full" disabled={busy} onClick={onRestart}>
      <RotateCcw size={16} />
      Restart
    </Button>
  ) : null;

  return (
    <div className="h-full">
    <MinimaStatGrid title="Container" footer={restartButton}>
      <MinimaStatCell label="CPU load" value={cpuLabel} />
      <MinimaStatCell label="Container memory" value={memoryLabel} />
      <MinimaStatCell label="State" value={stateLabel} />
      <MinimaStatCell label="Runtime" value={runtimeLabel} />
    </MinimaStatGrid>
    </div>
  );
}
