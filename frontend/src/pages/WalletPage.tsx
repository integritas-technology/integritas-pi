import { useEffect, useRef, useState } from 'react';
import { BookUser, Loader2 } from 'lucide-react';
import type { MinimaNodeState } from '../app/types';
import { Button, IconButton } from '../components/Button';
import { Card } from '../components/Card';
import { CopyableCode } from '../components/CopyableCode';
import { DarkHeroCard } from '../components/DarkHeroCard';
import { LoadingDots } from '../components/LoadingDots';
import { MinimaIcon } from '../components/MinimaIcon';
import { Modal } from '../components/Modal';
import { Page } from '../components/Page';
import { SubTabs } from '../components/SubTabs';
import { ErrorText, Eyebrow, MutedText } from '../components/Text';
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
  listWalletSendHistory,
  sendPayment as sendPaymentApi,
} from '../features/wallet/walletApi';
import type {
  ReceiveAddress,
  TokenBalance,
  WalletSendHistoryItem,
  WalletStatus,
} from '../features/wallet/walletTypes';
import { AddressBookModal } from '../features/address-book/AddressBookPanel';
import { listAddressBookEntries } from '../features/address-book/addressBookApi';
import type { AddressBookEntry } from '../features/address-book/addressBookTypes';
import { useMinimaStatusRefresh } from '../features/minima/useMinimaStatusRefresh';

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

const walletListClass = 'grid gap-2';
const walletListRowClass = 'w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 hover:bg-slate-50';

