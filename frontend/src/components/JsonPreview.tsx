import { useEffect, useId, useState } from "react";

export function JsonPreview({ value, label = "View JSON" }: { value: unknown; label?: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" className="json-link" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="json-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
            <div className="json-modal-header">
              <h3 id={titleId}>JSON preview</h3>
              <button type="button" onClick={() => setOpen(false)}>Close</button>
            </div>
            <pre className="json-preview">{JSON.stringify(value, null, 2)}</pre>
          </div>
        </div>
      )}
    </>
  );
}
