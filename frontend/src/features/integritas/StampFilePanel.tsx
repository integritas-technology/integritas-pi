import { Card } from "../../components/Card";
import { FileDropBox } from "./FileDropBox";

export function StampFilePanel({ file, setFile, busy, result, onStamp }: { file: File | null; setFile: (file: File) => void; busy: boolean; result: unknown; onStamp: () => void }) {
  return (
    <Card className="integritas-action-card">
      <h3>Generate timestamp proof</h3>
      <FileDropBox title="Drop file to stamp" text="Hash exact local file bytes and request proof UID" file={file} onFile={setFile} result={result} resultText="or drop a new file to stamp again." />
      <div className="button-row">
        <button type="button" disabled={busy || !file} onClick={onStamp}>Generate timestamp proof</button>
      </div>
    </Card>
  );
}