function WalletHero({
  loading,
  totalMinima,
  disabled,
  onReceive,
  onSend,
  onCreateToken,
}: {
  loading: boolean;
  totalMinima: string;
  disabled: boolean;
  onReceive: () => void;
  onSend: () => void;
  onCreateToken: () => void;
}) {
  return (
    <DarkHeroCard>
      <div className='relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-center gap-3'>
          <div className='grid size-[38px] place-items-center rounded-[14px] bg-white/10'>
            <MinimaIcon size={18} />
          </div>
          <Eyebrow className='text-slate-400'>Node wallet</Eyebrow>
        </div>
        <div className='flex flex-wrap justify-start gap-2 sm:justify-end'>
          <Button type='button' variant='onDark' onClick={onReceive} disabled={disabled}>
            Receive payment
          </Button>
          <Button type='button' variant='onDark' onClick={onSend} disabled={disabled}>
            Send payment
          </Button>
          <Button type='button' variant='onDark' onClick={onCreateToken} disabled={disabled}>
            Create token
          </Button>
        </div>
      </div>
      <div className='relative z-10'>
        <p className='m-0 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400'>Total sendable MINIMA</p>
        <div className='mt-2 flex min-w-0 items-start gap-4 text-[clamp(2.5rem,6vw,3.5rem)]'>
          <MinimaIcon size={36} className='mt-[calc((1.1em-36px)/2)] shrink-0 opacity-55' />
          <span
            className='min-w-0 break-all text-[clamp(2.5rem,6vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.04em]'
            title={loading || disabled ? undefined : totalMinima}
          >
            {loading || disabled ? <LoadingDots className='scale-125' /> : formatAmountThreshold(totalMinima)}
          </span>
        </div>
      </div>
    </DarkHeroCard>
  );
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
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [mainTab, setMainTab] = useState<'assets' | 'history'>('assets');
  const [minimaState, setMinimaState] = useState<MinimaNodeState | null>(null);
  const previousMinimaStateRef = useRef<MinimaNodeState | null>(null);

  useMinimaStatusRefresh(
    (status) => {
      const previous = previousMinimaStateRef.current;
      previousMinimaStateRef.current = status.state;
      setMinimaState(status.state);
      // Wallet data was fetched once on mount and goes stale/wrong the moment the
      // node drops out from under it (restart/resync) — reload it once the node
      // is confirmed running again instead of leaving the page stuck on whatever
      // it last managed to load until the user navigates away and back.
      if (previous !== null && previous !== 'running' && status.state === 'running') {
        refresh();
      }
    },
    () => {}
  );
  // Only allow wallet actions once Minima is confirmed running — any other state
  // (loading, stopped, error, restarting) means an RPC call would just fail. Buttons
  // stay disabled during the initial "haven't checked yet" window too, but the warning
  // banner itself only appears once we've actually confirmed the node isn't running —
  // otherwise it flashes "unavailable" for a node that's actually fine.
  const actionsBlocked = minimaState !== 'running';
  const minimaConfirmedUnavailable = minimaState !== null && minimaState !== 'running';

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
        <IconButton
          variant='primary'
          onClick={() => setAddressBookOpen(true)}
          aria-label='Address book'
        >
          <BookUser size={20} />
        </IconButton>
      }
    >
      {minimaConfirmedUnavailable && (
        <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
          Wallet actions are unavailable until Minima is running.
        </div>
      )}

      <WalletHero
        loading={loading}
        totalMinima={totalMinima}
        disabled={actionsBlocked}
        onReceive={() => setReceiveOpen(true)}
        onSend={() => setSendOpen(true)}
        onCreateToken={() => setCreateTokenOpen(true)}
      />

      <SubTabs
        label='Wallet sections'
        value={mainTab}
        options={[{ value: 'assets', label: 'Assets' }, { value: 'history', label: 'History' }]}
        onChange={setMainTab}
      />

      <Card>
        {mainTab === 'assets' ? (
          <>
            <div className='flex items-center justify-between gap-3 mb-4'>
              <Eyebrow>Assets</Eyebrow>
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
            {loading || actionsBlocked ? (
              <div className='flex justify-center py-10'>
                <Loader2 className='size-10 animate-spin text-slate-400' aria-hidden='true' />
              </div>
            ) : visibleAssets.length === 0 ? (
              <MutedText>
                {assetTab === 'tokens'
                  ? 'No custom tokens in wallet.'
                  : 'No assets found.'}
              </MutedText>
            ) : (
              <div className={walletListClass}>
                {visibleAssets.map((token) => (
                  <button
                    key={token.tokenId}
                    type='button'
                    onClick={() => setSelectedAsset(token)}
                    className={walletListRowClass}
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-slate-900'>
                          {token.name}
                        </p>
                        <p className='truncate font-mono text-xs text-slate-400'>
                          {token.tokenId}
                        </p>
                      </div>
                      <div className='shrink-0 text-right'>
                        <p className='inline-flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-900'>
                          <TokenGlyph isNative={token.isNative} />
                          {formatAmountThreshold(token.sendable)}
                        </p>
                        <p className='text-xs text-slate-400'>sendable</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className='flex items-center justify-between gap-3 mb-4'>
              <Eyebrow>History</Eyebrow>
              <div className='flex items-center gap-3'>
                <p className='text-xs text-slate-500'>Sent</p>
                <Button
                  type='button'
                  variant='secondary'
                  className='rounded-xl px-3 py-2 text-xs'
                  onClick={refresh}
                  disabled={loading || actionsBlocked}
                >
                  Refresh
                </Button>
              </div>
            </div>
            {loading || actionsBlocked ? (
              <div className='flex justify-center py-10'>
                <Loader2 className='size-10 animate-spin text-slate-400' aria-hidden='true' />
              </div>
            ) : error ? (
              <ErrorText>{error}</ErrorText>
            ) : sendHistory.length === 0 ? (
              <MutedText>No send activity yet.</MutedText>
            ) : (
              <div className={walletListClass}>
                {sendHistory.map((entry) => (
                  <button
                    key={entry.id}
                    type='button'
                    onClick={() => setSelectedHistoryItem(entry)}
                    className={walletListRowClass}
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
            )}
            {isDev && (
              <div className='mt-4 flex justify-start'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={handleDebugClearWalletHistory}
                  disabled={debugClearingHistory}
                  title='Dev-only: clears wallet_send_history table'
                >
                  {debugClearingHistory ? 'Clearing…' : 'Debug: clear history'}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {addressBookOpen && (
        <AddressBookModal onClose={() => setAddressBookOpen(false)} />
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
          actionsBlocked={actionsBlocked}
          minimaConfirmedUnavailable={minimaConfirmedUnavailable}
          onClose={() => setSendOpen(false)}
        />
      )}

      {createTokenOpen && (
        <CreateTokenModal
          walletStatus={walletStatus}
          actionsBlocked={actionsBlocked}
          minimaConfirmedUnavailable={minimaConfirmedUnavailable}
          onClose={() => setCreateTokenOpen(false)}
          onCreated={refresh}
        />
      )}
    </Page>
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
        {loading && <MutedText>Fetching address…</MutedText>}
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
  actionsBlocked,
  minimaConfirmedUnavailable,
  onClose,
}: {
  walletStatus: WalletStatus | null;
  actionsBlocked: boolean;
  minimaConfirmedUnavailable: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenId, setTokenId] = useState('0x00');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [addressMode, setAddressMode] = useState<'external' | 'address-book'>('external');
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
  const canSubmit = !exceedsBalance && !submitting && !actionsBlocked;

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
            <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
              Recipient address
            </span>
            <div className='flex gap-1 rounded-lg bg-slate-100 p-0.5'>
              {(['external', 'address-book'] as const).map((mode) => (
                <button
                  key={mode}
                  type='button'
                  onClick={() => {
                    setAddressMode(mode);
                    setAddress('');
                    setFormError(null);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    addressMode === mode
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {mode === 'external' ? 'External' : 'Address book'}
                </button>
              ))}
            </div>
          </div>
          {addressMode === 'external' ? (
            <input
              id='send-address'
              type='text'
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder='Mx… or 0x…'
              autoComplete='off'
              spellCheck={false}
            />
          ) : contacts.length === 0 ? (
            <p className='text-sm text-slate-500'>No contacts saved in address book.</p>
          ) : (
            <select
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            >
              <option value=''>Select a contact…</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.address}>
                  {contact.label}
                </option>
              ))}
            </select>
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

        {minimaConfirmedUnavailable && (
          <div className='rounded-xl bg-amber-50 border border-amber-200 p-3'>
            <p className='text-sm text-amber-800'>Minima isn't running — sending is unavailable right now.</p>
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
  actionsBlocked,
  minimaConfirmedUnavailable,
  onClose,
  onCreated,
}: {
  walletStatus: WalletStatus | null;
  actionsBlocked: boolean;
  minimaConfirmedUnavailable: boolean;
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
        {minimaConfirmedUnavailable && (
          <div className='rounded-xl bg-amber-50 border border-amber-200 p-3'>
            <p className='text-sm text-amber-800'>Minima isn't running — token creation is unavailable right now.</p>
          </div>
        )}
        <button
          type='submit'
          disabled={submitting || !hasSufficientMinima || actionsBlocked}
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
