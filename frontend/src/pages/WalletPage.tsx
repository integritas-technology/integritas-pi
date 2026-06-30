import { useEffect, useState } from 'react';
import { BookUser, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { Card } from '../components/Card';
import { CopyableCode } from '../components/CopyableCode';
import { MinimaIcon } from '../components/MinimaIcon';
import { Modal } from '../components/Modal';
import { Page } from '../components/Page';
import { useToast } from '../components/ToastProvider';
import {
  createToken as createTokenApi,
  getTokenCreateRequirements,
} from '../features/tokens/tokensApi';
import type { TokenCreateRequirements } from '../features/tokens/tokensTypes';
import { formatAmountAdaptive, formatAmountThreshold } from '../lib/format';
import {
  clearWalletHistoryForDebug,
  getReceiveAddress,
  getWalletStatus,
  importWallet as importWalletApi,
  listWalletSendHistory,
  sendPayment as sendPaymentApi,
} from '../features/wallet/walletApi';
import type {
  ImportWalletResult,
  ReceiveAddress,
  TokenBalance,
  WalletSendHistoryItem,
  WalletStatus,
} from '../features/wallet/walletTypes';
import { AddressBookModal } from '../features/address-book/AddressBookPanel';
import { listAddressBookEntries } from '../features/address-book/addressBookApi';
import type { AddressBookEntry } from '../features/address-book/addressBookTypes';

function isNativeTokenId(tokenId: string): boolean {
  return tokenId.trim().toLowerCase() === '0x00';
}

function compareDecimalStrings(a: string, b: string): number {
  const normalize = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '.') return { int: '0', frac: '' };
    const [intPart = '0', fracPart = ''] = trimmed.split('.');
    return {
      int: intPart.replace(/^0+(?=\d)/, '') || '0',
      frac: fracPart,
    };
  };
  const aNorm = normalize(a);
  const bNorm = normalize(b);
  const fracLen = Math.max(aNorm.frac.length, bNorm.frac.length);
  const aCombined = `${aNorm.int}${aNorm.frac.padEnd(fracLen, '0')}`;
  const bCombined = `${bNorm.int}${bNorm.frac.padEnd(fracLen, '0')}`;
  if (aCombined === bCombined) return 0;
  return BigInt(aCombined) > BigInt(bCombined) ? 1 : -1;
}

function isPositiveDecimal(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return false;
  return compareDecimalStrings(trimmed, '0') > 0;
}

