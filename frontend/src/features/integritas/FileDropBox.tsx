import { FileClock } from "lucide-react";
import { useState } from "react";
import { JsonPreview } from "../../components/JsonPreview";
import { cx } from "../../lib/cx";

export function FileDropBox({ title, text, file, onFile, result, resultText }: { title: string; text: string; file: File | null; onFile: (file: File) => void; result?: unknown; resultText?: string }) {
  const [dragging, setDragging] = useState(false);
  const hasResult = result !== undefined && result !== null && !file;

  return (
    <div
      className={cx(
        "grid min-h-[220px] place-items-center gap-2.5 rounded-[24px] border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-600",
        dragging && "border-slate-950 bg-slate-100"
      )}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); const dropped = event.dataTransfer.files.item(0); if (dropped) onFile(dropped); }}
    >
      <FileClock size={30} />
      {hasResult ? (
        <>
          <JsonPreview value={result} label="View results" />
          <label className="grid gap-2.5 cursor-pointer">
            {resultText}
            <input className="hidden" type="file" onChange={(event) => { const selected = event.target.files?.item(0); if (selected) onFile(selected); }} />
          </label>
        </>
      ) : (
        <label className="grid gap-2.5 cursor-pointer">
          <strong>{file ? file.name : title}</strong>
          <span>{file ? `${file.size} bytes` : text}</span>
          <input className="hidden" type="file" onChange={(event) => { const selected = event.target.files?.item(0); if (selected) onFile(selected); }} />
        </label>
      )}
    </div>
  );
}
