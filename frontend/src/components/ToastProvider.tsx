import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ToastTone = "error" | "success" | "info";
type Toast = { id: string; tone: ToastTone; title: string; message?: string };
type ToastInput = { title: string; message?: string; tone?: ToastTone; timeoutMs?: number };

const ToastContext = createContext<{ showToast: (toast: ToastInput) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    setMounted(true);
  }, []);

  function dismissToast(id: string) {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function keepToastOpen(id: string) {
    const timer = timers.current.get(id);
    if (!timer) return;
    window.clearTimeout(timer);
    timers.current.delete(id);
  }

  function showToast({ title, message, tone = "info", timeoutMs = 6000 }: ToastInput) {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, title, message, tone }]);
    timers.current.set(id, window.setTimeout(() => dismissToast(id), timeoutMs));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted && createPortal(<ToastViewport toasts={toasts} onDismiss={dismissToast} onKeepOpen={keepToastOpen} />, document.body)}
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss, onKeepOpen }: { toasts: Toast[]; onDismiss: (id: string) => void; onKeepOpen: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[9999] grid w-[min(420px,calc(100vw-40px))] gap-3" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)]" key={toast.id} onMouseEnter={() => onKeepOpen(toast.id)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={toast.tone === "error" ? "h-2.5 w-2.5 rounded-full bg-red-600" : toast.tone === "success" ? "h-2.5 w-2.5 rounded-full bg-emerald-600" : "h-2.5 w-2.5 rounded-full bg-blue-600"} />
                  <strong className="text-sm text-slate-950">{toast.title}</strong>
                </div>
                {toast.message && <p className="mt-2 break-words text-sm leading-5 text-slate-600">{toast.message}</p>}
              </div>
              <button className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-0 bg-slate-100 text-slate-600 hover:bg-slate-200" type="button" aria-label="Close notification" onClick={() => onDismiss(toast.id)}><X size={16} /></button>
            </div>
          </div>
        ))}
      </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
