import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cx } from "../lib/cx";

export function ErrorAlert({
  title,
  children,
  action,
  className,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex max-w-xl items-start gap-3 rounded border border-red-200 bg-red-50 p-3.5",
        className,
      )}
      role="alert"
    >
      <AlertCircle className="mt-0.5 shrink-0 text-red-700" size={20} aria-hidden="true" />
      <div className="grid min-w-0 flex-1 gap-1">
        {title ? <strong className="text-sm font-bold text-red-950">{title}</strong> : null}
        <div className="text-sm leading-relaxed text-red-800">{children}</div>
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
