import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MinimaNodeState } from '../../app/types';
import { Card } from '../../components/Card';
import { useToast } from '../../components/ToastProvider';
import { useMinimaStatusRefresh } from '../minima/useMinimaStatusRefresh';
import { importWallet as importWalletApi } from './walletApi';
import type { ImportWalletResult } from './walletTypes';

export function WalletSettingsPanel() {
  const { showToast } = useToast();
  const [minimaState, setMinimaState] = useState<MinimaNodeState | null>(null);
  useMinimaStatusRefresh(
    (status) => setMinimaState(status.state),
    () => {}
  );
  // Only allow wallet actions once Minima is confirmed running — see WalletPage.tsx
  // for the same pattern applied to the wallet page's own action buttons.
  const actionsBlocked = minimaState !== 'running';
  const minimaConfirmedUnavailable = minimaState !== null && minimaState !== 'running';

  const [view, setView] = useState<'menu' | 'import'>('menu');
  const [phrase, setPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportWalletResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function goBack() {
    setView('menu');
    setPhrase('');
    setError(null);
    setResult(null);
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phrase.trim();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (wordCount < 12) {
      setError('Seed phrase must be at least 12 words.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await importWalletApi(trimmed);
      setResult(res);
      if (res.ok) {
        showToast({ tone: 'success', title: 'Wallet imported', message: res.message });
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className='grid gap-1' style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Wallet settings</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
          Manage the node wallet's backup and restore options.
        </p>
      </div>

      {view === 'menu' ? (
        <div className='divide-y divide-slate-100'>
          <button
            type='button'
            onClick={() => setView('import')}
            disabled={actionsBlocked}
            title={actionsBlocked ? 'Unavailable until Minima is running' : undefined}
            className='flex w-full items-center justify-between gap-3 py-3 pt-0 text-left hover:bg-slate-50 -mx-1 px-1 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
          >
            <div>
              <p className='text-sm font-semibold text-slate-900'>Import wallet</p>
              <p className='text-xs text-slate-500 mt-0.5'>
                Restore from a 24-word seed phrase
              </p>
            </div>
            <ChevronRight size={16} className='text-slate-400 shrink-0' />
          </button>
          <button
            type='button'
            disabled
            title='Export wallet backup — coming soon'
            className='flex w-full items-center justify-between gap-3 py-3 pb-0 text-left opacity-40 cursor-not-allowed'
          >
            <div>
              <p className='text-sm font-semibold text-slate-900'>Export wallet</p>
              <p className='text-xs text-slate-500 mt-0.5'>
                Download a wallet backup — coming soon
              </p>
            </div>
            <ChevronRight size={16} className='text-slate-400 shrink-0' />
          </button>
        </div>
      ) : (
        <div className='grid gap-4'>
          <button
            type='button'
            onClick={goBack}
            className='inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors w-fit'
          >
            <ChevronLeft size={15} />
            Back
          </button>
          <div className='rounded-xl bg-amber-50 border border-amber-200 p-4'>
            <p className='text-sm font-bold text-amber-800'>
              This will replace the current wallet
            </p>
            <p className='text-sm text-amber-700 mt-1'>
              Restoring from a seed phrase overwrites the node's existing wallet.
              The node may restart after import. The phrase is transmitted over
              HTTPS to the local Pi node — only do this on your own network.
            </p>
          </div>
          {result?.ok ? (
            <div className='rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center grid gap-2'>
              <p className='text-lg font-bold text-emerald-700'>Wallet imported</p>
              <p className='text-sm text-emerald-600'>{result.message}</p>
            </div>
          ) : (
            <form onSubmit={handleImport} className='grid gap-4'>
              <label className='grid gap-1.5'>
                <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
                  Seed phrase (12 or 24 words)
                </span>
                <textarea
                  rows={4}
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder='word1 word2 word3 …'
                  autoComplete='off'
                  spellCheck={false}
                  className='rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-slate-400'
                />
              </label>
              {error && (
                <div className='rounded-xl bg-red-50 border border-red-200 p-3'>
                  <p className='text-sm text-red-700'>{error}</p>
                </div>
              )}
              {minimaConfirmedUnavailable && (
                <div className='rounded-xl bg-amber-50 border border-amber-200 p-3'>
                  <p className='text-sm text-amber-800'>Minima isn't running — import is unavailable right now.</p>
                </div>
              )}
              <button
                type='submit'
                disabled={submitting || actionsBlocked}
                className='rounded-xl border-0 bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50'
              >
                {submitting ? 'Importing…' : 'Import wallet'}
              </button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
