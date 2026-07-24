import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, Loader2 } from 'lucide-react';
import type { MinimaNodeState } from '../app/types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CopyableCode } from '../components/CopyableCode';
import {
  DataTable,
  RowActions,
  TableIconButton,
  TableWrap,
  tableCellClass,
  tableHeaderCellClass,
  tableHeadRowClass,
  tableRowClass,
} from '../components/DataTable';
import { DarkHeroCard } from '../components/DarkHeroCard';
import { ListPagerFilterBar } from '../components/ListPagerFilterBar';
import { LoadingDots } from '../components/LoadingDots';
import { MinimaIcon } from '../components/MinimaIcon';
import { Modal } from '../components/Modal';
import { Page } from '../components/Page';
import { SubTabs } from '../components/SubTabs';
import { TablePager } from '../components/TablePager';
import { ErrorText, Eyebrow, MutedText } from '../components/Text';
import { useToast } from '../components/ToastProvider';
import { DEFAULT_PAGE_SIZE_OPTIONS } from '../lib/paginated';
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
import { AddressBookPanel } from '../features/address-book/AddressBookPanel';
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

const ASSET_KIND_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'minima', label: 'Minima' },
  { value: 'tokens', label: 'Tokens' },
] as const;

const HISTORY_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'failed', label: 'Failed' },
] as const;

const fieldLabelClass = 'text-xs font-bold uppercase tracking-widest text-slate-500';
const inputClass =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-55';

const RECEIVE_QR_REFRESH_MS = 3 * 60 * 1000;

function ReceiveQrPanel({ disabled }: { disabled: boolean }) {
  const [address, setAddress] = useState<ReceiveAddress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(() => {
    getReceiveAddress()
      .then((result) => {
        setAddress(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not fetch address.'),
      );
  }, []);

  useEffect(() => {
    if (disabled) return;
    refresh();
    let interval: number | undefined;
    function startInterval() {
      interval = window.setInterval(refresh, RECEIVE_QR_REFRESH_MS);
    }
    function stopInterval() {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refresh();
        startInterval();
      } else {
        stopInterval();
      }
    }
    startInterval();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [disabled, refresh]);

  async function handleCopy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address.miniAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures in non-secure contexts
    }
  }

  return (
    <div className='flex h-full flex-col items-center gap-2'>
      <button
        type='button'
        onClick={handleCopy}
        disabled={!address || disabled}
        aria-label={copied ? 'Copied' : 'Copy Mx address'}
        className='flex h-full w-40 flex-col overflow-hidden rounded-md bg-white text-slate-950 shadow-sm transition-colors enabled:hover:bg-slate-50 disabled:opacity-55'
      >
        <div className='flex flex-1 items-center justify-center p-2'>
          <div className='grid size-32 shrink-0 place-items-center'>
            {address ? (
              <img src={address.qrDataUrl} alt='Wallet receive address QR code' className='size-full' />
            ) : (
              <LoadingDots />
            )}
          </div>
        </div>
        <div className='flex w-full items-center justify-center gap-2 border-t border-slate-200 px-3 py-2.5 text-sm font-bold whitespace-nowrap'>
          <span className='grid shrink-0 place-items-center'>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </span>
          {copied ? 'Copied' : 'Copy address'}
        </div>
      </button>
      {error && <p className='m-0 max-w-35 text-center text-xs text-red-400'>{error}</p>}
    </div>
  );
}

