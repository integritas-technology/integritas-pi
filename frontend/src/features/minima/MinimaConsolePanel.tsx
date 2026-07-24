import { useRef, useState } from "react";
import { runConsoleCommand } from "./minimaConsoleApi";

type ScrollbackEntry = {
  id: string;
  command: string;
  status: "pending" | "ok" | "error" | "empty";
  result: string;
  timestamp: string;
};

export function MinimaConsolePanel({ disabled }: { disabled?: boolean }) {
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<ScrollbackEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const running = entries.some((entry) => entry.status === "pending");

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
        { id: crypto.randomUUID(), command: "", status: "empty", result: "", timestamp: new Date().toISOString() },
        ...current
      ]);
      return;
    }

    const id = crypto.randomUUID();
    setEntries((current) => [
      { id, command: trimmed, status: "pending", result: "", timestamp: new Date().toISOString() },
      ...current
    ]);

    try {
      const result = await runConsoleCommand(trimmed);
      setEntries((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, status: "ok", result: JSON.stringify(result, null, 2) } : entry))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, status: "error", result: message } : entry)));
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-100">
      <form onSubmit={(e) => void runCommand(e)} className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
        <span className="text-emerald-400">$</span>
        <input
          ref={inputRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          placeholder={disabled ? "Unavailable" : "status"}
          className="flex-1 bg-transparent text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-50"
        />
      </form>
      <div className="max-h-96 min-h-[6rem] overflow-auto p-3" onClick={() => inputRef.current?.focus()}>
        {entries.length === 0 ? (
          <p className="m-0 text-slate-500">No commands run yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="mb-3 last:mb-0">
              <div className="text-emerald-400">$ {entry.command}</div>
              {entry.status === "pending" && <div className="text-slate-500">Running…</div>}
              {(entry.status === "ok" || entry.status === "error") && (
                <pre className={`m-0 whitespace-pre-wrap break-words ${entry.status === "ok" ? "text-slate-100" : "text-red-400"}`}>
                  {entry.result}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
