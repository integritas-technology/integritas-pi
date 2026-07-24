import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { runConsoleCommand } from "./minimaConsoleApi";

type ScrollbackEntry = {
  command: string;
  result: string;
  ok: boolean;
  timestamp: string;
};

export function MinimaConsolePanel({ disabled }: { disabled?: boolean }) {
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState<ScrollbackEntry[]>([]);

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = command.trim();
    if (!trimmed || running) return;

    setRunning(true);
    try {
      const result = await runConsoleCommand(trimmed);
      setEntries((current) => [
        ...current,
        { command: trimmed, result: JSON.stringify(result, null, 2), ok: true, timestamp: new Date().toISOString() }
      ]);
      setCommand("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      setEntries((current) => [...current, { command: trimmed, result: message, ok: false, timestamp: new Date().toISOString() }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="max-h-96 min-h-[8rem] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-slate-100">
        {entries.length === 0 ? (
          <p className="m-0 text-slate-500">No commands run yet.</p>
        ) : (
          entries.map((entry, index) => (
            <div key={index} className="mb-3 last:mb-0">
              <div className="text-emerald-400">$ {entry.command}</div>
              <pre className={`m-0 whitespace-pre-wrap break-words ${entry.ok ? "text-slate-100" : "text-red-400"}`}>{entry.result}</pre>
            </div>
          ))
        )}
      </div>
      <form onSubmit={(e) => void runCommand(e)} className="flex gap-2">
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="status"
          disabled={disabled || running}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <Button type="submit" size="sm" disabled={disabled || running || !command.trim()}>
          <Play size={14} />
          {running ? "Running…" : "Run"}
        </Button>
      </form>
    </div>
  );
}