function WalletHero({
  loading,
  totalMinima,
  disabled,
}: {
  loading: boolean;
  totalMinima: string;
  disabled: boolean;
}) {
  return (
    <DarkHeroCard rounded='rounded-md' padding='p-5'>
      <div className='relative z-10 flex flex-col gap-6 sm:flex-row sm:items-stretch sm:justify-between'>
        <div className='flex min-w-0 flex-col justify-end gap-4'>
          <div className='flex items-center gap-3'>
            <div className='grid size-[38px] place-items-center rounded-[14px] bg-white/10'>
              <MinimaIcon size={18} />
            </div>
            <Eyebrow className='text-slate-400'>Primary wallet</Eyebrow>
          </div>
          <div>
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
        </div>
        <ReceiveQrPanel disabled={disabled} />
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
  const [assetKind, setAssetKind] = useState('');
  const [assetQuery, setAssetQuery] = useState('');
  const [assetPage, setAssetPage] = useState(1);
  const [assetPageSize, setAssetPageSize] = useState<number>(DEFAULT_PAGE_SIZE_OPTIONS[0]);
  const [selectedAsset, setSelectedAsset] = useState<TokenBalance | null>(null);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(DEFAULT_PAGE_SIZE_OPTIONS[0]);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [mainTab, setMainTab] = useState<'assets' | 'address-book' | 'history'>('assets');
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
  const trimmedAssetQuery = assetQuery.trim().toLowerCase();
  const visibleAssets = allTokens.filter((t) => {
    if (assetKind === 'minima' && !t.isNative) return false;
    if (assetKind === 'tokens' && t.isNative) return false;
    if (!trimmedAssetQuery) return true;
    return (
      t.name.toLowerCase().includes(trimmedAssetQuery) ||
      t.tokenId.toLowerCase().includes(trimmedAssetQuery)
    );
  });
  const assetTotalPages = Math.max(1, Math.ceil(visibleAssets.length / assetPageSize));
  const assetCurrentPage = Math.min(assetPage, assetTotalPages);
  const pagedAssets = visibleAssets.slice(
    (assetCurrentPage - 1) * assetPageSize,
    assetCurrentPage * assetPageSize,
  );

  const trimmedHistoryQuery = historyQuery.trim().toLowerCase();
  const filteredHistory = sendHistory.filter((entry) => {
    if (historyStatus && entry.status !== historyStatus) return false;
    if (!trimmedHistoryQuery) return true;
    return (
      entry.toAddress.toLowerCase().includes(trimmedHistoryQuery) ||
      entry.tokenName.toLowerCase().includes(trimmedHistoryQuery) ||
      (entry.txpowId ?? '').toLowerCase().includes(trimmedHistoryQuery)
    );
  });
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const pagedHistory = filteredHistory.slice(
    (historyCurrentPage - 1) * historyPageSize,
    historyCurrentPage * historyPageSize,
  );

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
      />

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <SubTabs
          label='Wallet sections'
          value={mainTab}
          options={[
            { value: 'assets', label: 'Assets' },
            { value: 'address-book', label: 'Address book' },
            { value: 'history', label: 'History' },
          ]}
          onChange={setMainTab}
        />
        <div className='flex flex-wrap gap-2'>
          <Button type='button' variant='secondary' onClick={() => setSendOpen(true)} disabled={actionsBlocked}>
            Send payment
          </Button>
          <Button type='button' variant='secondary' onClick={() => setCreateTokenOpen(true)} disabled={actionsBlocked}>
            Create token
          </Button>
        </div>
      </div>

      <Card>
        {mainTab === 'assets' ? (
          <>
            <Eyebrow className='mb-4'>Assets</Eyebrow>
            <ListPagerFilterBar
              page={assetCurrentPage}
              pageSize={assetPageSize}
              total={visibleAssets.length}
              totalPages={assetTotalPages}
              status={assetKind}
              q={assetQuery}
              statusOptions={ASSET_KIND_OPTIONS}
              statusLabel='Kind'
              searchPlaceholder='Name or coin ID'
              disabled={loading || actionsBlocked}
              onPageChange={setAssetPage}
              onPageSizeChange={(size) => {
                setAssetPageSize(size);
                setAssetPage(1);
              }}
              onStatusChange={(kind) => {
                setAssetKind(kind);
                setAssetPage(1);
              }}
              onQueryChange={(q) => {
                setAssetQuery(q);
                setAssetPage(1);
              }}
            />
            {loading || actionsBlocked ? (
              <div className='flex justify-center py-10'>
                <Loader2 className='size-10 animate-spin text-slate-400' aria-hidden='true' />
              </div>
            ) : visibleAssets.length === 0 ? (
              <MutedText>
                {assetKind || trimmedAssetQuery
                  ? 'No matching assets.'
                  : 'No assets found.'}
              </MutedText>
            ) : (
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr className={tableHeadRowClass}>
                      <th className={`${tableHeaderCellClass} min-w-48`}>Name</th>
                      <th className={tableHeaderCellClass}>Amount</th>
                      <th className={`${tableHeaderCellClass} w-px whitespace-nowrap`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAssets.map((token) => (
                      <tr key={token.tokenId} className={tableRowClass}>
                        <td className={`${tableCellClass} min-w-48`}>
                          <span className='inline-flex items-center gap-1.5 font-semibold text-slate-900'>
                            <TokenGlyph isNative={token.isNative} />
                            {token.name}
                          </span>
                        </td>
                        <td className={tableCellClass}>
                          <span className='inline-flex items-center gap-1.5 font-mono text-sm tabular-nums text-slate-700'>
                            <TokenGlyph isNative={token.isNative} />
                            {formatAmountAdaptive(token.sendable)}
                          </span>
                        </td>
                        <td className={`${tableCellClass} w-px whitespace-nowrap`}>
                          <RowActions wrap={false}>
                            <TableIconButton
                              type='button'
                              title='View details'
                              aria-label={`View ${token.name}`}
                              onClick={() => setSelectedAsset(token)}
                            >
                              <Eye size={16} />
                            </TableIconButton>
                          </RowActions>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            )}
            <div className='mt-3'>
              <TablePager
                page={assetCurrentPage}
                pageSize={assetPageSize}
                total={visibleAssets.length}
                totalPages={assetTotalPages}
                disabled={loading || actionsBlocked}
                onPageChange={setAssetPage}
                onPageSizeChange={(size) => {
                  setAssetPageSize(size);
                  setAssetPage(1);
                }}
              />
            </div>
          </>
        ) : mainTab === 'address-book' ? (
          <>
            <div className='flex items-center justify-between gap-3 mb-4'>
              <Eyebrow>Address book</Eyebrow>
              <Button
                type='button'
                variant='secondary'
                onClick={() => setAddContactOpen(true)}
                disabled={actionsBlocked}
              >
                Add contact
              </Button>
            </div>
            <AddressBookPanel
              actionsBlocked={actionsBlocked}
              addOpen={addContactOpen}
              onCloseAdd={() => setAddContactOpen(false)}
            />
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
            <ListPagerFilterBar
              page={historyCurrentPage}
              pageSize={historyPageSize}
              total={filteredHistory.length}
              totalPages={historyTotalPages}
              status={historyStatus}
              q={historyQuery}
              statusOptions={HISTORY_STATUS_OPTIONS}
              statusLabel='Status'
              searchPlaceholder='Address, token, or txpow ID'
              disabled={loading || actionsBlocked}
              onPageChange={setHistoryPage}
              onPageSizeChange={(size) => {
                setHistoryPageSize(size);
                setHistoryPage(1);
              }}
              onStatusChange={(status) => {
                setHistoryStatus(status);
                setHistoryPage(1);
              }}
              onQueryChange={(q) => {
                setHistoryQuery(q);
                setHistoryPage(1);
              }}
            />
            {loading || actionsBlocked ? (
              <div className='flex justify-center py-10'>
                <Loader2 className='size-10 animate-spin text-slate-400' aria-hidden='true' />
              </div>
            ) : error ? (
              <ErrorText>{error}</ErrorText>
            ) : filteredHistory.length === 0 ? (
              <MutedText>
                {historyStatus || trimmedHistoryQuery
                  ? 'No matching history.'
                  : 'No send activity yet.'}
              </MutedText>
            ) : (
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr className={tableHeadRowClass}>
                      <th className={tableHeaderCellClass}>Amount</th>
                      <th className={tableHeaderCellClass}>To</th>
                      <th className={tableHeaderCellClass}>Status</th>
                      <th className={tableHeaderCellClass}>Date</th>
                      <th className={`${tableHeaderCellClass} w-px whitespace-nowrap`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedHistory.map((entry) => (
                      <tr key={entry.id} className={tableRowClass}>
                        <td className={tableCellClass}>
                          <span className='inline-flex items-center gap-1.5 font-semibold text-slate-900'>
                            <TokenGlyph isNative={isNativeTokenId(entry.tokenId)} />
                            {entry.amount} {entry.tokenName}
                          </span>
                        </td>
                        <td className={tableCellClass}>
                          <code className='font-mono text-xs text-slate-500'>{shortAddress(entry.toAddress)}</code>
                        </td>
                        <td className={tableCellClass}>
                          <span className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                            {entry.status}
                          </span>
                        </td>
                        <td className={tableCellClass}>
                          <span className='text-xs text-slate-500'>
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </td>
                        <td className={`${tableCellClass} w-px whitespace-nowrap`}>
                          <RowActions wrap={false}>
                            <TableIconButton
                              type='button'
                              title='View details'
                              aria-label='View history item'
                              onClick={() => setSelectedHistoryItem(entry)}
                            >
                              <Eye size={16} />
                            </TableIconButton>
                          </RowActions>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            )}
            <div className='mt-3'>
              <TablePager
                page={historyCurrentPage}
                pageSize={historyPageSize}
                total={filteredHistory.length}
                totalPages={historyTotalPages}
                disabled={loading || actionsBlocked}
                onPageChange={setHistoryPage}
                onPageSizeChange={(size) => {
                  setHistoryPageSize(size);
                  setHistoryPage(1);
                }}
              />
            </div>
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
          <p className={fieldLabelClass}>
            Token ID
          </p>
          <CopyableCode value={token.tokenId} />
        </div>
        <div className='grid gap-1'>
          <p className={fieldLabelClass}>
            Sendable
          </p>
          <p className='text-lg font-semibold text-slate-900 tabular-nums inline-flex items-center gap-2'>
            <TokenGlyph isNative={token.isNative} />
            {formatAmountAdaptive(token.sendable)}
          </p>
        </div>
        <div className='grid gap-1'>
          <p className={fieldLabelClass}>
            Confirmed
          </p>
          <p className='text-sm font-medium text-slate-900 tabular-nums'>
            {formatAmountAdaptive(token.confirmed)}
          </p>
        </div>
        <div className='grid gap-1'>
          <p className={fieldLabelClass}>
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
            <span className={fieldLabelClass}>
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
              className={inputClass}
            />
          ) : contacts.length === 0 ? (
            <p className='text-sm text-slate-500'>No contacts saved in address book.</p>
          ) : (
            <select
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
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
            <span className={fieldLabelClass}>
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
            className={inputClass}
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
          <span className={fieldLabelClass}>
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
            className={inputClass}
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

        <Button type='submit' disabled={!canSubmit} className='w-full justify-center'>
          {submitting ? 'Sending…' : 'Send payment'}
        </Button>
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
          <span className={fieldLabelClass}>
            Name
          </span>
          <input
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. Device access'
            maxLength={80}
            className={inputClass}
          />
        </label>
        <label className='grid gap-1.5'>
          <span className={fieldLabelClass}>
            Amount (supply)
          </span>
          <input
            type='text'
            inputMode='decimal'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder='e.g. 1000'
            className={inputClass}
          />
        </label>
        <label className='grid gap-1.5'>
          <span className={fieldLabelClass}>
            Decimal places
          </span>
          <input
            type='number'
            min={0}
            step={1}
            value={decimal}
            onChange={(e) => setDecimal(e.target.value)}
            className={inputClass}
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
        <Button
          type='submit'
          disabled={submitting || !hasSufficientMinima || actionsBlocked}
          className='w-full justify-center'
        >
          {submitting ? 'Creating…' : 'Create token'}
        </Button>
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
          <p className={fieldLabelClass}>
            Amount
          </p>
          <p className='text-lg font-semibold text-slate-900 inline-flex items-center gap-2'>
            <TokenGlyph isNative={isNativeTokenId(item.tokenId)} />
            {item.amount} {item.tokenName}
          </p>
        </div>
        <div className='grid gap-1'>
          <p className={fieldLabelClass}>
            Status
          </p>
          <p className='text-sm font-medium text-slate-900 capitalize'>
            {item.status}
          </p>
        </div>
        <div className='grid gap-1'>
          <p className={fieldLabelClass}>
            To
          </p>
          <CopyableCode value={item.toAddress} />
        </div>
        <div className='grid gap-1'>
          <p className={fieldLabelClass}>
            Token ID
          </p>
          <CopyableCode value={item.tokenId} />
        </div>
        {item.txpowId && (
          <div className='grid gap-1'>
            <p className={fieldLabelClass}>
              TxPow ID
            </p>
            <CopyableCode value={item.txpowId} />
          </div>
        )}
        <div className='grid gap-1'>
          <p className={fieldLabelClass}>
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
