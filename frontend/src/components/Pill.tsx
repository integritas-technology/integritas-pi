import type { Tone } from "../app/types";
import { cx } from "../lib/cx";

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={cx("pill", `pill-${tone}`)}>{children}</span>;
}
