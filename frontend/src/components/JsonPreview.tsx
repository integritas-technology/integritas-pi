import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export function JsonPreview({
  value,
  label = "View JSON",
  variant = "link",
  icon,
  disabled = false
}: {
  value: unknown;
  label?: string;
  variant?: "link" | "button";
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "button" ? (
        <Button type="button" size="sm" variant="secondary" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
          {icon}
          {label}
        </Button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          className="border-0 bg-transparent p-0 font-extrabold text-blue-600 underline disabled:cursor-not-allowed disabled:opacity-55 disabled:no-underline"
          onClick={() => setOpen(true)}
        >
          {label}
        </button>
      )}
      {open && (
        <Modal title="JSON preview" onClose={() => setOpen(false)}>
          <pre className="m-0 overflow-visible whitespace-pre-wrap rounded-2xl bg-slate-900 p-3.5 text-[0.84rem] text-blue-100 [overflow-wrap:anywhere]">{JSON.stringify(value, null, 2)}</pre>
        </Modal>
      )}
    </>
  );
}
