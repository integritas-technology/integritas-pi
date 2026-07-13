import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { Card } from "../../components/Card";
import { FileDropBox } from "./FileDropBox";

export function StampFilePanel({ file, setFile, busy, onStamp }: { file: File | null; setFile: (file: File) => void; busy: boolean; onStamp: () => void }) {
  return (
    <Card className="grid gap-4">
      <h3 className="m-0">Generate timestamp proof</h3>
      <FileDropBox title="Drop file to stamp" text="Hash exact local file bytes and request proof UID" file={file} onFile={setFile} />
      <ButtonRow>
        <Button type="button" disabled={busy || !file} onClick={onStamp}>Generate timestamp proof</Button>
      </ButtonRow>
    </Card>
  );
}
