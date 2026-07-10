import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { Card } from "../../components/Card";
import { FileDropBox } from "./FileDropBox";

export function VerifyProofPanel({ file, setFile, busy, result, onVerifyFile }: { file: File | null; setFile: (file: File) => void; busy: boolean; result: unknown; onVerifyFile: () => void }) {
  return (
    <Card className="integritas-action-card">
      <h3>Verify data</h3>
      <FileDropBox title="Drop proof JSON file" text="Verify a JSON proof payload file" file={file} onFile={setFile} result={result} resultText="or drop a new file to verify again." />
      <ButtonRow>
        <Button type="button" disabled={busy || !file} onClick={onVerifyFile}>Verify data</Button>
      </ButtonRow>
    </Card>
  );
}
