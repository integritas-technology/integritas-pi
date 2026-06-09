import { useState } from "react";
import { Modal } from "./Modal";

export function JsonPreview({ value, label = "View JSON" }: { value: unknown; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="json-link" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <Modal title="JSON preview" onClose={() => setOpen(false)}>
          <pre className="json-preview !m-0 !max-h-none !max-w-none !overflow-visible !whitespace-pre-wrap [overflow-wrap:anywhere]">{JSON.stringify(value, null, 2)}</pre>
        </Modal>
      )}
    </>
  );
}
