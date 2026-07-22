import { useState } from "react";
import { normalizeError } from "../lib/errors";
import { Modal } from "./Modal";

export function ErrorDetails({ error, label = "View details" }: { error: unknown; label?: string }) {
  const [open, setOpen] = useState(false);
  const normalized = normalizeError(error);

  return (
    <>
      <button type="button" className="border-0 bg-transparent p-0 font-extrabold text-blue-600 underline" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <Modal title="Error details" onClose={() => setOpen(false)}>
          <div className="grid gap-4">
            <section className="grid gap-1">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Type</span>
              <strong>{normalized.title}</strong>
            </section>
            <section className="grid gap-1">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Message</span>
              <p className="m-0 text-slate-800">{normalized.message}</p>
            </section>
            {normalized.nativeMessage && normalized.nativeMessage !== normalized.message && (
              <section className="grid gap-1">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Native details</span>
                <code className="whitespace-pre-wrap break-words rounded-xl bg-slate-200 p-3 text-slate-800">{normalized.nativeMessage}</code>
              </section>
            )}
            {(normalized.domain || normalized.nativeCode || normalized.occurredAt) && (
              <section className="grid gap-1">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Context</span>
                <div className="grid gap-1 text-sm text-slate-700">
                  <span>Domain: {normalized.domain}</span>
                  <span>Error type: {normalized.type}</span>
                  {normalized.nativeCode && <span>Native code: {normalized.nativeCode}</span>}
                  {normalized.occurredAt && <span>Time: {normalized.occurredAt}</span>}
                </div>
              </section>
            )}
            {normalized.context && (
              <section className="grid gap-1">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Additional context</span>
                <pre className="m-0 overflow-visible whitespace-pre-wrap rounded-2xl bg-slate-900 p-3.5 text-[0.84rem] text-blue-100 [overflow-wrap:anywhere]">{JSON.stringify(normalized.context, null, 2)}</pre>
              </section>
            )}
            <section className="grid gap-1">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Raw</span>
              <pre className="m-0 overflow-visible whitespace-pre-wrap rounded-2xl bg-slate-900 p-3.5 text-[0.84rem] text-blue-100 [overflow-wrap:anywhere]">{JSON.stringify(normalized.raw, null, 2)}</pre>
            </section>
          </div>
        </Modal>
      )}
    </>
  );
}
