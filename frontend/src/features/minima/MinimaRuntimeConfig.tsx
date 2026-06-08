import type { MinimaConfig } from "../../app/types";

export function MinimaRuntimeConfig({ config, megammrHostInput, setMegammrHostInput, busy, onSave }: { config: MinimaConfig | null; megammrHostInput: string; setMegammrHostInput: (value: string) => void; busy: boolean; onSave: () => void }) {
  return (
    <section className="config-card runtime-config-panel">
      <div>
        <strong>Runtime configuration</strong>
        <code>megammrHost: {config?.megammrHost ?? "loading..."}</code>
        <code>megammrHostSource: {config?.megammrHostSource ?? "loading..."}</code>
      </div>
      <div className="api-key-box">
        <label>Megammr host URL<input value={megammrHostInput} onChange={(event) => setMegammrHostInput(event.target.value)} placeholder="megammr.minima.global:9001" /></label>
        <div className="button-row">
          <button type="button" disabled={busy || !megammrHostInput.trim()} onClick={onSave}>Save Minima configuration</button>
        </div>
      </div>
    </section>
  );
}
