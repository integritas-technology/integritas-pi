import { FileClock } from "lucide-react";
import { useState } from "react";
import { JsonPreview } from "../../components/JsonPreview";

export function FileDropBox({ title, text, file, onFile, result, resultText }: { title: string; text: string; file: File | null; onFile: (file: File) => void; result?: unknown; resultText?: string }) {
  const [dragging, setDragging] = useState(false);
  const hasResult = result !== undefined && result !== null && !file;

  return (
    <div
      className={`drop-box ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); const dropped = event.dataTransfer.files.item(0); if (dropped) onFile(dropped); }}
    >
      <FileClock size={30} />
      {hasResult ? (
        <>
          <JsonPreview value={result} label="View results" />
          <label className="drop-box-file-label">
            {resultText}
            <input type="file" onChange={(event) => { const selected = event.target.files?.item(0); if (selected) onFile(selected); }} />
          </label>
        </>
      ) : (
        <label className="drop-box-file-label">
          <strong>{file ? file.name : title}</strong>
          <span>{file ? `${file.size} bytes` : text}</span>
          <input type="file" onChange={(event) => { const selected = event.target.files?.item(0); if (selected) onFile(selected); }} />
        </label>
      )}
    </div>
  );
}
