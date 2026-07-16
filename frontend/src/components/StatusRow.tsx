import type { ReactNode } from "react";
import { cx } from "../lib/cx";

export function StatusRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>{children}</div>;
}
