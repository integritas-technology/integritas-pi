import { Pill } from "./Pill";

export function StatusBadge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <Pill tone={ok ? "good" : "warn"}>{children}</Pill>;
}
