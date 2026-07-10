import type { ReactNode } from "react";
import { cx } from "../lib/cx";

export function ButtonRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-wrap gap-2", className)}>{children}</div>;
}
