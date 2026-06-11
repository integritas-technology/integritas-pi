import { cx } from "../../lib/cx";

export function MinimaStatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="m-0 text-sm text-slate-500">{label}</p>
      <p className="mt-1 mb-0 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function MinimaStatGrid({
  title,
  description,
  cols = "md:grid-cols-2",
  children
}: {
  title: string;
  description?: string;
  cols?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <h3 className="m-0 text-lg font-semibold text-slate-950">{title}</h3>
      {description && <p className="mt-2 mb-0 text-sm text-slate-500">{description}</p>}
      <div className={cx("mt-5 grid gap-4", cols)}>{children}</div>
    </section>
  );
}
