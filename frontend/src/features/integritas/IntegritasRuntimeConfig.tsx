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

function ConfigDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className='grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3'>
      <dt className='m-0 text-sm font-medium text-slate-500'>{label}</dt>
      <dd className='m-0 font-mono text-sm text-slate-800 break-all'>{value}</dd>
    </div>
  );
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
    <section className='grid min-w-0 gap-4'>
      <div className='rounded-2xl border border-slate-200 bg-white p-4'>
        <h4 className='m-0 mb-3 text-sm font-semibold text-slate-900'>
          Runtime configuration
        </h4>
        <dl className='m-0 grid gap-3'>
          <ConfigDetail
            label='baseUrl'
            value={config?.baseUrl ?? 'loading...'}
          />
          <ConfigDetail
            label='requestId'
            value={config?.requestId ?? 'loading...'}
          />
          <ConfigDetail
            label='apiKeySource'
            value={config?.apiKeySource ?? 'loading...'}
          />
        </dl>
      </div>

      {portalUrl && (
        <div className='rounded-2xl border border-slate-200 bg-white px-4 py-3'>
          <a
            className='inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 underline-offset-2 hover:underline'
            href={portalUrl}
            target='_blank'
            rel='noreferrer'
          >
            View API usage in Integritas portal
            <ExternalLink size={14} aria-hidden />
          </a>
        </div>
      )}

      <div className='api-key-box rounded-2xl border border-slate-200 bg-white p-4'>
        <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2'>
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
        </div>
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
