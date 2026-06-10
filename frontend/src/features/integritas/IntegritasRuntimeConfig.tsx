import { ExternalLink } from 'lucide-react';
import type { IntegritasConfig } from '../../app/types';
import { StatusBadge } from '../../components/StatusBadge';
import type { IntegritasApiKeyCheck } from './integritasTypes';

function formatCheckedAt(checkedAt: string) {
  try {
    return new Date(checkedAt).toLocaleString();
  } catch {
    return checkedAt;
  }
}

export function IntegritasRuntimeConfig({
  config,
  apiKeyInput,
  setApiKeyInput,
  keyCheck,
  keyCheckBusy,
  busy,
  onCheckKey,
  onSave,
  onClear,
}: {
  config: IntegritasConfig | null;
  apiKeyInput: string;
  setApiKeyInput: (value: string) => void;
  keyCheck: IntegritasApiKeyCheck | null;
  keyCheckBusy: boolean;
  busy: boolean;
  onCheckKey: () => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const portalUrl = config?.portalUrl;
  const hasApiKey = Boolean(config?.hasApiKey);

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
        <div className='flex flex-wrap gap-2'>
          <StatusBadge ok={hasApiKey}>
            {hasApiKey ? 'API key configured' : 'API key missing'}
          </StatusBadge>
          {hasApiKey && (
            <StatusBadge
              ok={keyCheckBusy ? false : Boolean(keyCheck?.valid)}
            >
              {keyCheckBusy
                ? 'Checking key…'
                : !keyCheck
                  ? 'Validity unknown'
                  : keyCheck.valid
                    ? 'Key valid'
                    : 'Key invalid'}
            </StatusBadge>
          )}
        </div>
        {keyCheck && !keyCheckBusy && (
          <p className='m-0 text-sm text-slate-500'>
            Last checked {formatCheckedAt(keyCheck.checkedAt)}
            {keyCheck.valid === false && keyCheck.error
              ? ` — ${keyCheck.error}`
              : ''}
          </p>
        )}
        <input
          value={apiKeyInput}
          onChange={(event) => setApiKeyInput(event.target.value)}
          placeholder='Paste API key'
          type='password'
          autoComplete='off'
        />
        <div className='button-row'>
          <button
            type='button'
            disabled={busy || keyCheckBusy || !hasApiKey}
            onClick={onCheckKey}
          >
            Check key
          </button>
          <button
            type='button'
            disabled={busy || !apiKeyInput}
            onClick={onSave}
          >
            Save API key
          </button>
          <button
            type='button'
            disabled={busy || !hasApiKey}
            onClick={onClear}
          >
            Clear stored key
          </button>
        </div>
      </div>
    </section>
  );
}
