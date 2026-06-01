import { Card } from "../../components/Card";
import { FileDropBox } from "./FileDropBox";
import type { IntegritasProofRecord } from "./integritasTypes";

export function VerifyProofPanel({ file, setFile, busy, selectedRecord, onVerifyFile, onVerifySelected }: { file: File | null; setFile: (file: File) => void; busy: boolean; selectedRecord: IntegritasProofRecord | null; onVerifyFile: () => void; onVerifySelected: () => void }) {
  const hasSelectedPayload = Boolean(selectedRecord?.proof_payload);

  return (
    <Card className="integritas-action-card">
      <h3>Verify data</h3>
      <FileDropBox title="Drop proof JSON file" text="Verify a JSON proof payload file" file={file} onFile={setFile} />
      <div className="button-row">
        <button type="button" disabled={busy || !file} onClick={onVerifyFile}>Verify data</button>
        <button type="button" disabled={busy || !hasSelectedPayload} onClick={onVerifySelected}>Verify selected history proof</button>
      </div>
      {selectedRecord && <p className="muted">Selected UID: {selectedRecord.proof_uid ?? "none"}</p>}
    </Card>
  );
}
