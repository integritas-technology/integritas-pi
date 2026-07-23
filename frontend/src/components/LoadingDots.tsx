import { cx } from "../lib/cx";

export function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1", className)} role="status" aria-label="Loading">
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
    </span>
  );
}
