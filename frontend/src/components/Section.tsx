export function Section({ eyebrow, title, desc, action }: { eyebrow: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
        <h2 className="m-0 mt-1 text-3xl font-extrabold tracking-[-0.04em] text-slate-950">{title}</h2>
        {desc && <p className="mt-2 max-w-[760px] text-slate-500">{desc}</p>}
      </div>
      {action}
    </div>
  );
}
