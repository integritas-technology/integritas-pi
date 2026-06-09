import { useEffect, useId, type ReactNode } from "react";

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-5" role="presentation" onClick={onClose}>
      <div className="max-h-[min(760px,90vh)] w-[min(980px,100%)] min-w-0 rounded-[28px] border border-slate-400 bg-white p-2 shadow-[0_28px_80px_rgba(15,23,42,0.28)]" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className="grid max-h-[calc(min(760px,90vh)-16px)] min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h3 className="m-0" id={titleId}>{title}</h3>
            <button className="rounded-[14px] border-0 bg-slate-950 px-3.5 py-2.5 text-white" type="button" onClick={onClose}>Close</button>
          </div>
          <div className="min-h-0 min-w-0 overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
