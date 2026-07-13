import { useState } from "react";
import { Modal } from "./Modal";

export function JsonPreview({ value, label = "View JSON" }: { value: unknown; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="border-0 bg-transparent p-0 font-extrabold text-blue-600 underline" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <Modal title="JSON preview" onClose={() => setOpen(false)}>
          <pre className="m-0 overflow-visible whitespace-pre-wrap rounded-2xl bg-slate-900 p-3.5 text-[0.84rem] text-blue-100 [overflow-wrap:anywhere]">{JSON.stringify(value, null, 2)}</pre>
        </Modal>
      )}
    </>
  );
}
