import { createContext, useContext, useState, type ReactNode } from "react";

type ToastTone = "error" | "success" | "info";
type Toast = { id: string; tone: ToastTone; title: string; message?: string };
type ToastInput = { title: string; message?: string; tone?: ToastTone; timeoutMs?: number };

const ToastContext = createContext<{ showToast: (toast: ToastInput) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function showToast({ title, message, tone = "info", timeoutMs = 6000 }: ToastInput) {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, title, message, tone }]);
    window.setTimeout(() => dismissToast(id), timeoutMs);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] grid w-[min(420px,calc(100vw-40px))] gap-3" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)]" key={toast.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={toast.tone === "error" ? "h-2.5 w-2.5 rounded-full bg-red-600" : toast.tone === "success" ? "h-2.5 w-2.5 rounded-full bg-emerald-600" : "h-2.5 w-2.5 rounded-full bg-blue-600"} />
                  <strong className="text-sm text-slate-950">{toast.title}</strong>
                </div>
                {toast.message && <p className="mt-2 break-words text-sm leading-5 text-slate-600">{toast.message}</p>}
              </div>
              <button className="rounded-lg border-0 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600" type="button" onClick={() => dismissToast(toast.id)}>Close</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
