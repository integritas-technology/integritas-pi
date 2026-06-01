import { FileClock } from "lucide-react";
import { useState } from "react";

export function FileDropBox({ title, text, file, onFile }: { title: string; text: string; file: File | null; onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={`drop-box ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); const dropped = event.dataTransfer.files.item(0); if (dropped) onFile(dropped); }}
    >
      <FileClock size={30} />
      <strong>{file ? file.name : title}</strong>
      <span>{file ? `${file.size} bytes` : text}</span>
      <input type="file" onChange={(event) => { const selected = event.target.files?.item(0); if (selected) onFile(selected); }} />
    </label>
  );
}
