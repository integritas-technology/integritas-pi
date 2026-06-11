import { cx } from "../../lib/cx";

export function MinimaStatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="h-full rounded-2xl bg-slate-50 p-4">
      <p className="m-0 text-sm text-slate-500">{label}</p>
      <p className="mt-1 mb-0 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function MinimaStatGrid({
  title,
  description,
  headerAction,
  footer,
  cols = "md:grid-cols-2",
  children
}: {
  title: string;
  description?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  cols?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-lg font-semibold text-slate-950">{title}</h3>
          <div className="mt-2 min-h-10">
            {description ? <p className="m-0 text-sm text-slate-500">{description}</p> : null}
          </div>
        </div>
        {headerAction}
      </div>
      <div className={cx("mt-5 grid flex-1 auto-rows-fr gap-4", cols)}>{children}</div>
      <div className="mt-4 min-h-11">{footer}</div>
    </section>
  );
}
