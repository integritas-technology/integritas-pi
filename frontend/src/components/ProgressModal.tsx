import { Loader2 } from "lucide-react";
import { Modal } from "./Modal";

export function ProgressModal({ title, headline, message }: { title: string; headline: string; message: string }) {
  return (
    <Modal title={title} closeDisabled onClose={() => undefined}>
      <div className="grid min-h-56 place-items-center gap-5 text-center">
        <Loader2 className="size-16 animate-spin text-slate-950" aria-hidden="true" />
        <div className="grid gap-2">
          <p className="m-0 text-3xl font-extrabold text-slate-950">{headline}</p>
          <p className="m-0 max-w-xl text-sm text-slate-500">{message}</p>
        </div>
      </div>
    </Modal>
  );
}
