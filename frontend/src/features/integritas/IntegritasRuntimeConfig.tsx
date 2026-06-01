import type { IntegritasConfig } from "../../app/types";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";

export function IntegritasRuntimeConfig({ config, apiKeyInput, setApiKeyInput, busy, onSave, onClear }: { config: IntegritasConfig | null; apiKeyInput: string; setApiKeyInput: (value: string) => void; busy: boolean; onSave: () => void; onClear: () => void }) {
  return (
    <Card className="config-card">
      <div>
        <strong>Runtime configuration</strong>
        <code>baseUrl: {config?.baseUrl ?? "loading..."}</code>
        <code>requestId: {config?.requestId ?? "loading..."}</code>
        <code>apiKeySource: {config?.apiKeySource ?? "loading..."}</code>
      </div>
      <div className="api-key-box">
        <StatusBadge ok={Boolean(config?.hasApiKey)}>{config?.hasApiKey ? "API key configured" : "API key missing"}</StatusBadge>
        <input value={apiKeyInput} onChange={(event) => setApiKeyInput(event.target.value)} placeholder="Paste API key" type="password" />
        <div className="button-row">
          <button type="button" disabled={busy || !apiKeyInput} onClick={onSave}>Save API key</button>
          <button type="button" disabled={busy || !config?.hasApiKey} onClick={onClear}>Clear stored key</button>
        </div>
      </div>
    </Card>
  );
}
