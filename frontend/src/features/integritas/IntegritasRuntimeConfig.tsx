import { ExternalLink } from 'lucide-react';
import type { IntegritasConfig } from '../../app/types';
import { StatusBadge } from '../../components/StatusBadge';

export function IntegritasRuntimeConfig({
  config,
  apiKeyInput,
  setApiKeyInput,
  busy,
  onSave,
  onClear,
}: {
  config: IntegritasConfig | null;
  apiKeyInput: string;
  setApiKeyInput: (value: string) => void;
  busy: boolean;
  onSave: () => void;
  onClear: () => void;
}) {
  const portalUrl = config?.portalUrl;

  return (
    <section className='config-card runtime-config-panel'>
      <div>
        <strong>Runtime configuration</strong>
        <code>baseUrl: {config?.baseUrl ?? 'loading...'}</code>
        <code>requestId: {config?.requestId ?? 'loading...'}</code>
        <code>apiKeySource: {config?.apiKeySource ?? 'loading...'}</code>
        {portalUrl && (
          <p className='muted portal-link-row'>
            <a href={portalUrl} target='_blank' rel='noreferrer'>
              View API usage in Integritas portal <ExternalLink size={14} />
            </a>
          </p>
        )}
      </div>
      <div className='api-key-box'>
        <StatusBadge ok={Boolean(config?.hasApiKey)}>
          {config?.hasApiKey ? 'API key configured' : 'API key missing'}
        </StatusBadge>
        <input
          value={apiKeyInput}
          onChange={(event) => setApiKeyInput(event.target.value)}
          placeholder='Paste API key'
          type='password'
        />
        <div className='button-row'>
          <button
            type='button'
            disabled={busy || !apiKeyInput}
            onClick={onSave}
          >
            Save API key
          </button>
          <button
            type='button'
            disabled={busy || !config?.hasApiKey}
            onClick={onClear}
          >
            Clear stored key
          </button>
        </div>
      </div>
    </section>
  );
}