function shortAddress(value: string): string {
  if (value.length <= 18) return value;
  if (value.startsWith('Mx')) return `${value.slice(0, 8)}…${value.slice(-6)}`;
  if (value.startsWith('0x')) return `${value.slice(0, 10)}…${value.slice(-6)}`;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatHistoryFlow(entry: WalletSendHistoryItem): string {
  return `To ${shortAddress(entry.toAddress)}`;
}

function FilledHexTokenIcon({
  size = 13,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      aria-hidden='true'
      className={className}
      fill='currentColor'
    >
      <path d='M12 2.2 20.4 7v10L12 21.8 3.6 17V7L12 2.2Z' />
    </svg>
  );
}

function TokenGlyph({ isNative }: { isNative: boolean }) {
  if (isNative) {
    return <MinimaIcon size={13} className='text-slate-400 shrink-0' />;
  }
  return <FilledHexTokenIcon size={13} className='text-slate-400 shrink-0' />;
}

export function WalletPage() {
  const { showToast } = useToast();
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  const [createTokenOpen, setCreateTokenOpen] = useState(false);
  const [sendHistory, setSendHistory] = useState<WalletSendHistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<WalletSendHistoryItem | null>(null);
  const [debugClearingHistory, setDebugClearingHistory] = useState(false);
  const [assetTab, setAssetTab] = useState<'all' | 'minima' | 'tokens'>('all');
  const [selectedAsset, setSelectedAsset] = useState<TokenBalance | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addressBookOpen, setAddressBookOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [status, history] = await Promise.all([
        getWalletStatus(),
        listWalletSendHistory(20),
      ]);
      setWalletStatus(status);
      setSendHistory(history.sends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const nativeToken = walletStatus?.tokens.find((t) => t.isNative);
  const totalMinima = nativeToken?.sendable ?? '0';
  const isDev = import.meta.env.DEV;

  const allTokens = walletStatus?.tokens ?? [];
  const visibleAssets = allTokens.filter((t) => {
    if (assetTab === 'minima') return t.isNative;
    if (assetTab === 'tokens') return !t.isNative;
    return true;
  });

  async function handleDebugClearWalletHistory() {
    const confirmed = window.confirm(
      'Clear wallet send history from SQLite? This is a dev-only debug action and cannot be undone.',
    );
    if (!confirmed) return;
    setDebugClearingHistory(true);
    try {
      const result = await clearWalletHistoryForDebug();
      await refresh();
      showToast({
        tone: 'success',
        title: 'Wallet history cleared',
        message: `Deleted ${result.deleted} history item(s).`,
      });
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Clear failed',
        message:
          err instanceof Error
            ? err.message
            : 'Could not clear wallet history.',
      });
    } finally {
      setDebugClearingHistory(false);
    }
  }

  return (
    <Page
      eyebrow='Wallet'
      title='Wallet'
      desc='Node wallet balance and transaction history.'
      action={
        <div className='flex items-center gap-1'>
          <button
            type='button'
            className='section-action-button'
            onClick={() => setAddressBookOpen(true)}
            aria-label='Address book'
          >
            <BookUser size={20} />
          </button>
          <button
            type='button'
            className='section-action-button'
            onClick={() => setSettingsOpen(true)}
            aria-label='Wallet settings'
          >
            <Settings size={20} />
          </button>
        </div>
      }
    >
      <div className='hero-card wallet-balance-card'>
        <div className='wallet-hero-top'>
          <div className='wallet-hero-header'>
            <div className='wallet-hero-icon'>
              <MinimaIcon size={18} />
            </div>
            <p className='eyebrow'>Node wallet</p>
          </div>
          <div className='wallet-hero-actions'>
            <button
              type='button'
              className='wallet-action-btn wallet-action-btn-ghost'
              onClick={() => setReceiveOpen(true)}
            >
              Receive payment
            </button>
            <button
              type='button'
              className='wallet-action-btn wallet-action-btn-ghost'
              onClick={() => setSendOpen(true)}
            >
              Send payment
            </button>
            <button
              type='button'
              className='wallet-action-btn wallet-action-btn-ghost'
              onClick={() => setCreateTokenOpen(true)}
            >
              Create token
            </button>
          </div>
        </div>
        <div>
          <p className='wallet-amount-label'>Total sendable MINIMA</p>
          <div className='wallet-amount-row'>
            <MinimaIcon size={36} className='wallet-amount-icon' />
            <span
              className='wallet-amount-number'
              title={loading ? undefined : totalMinima}
            >
              {loading ? '…' : formatAmountThreshold(totalMinima)}
            </span>
          </div>
        </div>
      </div>

      <Card>
        <div className='flex items-center justify-between gap-3 mb-4'>
          <p className='eyebrow'>Assets</p>
          <div className='flex gap-1 rounded-lg bg-slate-100 p-0.5'>
            {(['all', 'minima', 'tokens'] as const).map((tab) => (
              <button
                key={tab}
                type='button'
                onClick={() => setAssetTab(tab)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                  assetTab === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'all' ? 'All' : tab === 'minima' ? 'Minima' : 'Tokens'}
              </button>
            ))}
          </div>
        </div>
        {loading && <p className='muted'>Loading…</p>}
        {!loading && visibleAssets.length === 0 && (
          <p className='muted'>
            {assetTab === 'tokens'
              ? 'No custom tokens in wallet.'
              : 'No assets found.'}
          </p>
        )}
        <div className='divide-y divide-slate-100'>
          {visibleAssets.map((token) => (
            <button
              key={token.tokenId}
              type='button'
              onClick={() => setSelectedAsset(token)}
              className='w-full flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-left hover:bg-slate-50 -mx-1 px-1 rounded-lg transition-colors'
            >
              <div className='min-w-0'>
                <p className='text-sm font-semibold text-slate-900 truncate'>
                  {token.name}
                </p>
                <p className='text-xs text-slate-400 font-mono truncate'>
                  {token.tokenId}
                </p>
              </div>
              <div className='shrink-0 text-right'>
                <p className='text-sm font-bold text-slate-900 tabular-nums inline-flex items-center gap-1.5'>
                  <TokenGlyph isNative={token.isNative} />
                  {formatAmountThreshold(token.sendable)}
                </p>
                <p className='text-xs text-slate-400'>sendable</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className='flex items-center justify-between gap-3 mb-4'>
          <p className='eyebrow'>History</p>
          <div className='flex items-center gap-3'>
            <p className='text-xs text-slate-500'>Sent</p>
            <button
              type='button'
              className='btn btn-secondary'
              onClick={refresh}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
        {loading && <p className='muted'>Loading…</p>}
        {error && <p className='error-text'>{error}</p>}
        {!loading && !error && sendHistory.length === 0 && (
          <p className='muted'>No send activity yet.</p>
        )}
        <div className='grid gap-2'>
          {sendHistory.map((entry) => (
            <button
              key={entry.id}
              type='button'
              onClick={() => setSelectedHistoryItem(entry)}
              className='w-full text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-400 transition'
            >
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='text-sm font-semibold text-slate-900 inline-flex items-center gap-1.5'>
                    <TokenGlyph isNative={isNativeTokenId(entry.tokenId)} />
                    {entry.amount} {entry.tokenName}
                  </p>
                  <p className='text-xs text-slate-500 mt-1'>
                    {formatHistoryFlow(entry)}
                  </p>
                  <p className='text-xs text-slate-400 mt-1'>
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                  {entry.status}
                </span>
              </div>
            </button>
          ))}
        </div>
        {isDev && (
          <div className='mt-4 flex justify-start'>
            <button
              type='button'
              className='btn btn-secondary'
              onClick={handleDebugClearWalletHistory}
              disabled={debugClearingHistory}
              title='Dev-only: clears wallet_send_history table'
            >
              {debugClearingHistory ? 'Clearing…' : 'Debug: clear history'}
            </button>
          </div>
        )}
      </Card>

      {addressBookOpen && (
        <AddressBookModal onClose={() => setAddressBookOpen(false)} />
      )}
      {settingsOpen && (
        <WalletSettingsModal
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {selectedAsset && (
        <AssetDetailModal
          token={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
      {selectedHistoryItem && (
        <HistoryDetailModal
          item={selectedHistoryItem}
          onClose={() => setSelectedHistoryItem(null)}
        />
      )}
      {receiveOpen && (
        <ReceiveAddressModal onClose={() => setReceiveOpen(false)} />
      )}
      {sendOpen && (
        <SendPaymentModal
          walletStatus={walletStatus}
          onClose={() => setSendOpen(false)}
        />
      )}

      {createTokenOpen && (
        <CreateTokenModal
          walletStatus={walletStatus}
          onClose={() => setCreateTokenOpen(false)}
          onCreated={refresh}
        />
      )}
    </Page>
  );
}

function WalletSettingsModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
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
    <Modal title='Wallet settings' onClose={onClose}>
      {view === 'menu' ? (
        <div className='divide-y divide-slate-100'>
          <button
            type='button'
            onClick={() => setView('import')}
            className='flex w-full items-center justify-between gap-3 py-3 pt-0 text-left hover:bg-slate-50 -mx-1 px-1 rounded-lg transition-colors'
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
              <button
                type='submit'
                disabled={submitting}
                className='rounded-xl border-0 bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50'
              >
                {submitting ? 'Importing…' : 'Import wallet'}
              </button>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}

function AssetDetailModal({
  token,
  onClose,
}: {
  token: TokenBalance;
  onClose: () => void;
}) {
  return (
    <Modal title={token.name} onClose={onClose}>
      <div className='grid gap-4'>
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Token ID
          </p>
          <CopyableCode value={token.tokenId} />
        </div>
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Sendable
          </p>
          <p className='text-lg font-semibold text-slate-900 tabular-nums inline-flex items-center gap-2'>
            <TokenGlyph isNative={token.isNative} />
            {formatAmountAdaptive(token.sendable)}
          </p>
        </div>
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Confirmed
          </p>
          <p className='text-sm font-medium text-slate-900 tabular-nums'>
            {formatAmountAdaptive(token.confirmed)}
          </p>
        </div>
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Unconfirmed
          </p>
          <p className='text-sm font-medium text-slate-500 tabular-nums'>
            {formatAmountAdaptive(token.unconfirmed)}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function ReceiveAddressModal({ onClose }: { onClose: () => void }) {
  const [address, setAddress] = useState<ReceiveAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReceiveAddress()
      .then(setAddress)
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'Could not fetch address.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <Modal title='Receive funds' onClose={onClose}>
      <div className='grid gap-4'>
        <p className='text-sm text-slate-500'>
          Share an address below to receive MINIMA or tokens. All addresses
          belong to this wallet.
        </p>
        {loading && <p className='muted'>Fetching address…</p>}
        {error && (
          <div className='rounded-xl bg-red-50 border border-red-200 p-3'>
            <p className='text-sm text-red-700'>{error}</p>
          </div>
        )}
        {address && (
          <>
            <div className='grid gap-1'>
              <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
                Minima address
              </p>
              <CopyableCode value={address.miniAddress} />
            </div>
            <div className='grid gap-1'>
              <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
                Hex address
              </p>
              <CopyableCode value={address.address} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function SendPaymentModal({
  walletStatus,
  onClose,
}: {
  walletStatus: WalletStatus | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenId, setTokenId] = useState('0x00');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contacts, setContacts] = useState<AddressBookEntry[]>([]);

  useEffect(() => {
    listAddressBookEntries().then(setContacts).catch(() => {});
  }, []);

  const tokens = walletStatus?.tokens ?? [];
  const tokenOptions = tokens.map((token) => ({
    value: token.tokenId,
    label: token.isNative ? 'Minima (native)' : token.name,
  }));
  const selectedToken = tokens.find((t) => t.tokenId === tokenId);
  const availableSendable = selectedToken?.sendable ?? '0';
  const availableLabel = selectedToken
    ? selectedToken.isNative
      ? 'Minima'
      : selectedToken.name
    : null;

  const exceedsBalance = Boolean(
    selectedToken &&
    isPositiveDecimal(amount) &&
    compareDecimalStrings(amount.trim(), availableSendable) > 0,
  );
  const canSubmit = !exceedsBalance && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!address.trim()) {
      setFormError('Address is required.');
      return;
    }
    const num = Number(amount);
    if (!amount || !Number.isFinite(num) || num <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }
    if (exceedsBalance) {
      setFormError(
        `Amount exceeds available balance (${availableSendable} ${availableLabel}).`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await sendPaymentApi({
        address: address.trim(),
        amount: amount.trim(),
        tokenId,
        tokenName:
          tokenId === '0x00'
            ? 'Minima'
            : (tokenOptions.find((opt) => opt.value === tokenId)?.label ??
              tokenId),
      });
      if (!result.ok || result.status === 'failed') {
        setFormError(result.message ?? 'Send failed.');
        return;
      }
      showToast({
        tone: 'success',
        title: 'Payment sent',
        message: result.txpowId
          ? `Transaction submitted: ${result.txpowId.slice(0, 16)}…`
          : undefined,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Send failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title='Send payment' onClose={onClose}>
      <form onSubmit={handleSubmit} className='grid gap-4'>
        <div className='grid gap-1.5'>
          <div className='flex items-center justify-between gap-3'>
            <label
              htmlFor='send-address'
              className='text-xs font-bold uppercase tracking-widest text-slate-500'
            >
              Recipient address
            </label>
            {contacts.length > 0 && (
              <button
                type='button'
                className='text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors'
                onClick={() => setPickerOpen((v) => !v)}
              >
                {pickerOpen ? 'Close' : 'Address book'}
              </button>
            )}
          </div>
          <input
            id='send-address'
            type='text'
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setPickerOpen(false);
            }}
            placeholder='Mx… or 0x…'
            autoComplete='off'
            spellCheck={false}
          />
          {pickerOpen && (
            <div className='rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 max-h-48 overflow-y-auto'>
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  type='button'
                  onClick={() => {
                    setAddress(contact.address);
                    setPickerOpen(false);
                  }}
                  className='w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors first:rounded-t-xl last:rounded-b-xl'
                >
                  <span className='text-sm font-semibold text-slate-900'>
                    {contact.label}
                  </span>
                  <span className='text-xs text-slate-400 font-mono'>
                    {shortAddress(contact.address)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <label className='grid gap-1.5'>
          <span className='flex items-center justify-between gap-3'>
            <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
              Token
            </span>
            {selectedToken && (
              <span className='text-xs font-medium text-slate-600'>
                {availableSendable} {availableLabel} sendable
              </span>
            )}
          </span>
          <select
            value={tokenId}
            onChange={(e) => {
              setTokenId(e.target.value);
              setFormError(null);
            }}
          >
            {tokenOptions.length > 0 ? (
              tokenOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            ) : (
              <option value='0x00'>Minima (native)</option>
            )}
          </select>
        </label>

        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Amount
          </span>
          <input
            type='text'
            inputMode='decimal'
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setFormError(null);
            }}
            placeholder='0.00'
          />
        </label>

        {exceedsBalance && selectedToken && (
          <div className='rounded-xl bg-amber-50 border border-amber-200 p-3'>
            <p className='text-sm text-amber-800'>
              Amount exceeds available balance ({availableSendable}{' '}
              {availableLabel}).
            </p>
          </div>
        )}

        {formError && (
          <div className='rounded-xl bg-red-50 border border-red-200 p-3'>
            <p className='text-sm text-red-700'>{formError}</p>
          </div>
        )}

        <button
          type='submit'
          disabled={!canSubmit}
          className='rounded-xl border-0 bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50'
        >
          {submitting ? 'Sending…' : 'Send payment'}
        </button>
      </form>
    </Modal>
  );
}

function CreateTokenModal({
  walletStatus,
  onClose,
  onCreated,
}: {
  walletStatus: WalletStatus | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [requirements, setRequirements] =
    useState<TokenCreateRequirements | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [decimal, setDecimal] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getTokenCreateRequirements()
      .then(setRequirements)
      .catch(() => {
        setRequirements({
          estimatedMinimaCost: '0.001',
          minimumAccountMinima: '0.001',
          note: '',
        });
      });
  }, []);

  const minimumBalance = requirements?.minimumAccountMinima ?? '0.001';
  const nativeToken = walletStatus?.tokens.find((t) => t.isNative);
  const availableMinima = nativeToken?.sendable ?? '0';
  const hasSufficientMinima =
    compareDecimalStrings(availableMinima, minimumBalance) >= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedAmount = amount.trim();
    const parsedDecimal = Number(decimal);

    if (!hasSufficientMinima) {
      setError(
        `Wallet needs at least ${minimumBalance} sendable MINIMA to create a token.`,
      );
      return;
    }
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    if (!isPositiveDecimal(trimmedAmount)) {
      setError('Amount must be a positive number.');
      return;
    }
    if (!Number.isInteger(parsedDecimal) || parsedDecimal < 0) {
      setError('Decimal must be a non-negative whole number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createTokenApi({
        name: trimmedName,
        amount: trimmedAmount,
        decimal: parsedDecimal,
      });
      if (res.ok) {
        await onCreated();
        showToast({
          tone: 'success',
          title: 'Token created',
          message: res.tokenId
            ? `${res.name} (${res.tokenId})`
            : (res.message ?? 'Custom token created.'),
        });
        onClose();
      } else {
        setError(res.message ?? 'Token creation failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token creation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCloseRequest() {
    if (submitting) return;
    onClose();
  }

  return (
    <Modal title='Create custom token' onClose={handleCloseRequest}>
      <form onSubmit={handleSubmit} className='grid gap-4'>
        <p className='text-sm text-slate-500'>
          Wallet MINIMA:{' '}
          <span
            className={hasSufficientMinima ? 'text-slate-900' : 'text-red-700'}
          >
            {formatAmountAdaptive(availableMinima)} sendable
          </span>{' '}
          (minimum: {minimumBalance})
        </p>
        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Name
          </span>
          <input
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. Device access'
            maxLength={80}
          />
        </label>
        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Amount (supply)
          </span>
          <input
            type='text'
            inputMode='decimal'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder='e.g. 1000'
          />
        </label>
        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Decimal places
          </span>
          <input
            type='number'
            min={0}
            step={1}
            value={decimal}
            onChange={(e) => setDecimal(e.target.value)}
          />
        </label>
        {error && (
          <div className='rounded-xl bg-red-50 border border-red-200 p-3'>
            <p className='text-sm text-red-700'>{error}</p>
          </div>
        )}
        {submitting && (
          <p className='text-sm text-slate-500'>
            Creating token on the node… this may take up to a minute.
          </p>
        )}
        <button
          type='submit'
          disabled={submitting || !hasSufficientMinima}
          className='rounded-xl border-0 bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50'
        >
          {submitting ? 'Creating…' : 'Create token'}
        </button>
      </form>
    </Modal>
  );
}


function HistoryDetailModal({
  item,
  onClose,
}: {
  item: WalletSendHistoryItem;
  onClose: () => void;
}) {
  return (
    <Modal title='History item details' onClose={onClose}>
      <div className='grid gap-4'>
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Amount
          </p>
          <p className='text-lg font-semibold text-slate-900 inline-flex items-center gap-2'>
            <TokenGlyph isNative={isNativeTokenId(item.tokenId)} />
            {item.amount} {item.tokenName}
          </p>
        </div>
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Status
          </p>
          <p className='text-sm font-medium text-slate-900 capitalize'>
            {item.status}
          </p>
        </div>
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            To
          </p>
          <CopyableCode value={item.toAddress} />
        </div>
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Token ID
          </p>
          <CopyableCode value={item.tokenId} />
        </div>
        {item.txpowId && (
          <div className='grid gap-1'>
            <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
              TxPow ID
            </p>
            <CopyableCode value={item.txpowId} />
          </div>
        )}
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Created
          </p>
          <p className='text-sm text-slate-900'>
            {new Date(item.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </Modal>
  );
}
