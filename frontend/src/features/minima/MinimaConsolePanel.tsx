import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { runConsoleCommand } from "./minimaConsoleApi";

type ScrollbackEntry = {
  id: string;
  command: string;
  status: "pending" | "ok" | "error" | "empty";
  payload?: unknown;
  error?: string;
  timestamp: string;
};

const scrollbarClass =
  "[scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb:hover]:bg-slate-400";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// JSON.stringify escapes embedded newlines in string values as the two literal characters
// "\n" — valid JSON, but unreadable for multi-line help text (e.g. `logs help:`). Un-escape
// them for display; this is no longer strictly valid JSON, but it's meant to be read, not parsed.
function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/\\n/g, "\n");
}

// Minima RPC results are wrapped as { ok, status, source, command, body: { ...,
// response } }. The `response` field is the part an operator actually cares about;
// everything else is envelope/metadata worth keeping around but not front-and-center.
function extractResponse(payload: unknown): { response: unknown; envelope: unknown } {
  if (!isRecord(payload) || !isRecord(payload.body) || !("response" in payload.body)) {
    return { response: undefined, envelope: payload };
  }
  const { response, ...restBody } = payload.body;
  return { response, envelope: { ...payload, body: restBody } };
}

function ConsoleResult({ payload }: { payload: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const { response, envelope } = extractResponse(payload);

  if (response === undefined) {
    return <pre className="m-0 whitespace-pre-wrap break-words text-slate-800">{prettyJson(payload)}</pre>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="border-0 bg-transparent p-0 text-slate-500 hover:text-slate-700"
      >
        {expanded ? "▾" : "▸"} Payload (response shown below)
      </button>
      {expanded && <pre className="m-0 mt-1 whitespace-pre-wrap break-words text-slate-500">{prettyJson(envelope)}</pre>}
      <pre className="m-0 mt-1 whitespace-pre-wrap break-words text-slate-800">{prettyJson(response)}</pre>
    </div>
  );
}

export function MinimaConsolePanel({ disabled }: { disabled?: boolean }) {
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<ScrollbackEntry[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const running = entries.some((entry) => entry.status === "pending");

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen]);

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || running) return;

    const trimmed = command.trim();
    setCommand("");

    // Every Enter press clears the line and records a scrollback entry — even an empty
    // one — the same way a real terminal always advances the prompt, whether or not
    // anything ran.
    if (!trimmed) {
      setEntries((current) => [
        { id: crypto.randomUUID(), command: "", status: "empty", timestamp: new Date().toISOString() },
        ...current
      ]);
      return;
    }

    const id = crypto.randomUUID();
    setEntries((current) => [{ id, command: trimmed, status: "pending", timestamp: new Date().toISOString() }, ...current]);

    try {
      const result = await runConsoleCommand(trimmed);
      setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, status: "ok", payload: result } : entry)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, status: "error", error: message } : entry)));
    }
  }

  // Clicking inside the scrollback to refocus the input is a nice touch, but doing it
  // unconditionally stole focus (and collapsed the selection highlight) after the mouseup
  // that ends a text-selection drag. Only refocus when the click isn't the tail end of a
  // selection.
  function focusInputUnlessSelecting() {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    inputRef.current?.focus();
  }

  const scrollback = (
    <div className={`flex-1 overflow-auto p-3 ${scrollbarClass}`} onClick={focusInputUnlessSelecting}>
      {entries.length === 0 ? (
        <p className="m-0 text-slate-500">No commands run yet.</p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="mb-3 last:mb-0">
            <div className="text-emerald-700">$ {entry.command}</div>
            {entry.status === "pending" && <div className="text-slate-500">Running…</div>}
            {entry.status === "error" && <pre className="m-0 whitespace-pre-wrap break-words text-red-600">{entry.error}</pre>}
            {entry.status === "ok" && <ConsoleResult payload={entry.payload} />}
          </div>
        ))
      )}
    </div>
  );

  const promptRow = (
    <form onSubmit={(e) => void runCommand(e)} className="flex items-center gap-2 border-b border-slate-300 px-3 py-2.5">
      <span className="text-emerald-600">$</span>
      <input
        ref={inputRef}
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        placeholder={disabled ? "Unavailable" : "status"}
        className="flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-55"
      />
      <button
        type="button"
        aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        onClick={() => setFullscreen((value) => !value)}
        className="shrink-0 rounded-lg border-0 bg-transparent p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
      >
        {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>
    </form>
  );

  if (fullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-50 bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="RPC console, fullscreen">
        <div className="mx-auto flex h-full max-w-5xl flex-col rounded-xl border border-slate-300 bg-slate-50 font-mono text-sm text-slate-800 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
          {promptRow}
          {scrollback}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="flex h-[28rem] flex-col rounded-xl border border-slate-300 bg-slate-50 font-mono text-sm text-slate-800">
      {promptRow}
      {scrollback}
    </div>
  );
}
