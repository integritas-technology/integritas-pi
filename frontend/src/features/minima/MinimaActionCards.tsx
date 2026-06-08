import { RefreshCw } from "lucide-react";
import type { MinimaCommandResult, MinimaConfig } from "../../app/types";
import { Card } from "../../components/Card";
import { JsonPreview } from "../../components/JsonPreview";

export function MinimaActionCards({ config, result, busy, error, onResync }: { config: MinimaConfig | null; result: MinimaCommandResult | null; busy: boolean; error: string | null; onResync: () => void }) {
  return (
    <div className="data-source-template-grid">
      <Card className="data-source-template">
        <RefreshCw size={24} />
        <h3>Sync status</h3>
        <p>Trigger Megammr resync against <code>{config?.megammrHost ?? "megammr.minima.global:9001"}</code></p>
        <button type="button" disabled={busy} onClick={onResync}>Resync</button>
        {error && <p className="error-text">{error}</p>}
        {result && <JsonPreview value={result} label="View resync result" />}
      </Card>
    </div>
  );
}
