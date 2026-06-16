import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyableCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures in non-secure contexts
    }
  }

  return (
    <div className="flex items-start gap-2 rounded-xl bg-slate-100 p-3">
      <code className="flex-1 break-all text-xs text-slate-700 font-mono">{value}</code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        title={copied ? "Copied" : "Copy"}
        className="shrink-0 rounded-md border-0 bg-slate-200 p-1.5 text-slate-700 hover:bg-slate-300"
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}
