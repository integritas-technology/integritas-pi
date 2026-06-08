import { Card } from "../../components/Card";
import { FileDropBox } from "./FileDropBox";

export function VerifyProofPanel({ file, setFile, busy, onVerifyFile }: { file: File | null; setFile: (file: File) => void; busy: boolean; onVerifyFile: () => void }) {
  return (
    <Card className="integritas-action-card">
      <h3>Verify data</h3>
      <FileDropBox title="Drop proof JSON file" text="Verify a JSON proof payload file" file={file} onFile={setFile} />
      <div className="button-row">
        <button type="button" disabled={busy || !file} onClick={onVerifyFile}>Verify data</button>
      </div>
    </Card>
  );
}
