import { useState } from "react";
import { cx } from "../lib/cx";

export type StatusDotTone = "good" | "warn" | "unknown";

const dotToneClass: Record<StatusDotTone, string> = {
  good: "bg-emerald-500",
  warn: "bg-red-500",
  unknown: "bg-slate-300",
};

export function StatusDot({
  label,
  tone,
  children,
}: {
  label: string;
  tone: StatusDotTone;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-white px-2.5 py-1 text-xs font-bold text-brand-graphite transition-colors select-none hover:bg-brand-bg">
        <span className={cx("size-2.5 shrink-0 rounded-full", dotToneClass[tone])} />
        {label}
      </span>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-64 rounded border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}
