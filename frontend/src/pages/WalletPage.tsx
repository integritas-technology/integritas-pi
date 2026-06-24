import { useEffect, useState } from 'react';
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
import { formatMinimaAmount } from '../lib/format';
import {
  clearWalletAccountsForDebug,
  clearWalletHistoryForDebug,
  createWalletAccount,
  importWallet as importWalletApi,
  listWalletAccounts,
  listWalletSendHistory,
  sendPayment as sendPaymentApi,
} from '../features/wallet/walletApi';
import type {
  ImportWalletResult,
  UnlabeledFundedAddress,
  WalletAccount,
  WalletAccountTokenBalance,
  WalletSendHistoryItem,
} from '../features/wallet/walletTypes';

function isMiniAddress(value: string): boolean {
  return value.startsWith('Mx');
}

function isNativeTokenId(tokenId: string): boolean {
  return tokenId.trim().toLowerCase() === '0x00';
}

function addDecimalStrings(a: string, b: string): string {
  const [aInt, aFrac = ''] = a.split('.');
  const [bInt, bFrac = ''] = b.split('.');
  const fracLen = Math.max(aFrac.length, bFrac.length);
  const aNorm = `${aInt || '0'}${aFrac.padEnd(fracLen, '0')}`;
  const bNorm = `${bInt || '0'}${bFrac.padEnd(fracLen, '0')}`;
  const sum = (BigInt(aNorm || '0') + BigInt(bNorm || '0'))
    .toString()
    .padStart(fracLen + 1, '0');
  if (fracLen === 0) return sum;
  const intPart = sum.slice(0, -fracLen).replace(/^0+(?=\d)/, '');
  const fracPart = sum.slice(-fracLen).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
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
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createFromAddress, setCreateFromAddress] = useState<string | null>(
    null,
  );
  const [selected, setSelected] = useState<WalletAccount | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [createTokenOpen, setCreateTokenOpen] = useState(false);
  const [unlabeledFunded, setUnlabeledFunded] = useState<
    UnlabeledFundedAddress[]
  >([]);
  const [sendHistory, setSendHistory] = useState<WalletSendHistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<WalletSendHistoryItem | null>(null);
  const [debugClearing, setDebugClearing] = useState(false);
  const [debugClearingHistory, setDebugClearingHistory] = useState(false);

  async function refreshAccounts() {
    setLoading(true);
    setError(null);
    try {
      const [result, history] = await Promise.all([
        listWalletAccounts(),
        listWalletSendHistory(20),
      ]);
      setAccounts(result.accounts);
      setUnlabeledFunded(result.unlabeledFunded);
      setSendHistory(history.sends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAccounts();
  }, []);

  const totalMinima = accounts.reduce(
    (sum, account) =>
      addDecimalStrings(sum, account.balance.totalMinima || '0'),
    '0',
  );
  const isDev = import.meta.env.DEV;

  async function handleDebugClearWalletAccounts() {
    const confirmed = window.confirm(
      'Clear all labeled wallet accounts from SQLite? This is a dev-only debug action and cannot be undone.',
    );
    if (!confirmed) return;
    setDebugClearing(true);
    try {
      const result = await clearWalletAccountsForDebug();
      await refreshAccounts();
      showToast({
        tone: 'success',
        title: 'Wallet accounts cleared',
        message: `Deleted ${result.deleted} labeled account(s).`,
      });
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Clear failed',
        message:
          err instanceof Error
            ? err.message
            : 'Could not clear wallet accounts.',
      });
    } finally {
      setDebugClearing(false);
    }
  }

  async function handleDebugClearWalletHistory() {
    const confirmed = window.confirm(
      'Clear wallet send history from SQLite? This is a dev-only debug action and cannot be undone.',
    );
    if (!confirmed) return;
    setDebugClearingHistory(true);
    try {
      const result = await clearWalletHistoryForDebug();
      await refreshAccounts();
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
      title='Wallet accounts'
      desc='Named account labels mapped to Minima node addresses.'
    >
      <div className='hero-card wallet-balance-card'>
        <div className='wallet-hero-left'>
          <div className='wallet-hero-header'>
            <div className='wallet-hero-icon'>
              <MinimaIcon size={18} />
            </div>
            <p className='eyebrow'>Node wallet</p>
          </div>
          <p className='wallet-amount-label'>MINIMA across labeled accounts</p>
        </div>
        <div className='wallet-hero-right'>
          <div className='wallet-amount-row'>
            <MinimaIcon size={36} className='wallet-amount-icon' />
            <span
              className='wallet-amount-number'
              title={loading ? undefined : formatMinimaAmount(totalMinima)}
            >
              {loading ? '…' : formatMinimaAmount(totalMinima)}
            </span>
          </div>
          <div className='wallet-hero-actions'>
            <button
              type='button'
              className='wallet-action-btn'
              onClick={() => setCreateOpen(true)}
            >
              Create account
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
              onClick={() => setImportOpen(true)}
            >
              Import wallet
            </button>
            <button
              type='button'
              className='wallet-action-btn wallet-action-btn-ghost'
              onClick={() => setCreateTokenOpen(true)}
            >
              Create token
            </button>
            <button
              type='button'
              className='wallet-action-btn wallet-action-btn-ghost'
              disabled
              title='Export wallet backup — coming soon'
            >
              Export wallet
            </button>
          </div>
        </div>
      </div>

      <Card>
        <div className='flex items-center justify-between gap-3 mb-4'>
          <p className='eyebrow'>Accounts</p>
          <button
            type='button'
            className='btn btn-secondary'
            onClick={refreshAccounts}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {loading && <p className='muted'>Loading accounts…</p>}
        {error && <p className='error-text'>{error}</p>}
        {!loading && !error && accounts.length === 0 && (
          <p className='muted'>
            No labeled accounts yet. Create one to map a name to a wallet
            address.
          </p>
        )}
        <div className='grid gap-3'>
          {accounts.map((account) => (
            <button
              key={account.id}
              type='button'
              onClick={() => setSelected(account)}
              className='text-left rounded-2xl border border-slate-200 p-4 hover:border-slate-400 transition'
            >
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <p className='font-semibold text-slate-900'>
                    {account.label}
                  </p>
                  <p className='text-xs text-slate-500 mt-1 font-mono'>
                    {isMiniAddress(account.miniAddress)
                      ? account.miniAddress
                      : account.address}
                  </p>
                </div>
                <div className='text-right'>
                  <p className='text-lg font-bold text-slate-900 inline-flex items-center gap-1.5 justify-end'>
                    <TokenGlyph isNative />
                    {formatMinimaAmount(account.balance.totalMinima)}
                  </p>
                  <p className='text-xs text-slate-500'>MINIMA</p>
                  <p className='text-xs text-slate-500 mt-1'>
                    {account.balance.tokenCount} tokens
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
        {isDev && (
          <div className='mt-4 flex justify-start'>
            <button
              type='button'
              className='btn btn-secondary'
              onClick={handleDebugClearWalletAccounts}
              disabled={debugClearing}
              title='Dev-only: clears wallet_accounts table'
            >
              {debugClearing ? 'Clearing…' : 'Debug: clear labels'}
            </button>
          </div>
        )}
      </Card>

      {!loading && unlabeledFunded.length > 0 && (
        <Card>
          <div className='flex items-center justify-between gap-3 mb-4'>
            <p className='eyebrow'>Unlabeled funded addresses</p>
          </div>
          <p className='text-sm text-slate-500 mb-3'>
            Funds were detected on these addresses but they are not mapped to a
            named account yet. Use <strong>Label as account</strong> to attach
            MINIMA on that address to Family, Treasury, or another label.
          </p>
          <div className='grid gap-3'>
            {unlabeledFunded.map((item) => (
              <div
                key={item.address}
                className='rounded-2xl border border-slate-200 p-4'
              >
                <div className='flex items-center justify-between gap-3'>
                  <div>
                    <p className='text-xs text-slate-500 font-mono break-all'>
                      {item.address}
                    </p>
                    <p className='text-sm text-slate-700 mt-1'>
                      {formatMinimaAmount(item.totalMinima)} MINIMA ·{' '}
                      {item.tokenCount} tokens
                    </p>
                  </div>
                  <button
                    type='button'
                    className='wallet-action-btn'
                    onClick={() => setCreateFromAddress(item.address)}
                  >
                    Label as account
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className='flex items-center justify-between gap-3 mb-4'>
          <p className='eyebrow'>History</p>
          <p className='text-xs text-slate-500'>Sent</p>
        </div>
        {loading && <p className='muted'>Loading history…</p>}
        {!loading && sendHistory.length === 0 && (
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
                    {formatHistoryFlow(entry, accounts)}
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

      {createOpen && (
        <CreateAccountModal
          onClose={() => setCreateOpen(false)}
          onCreated={refreshAccounts}
        />
      )}
      {createFromAddress && (
        <CreateAccountModal
          onClose={() => setCreateFromAddress(null)}
          onCreated={refreshAccounts}
          fixedAddress={createFromAddress}
        />
      )}
      {selected && (
        <AccountDetailModal
          account={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {selectedHistoryItem && (
        <HistoryDetailModal
          item={selectedHistoryItem}
          accounts={accounts}
          onClose={() => setSelectedHistoryItem(null)}
        />
      )}
      {sendOpen && (
        <SendPaymentModal
          accounts={accounts}
          onClose={() => setSendOpen(false)}
        />
      )}
      {importOpen && <ImportWalletModal onClose={() => setImportOpen(false)} />}
      {createTokenOpen && (
        <CreateTokenModal
          accounts={accounts}
          onClose={() => setCreateTokenOpen(false)}
          onCreated={refreshAccounts}
        />
      )}
    </Page>
  );
}

function CreateAccountModal({
  onClose,
  onCreated,
  fixedAddress,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  fixedAddress?: string;
}) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }
    setSubmitting(true);
    try {
      await createWalletAccount(label.trim(), fixedAddress);
      await onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create account.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleCloseRequest() {
    if (submitting) return;
    onClose();
  }

  return (
    <Modal title='Create wallet account' onClose={handleCloseRequest}>
      <form onSubmit={handleSubmit} className='grid gap-4'>
        <p className='text-sm text-slate-500'>
          {fixedAddress
            ? 'This labels an existing funded address and adds it as a wallet account.'
            : "This creates a new labeled account by assigning one random default Minima address from this node's wallet."}
        </p>
        {fixedAddress && (
          <code className='block break-all rounded-xl bg-slate-100 p-3 text-xs text-slate-700 font-mono'>
            {fixedAddress}
          </code>
        )}
        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Account label
          </span>
          <input
            type='text'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='e.g. Treasury'
            maxLength={80}
          />
        </label>
        {error && <p className='text-sm text-red-700'>{error}</p>}
        {submitting && (
          <p className='text-sm text-slate-500'>
            Saving account label… please wait.
          </p>
        )}
        <button
          type='submit'
          disabled={submitting}
          className='rounded-xl border-0 bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50'
        >
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </Modal>
  );
}

function AccountDetailModal({
  account,
  onClose,
}: {
  account: WalletAccount;
  onClose: () => void;
}) {
  const hasMx = isMiniAddress(account.miniAddress);
  const [fundFilter, setFundFilter] = useState<'all' | 'minima' | 'tokens'>(
    'all',
  );
  const visibleFunds = account.balance.tokens.filter((token) => {
    if (fundFilter === 'minima') return token.isNative;
    if (fundFilter === 'tokens') return !token.isNative;
    return true;
  });
  return (
    <Modal title={`Account: ${account.label}`} onClose={onClose}>
      <div className='grid gap-4'>
        <div>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500 mb-1'>
            Address (Mx)
          </p>
          {hasMx ? (
            <CopyableCode value={account.miniAddress} />
          ) : (
            <p className='text-sm text-slate-500'>
              Not available for this imported address yet.
            </p>
          )}
        </div>
        <div>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500 mb-1'>
            Address (0x)
          </p>
          <CopyableCode value={account.address} />
        </div>
        <div>
          <div className='flex items-center justify-between gap-3 mb-3'>
            <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
              Funds
            </p>
            <div className='subtabs'>
              {(['all', 'minima', 'tokens'] as const).map((f) => (
                <button
                  key={f}
                  type='button'
                  className={fundFilter === f ? 'active' : ''}
                  onClick={() => setFundFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'minima' ? 'Minima' : 'Tokens'}
                </button>
              ))}
            </div>
          </div>
          <div className='grid gap-2'>
            {visibleFunds.length === 0 && (
              <p className='text-sm text-slate-500'>No funds in this filter.</p>
            )}
            {visibleFunds.map((token) => (
              <div
                key={token.tokenId}
                className='flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2.5'
              >
                <div>
                  <p className='text-sm font-medium text-slate-900'>
                    {token.name}
                  </p>
                  <p className='text-xs text-slate-500 font-mono break-all'>
                    {token.tokenId}
                  </p>
                </div>
                <div className='self-start'>
                  <p className='text-sm font-semibold text-slate-900 whitespace-nowrap inline-flex items-center gap-1.5'>
                    <TokenGlyph isNative={token.isNative} />
                    {token.amount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SendPaymentModal({
  accounts,
  onClose,
}: {
  accounts: WalletAccount[];
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [destinationMode, setDestinationMode] = useState<
    'external' | 'account'
  >('external');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenId, setTokenId] = useState('0x00');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const selectedAccount = accounts.find(
      (account) => account.id === fromAccountId,
    );
    if (!selectedAccount) {
      setFormError('Select a source account.');
      return;
    }
    const destinationAccount =
      destinationMode === 'account'
        ? accounts.find((account) => account.id === toAccountId)
        : null;
    if (destinationMode === 'account' && !destinationAccount) {
      setFormError('Select a destination account.');
      return;
    }
    if (
      destinationMode === 'account' &&
      destinationAccount?.id === selectedAccount.id
    ) {
      setFormError('Source and destination account must be different.');
      return;
    }
    const targetAddress =
      destinationMode === 'account'
        ? destinationAccount?.miniAddress || destinationAccount?.address || ''
        : address.trim();
    if (!targetAddress) {
      setFormError('Address is required.');
      return;
    }
    const num = Number(amount);
    if (!amount || !Number.isFinite(num) || num <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }
    const selectedToken = selectedAccount.balance.tokens.find(
      (token) => token.tokenId === tokenId,
    );
    const availableAmount = selectedToken?.amount ?? '0';
    if (!selectedToken || compareDecimalStrings(availableAmount, '0') <= 0) {
      setFormError('Selected account has no balance for this token.');
      return;
    }
    if (compareDecimalStrings(amount.trim(), availableAmount) > 0) {
      const tokenLabel = selectedToken.isNative ? 'Minima' : selectedToken.name;
      setFormError(
        `Amount exceeds available balance (${availableAmount} ${tokenLabel}).`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await sendPaymentApi({
        address: targetAddress,
        amount: amount.trim(),
        tokenId,
        tokenName:
          tokenId === '0x00'
            ? 'Minima'
            : (tokenOptions.find((opt) => opt.value === tokenId)?.label ??
              tokenId),
        fromAccountAddress: selectedAccount.address,
      });
      if (!result.ok || result.status === 'failed') {
        setFormError(result.message ?? 'Send failed.');
        return;
      }
      showToast({
        tone: 'success',
        title: destinationMode === 'account' ? 'Transfer sent' : 'Payment sent',
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

  const selectedAccount = accounts.find(
    (account) => account.id === fromAccountId,
  );
  const destinationAccounts = selectedAccount
    ? accounts.filter((account) => account.id !== selectedAccount.id)
    : accounts;
  const tokenOptions = selectedAccount
    ? selectedAccount.balance.tokens.map((token) => ({
        value: token.tokenId,
        label: token.isNative ? 'Minima (native)' : token.name,
      }))
    : [{ value: '0x00', label: 'Minima (native)' }];
  const selectedToken = selectedAccount?.balance.tokens.find(
    (token) => token.tokenId === tokenId,
  );
  const availableAmount = selectedToken?.amount ?? '0';
  const availableLabel = selectedToken
    ? selectedToken.isNative
      ? 'Minima'
      : selectedToken.name
    : null;
  const exceedsBalance = Boolean(
    selectedAccount &&
    isPositiveDecimal(amount) &&
    compareDecimalStrings(amount.trim(), availableAmount) > 0,
  );
  const canSubmit = Boolean(selectedAccount) && !exceedsBalance && !submitting;

  return (
    <Modal title='Send payment' onClose={onClose}>
      <form onSubmit={handleSubmit} className='grid gap-4'>
        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            From account
          </span>
          <select
            value={fromAccountId}
            onChange={(e) => {
              const nextAccountId = e.target.value;
              setFromAccountId(nextAccountId);
              setToAccountId('');
              setFormError(null);
              const account = accounts.find(
                (entry) => entry.id === nextAccountId,
              );
              if (
                account &&
                !account.balance.tokens.some(
                  (token) => token.tokenId === tokenId,
                )
              ) {
                setTokenId(account.balance.tokens[0]?.tokenId ?? '0x00');
              }
            }}
          >
            <option value=''>Select account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </label>
        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Destination type
          </span>
          <select
            value={destinationMode}
            onChange={(e) => {
              const mode =
                e.target.value === 'account' ? 'account' : 'external';
              setDestinationMode(mode);
              setFormError(null);
            }}
          >
            <option value='external'>External address</option>
            <option value='account'>My account</option>
          </select>
        </label>
        {destinationMode === 'account' ? (
          <label className='grid gap-1.5'>
            <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
              To account
            </span>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
            >
              <option value=''>Select destination account</option>
              {destinationAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className='grid gap-1.5'>
            <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
              Recipient address
            </span>
            <input
              type='text'
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder='Mx… or 0x…'
              autoComplete='off'
              spellCheck={false}
            />
          </label>
        )}

        <label className='grid gap-1.5'>
          <span className='flex items-center justify-between gap-3'>
            <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
              Token
            </span>
            {selectedAccount && selectedToken && (
              <span className='text-xs font-medium text-slate-600'>
                {availableAmount} {availableLabel} available
              </span>
            )}
          </span>
          <select
            value={tokenId}
            onChange={(e) => {
              setTokenId(e.target.value);
              setFormError(null);
            }}
            disabled={!selectedAccount}
          >
            {tokenOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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
            disabled={!selectedAccount}
          />
        </label>

        {exceedsBalance && selectedToken && (
          <div className='rounded-xl bg-amber-50 border border-amber-200 p-3'>
            <p className='text-sm text-amber-800'>
              Amount exceeds available balance ({availableAmount}{' '}
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
          {submitting
            ? 'Sending…'
            : destinationMode === 'account'
              ? 'Transfer to account'
              : 'Send payment'}
        </button>
      </form>
    </Modal>
  );
}

function CreateTokenModal({
  accounts,
  onClose,
  onCreated,
}: {
  accounts: WalletAccount[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [requirements, setRequirements] =
    useState<TokenCreateRequirements | null>(null);
  const accountOptions = accounts.map((account) => {
    const native = account.balance.tokens.find((token) => token.isNative);
    const minima = native?.amount ?? '0';
    const minimum = requirements?.minimumAccountMinima ?? '0.001';
    const funded =
      compareDecimalStrings(minima, minimum) >= 0 &&
      compareDecimalStrings(minima, '0') > 0;
    return {
      key: account.id,
      label: account.label,
      address: account.address,
      minima,
      funded,
    };
  });
  const fundedOptions = accountOptions.filter((option) => option.funded);
  const [fromAccountAddress, setFromAccountAddress] = useState('');
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

  useEffect(() => {
    if (fromAccountAddress) return;
    const firstFunded =
      fundedOptions[0]?.address ?? accountOptions[0]?.address ?? '';
    if (firstFunded) setFromAccountAddress(firstFunded);
  }, [accountOptions, fundedOptions, fromAccountAddress]);

  const selectedAccount = accountOptions.find(
    (option) => option.address === fromAccountAddress,
  );
  const canSubmit = Boolean(selectedAccount?.funded);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedAmount = amount.trim();
    const parsedDecimal = Number(decimal);

    if (!fromAccountAddress || !selectedAccount?.funded) {
      setError(
        'Select a labeled account with enough MINIMA on its address. Label a funded address on the Wallet page if your MINIMA is still unlabeled.',
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
        fromAccountAddress,
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

  const estimatedCost = requirements?.estimatedMinimaCost ?? '0.001';
  const minimumBalance = requirements?.minimumAccountMinima ?? '0.001';

  return (
    <Modal title='Create custom token' onClose={handleCloseRequest}>
      <div className='grid gap-4'>
        {/* <div className='rounded-xl bg-amber-50 border border-amber-200 p-4'>
          <p className='text-sm font-bold text-amber-800'>
            On-chain action — cannot be undone
          </p>
          <p className='text-sm text-amber-700 mt-1'>
            Minima colours a tiny fraction of MINIMA to mint a token. Estimated
            cost: about {formatMinimaAmount(estimatedCost)} MINIMA from the
            selected account (needs at least {formatMinimaAmount(minimumBalance)}{' '}
            MINIMA on that account&apos;s address). Creation may take up to a
            minute. Token names may include spaces.
          </p>
        </div> */}

        {accounts.length === 0 ? (
          <p className='text-sm text-red-700'>
            Create a labeled wallet account first, then receive or label MINIMA
            onto that account&apos;s address.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className='grid gap-4'>
            <label className='grid gap-1.5'>
              <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
                Pay from account
              </span>
              <select
                value={fromAccountAddress}
                onChange={(e) => setFromAccountAddress(e.target.value)}
              >
                {accountOptions.map((option) => (
                  <option
                    key={option.key}
                    value={option.address}
                    disabled={!option.funded}
                  >
                    {option.label} ({formatMinimaAmount(option.minima)} MINIMA
                    {!option.funded ? ' — insufficient' : ''})
                  </option>
                ))}
              </select>
            </label>
            {selectedAccount && (
              <p className='text-sm text-slate-500'>
                {selectedAccount.funded
                  ? `${selectedAccount.label} has ${formatMinimaAmount(selectedAccount.minima)} MINIMA on its address.`
                  : `${selectedAccount.label} has no MINIMA on its address. Use “Label as account” on an unlabeled funded address below, or receive MINIMA to this account.`}
              </p>
            )}
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
              disabled={submitting || !canSubmit}
              className='rounded-xl border-0 bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50'
            >
              {submitting ? 'Creating…' : 'Create token'}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}

function ImportWalletModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [phrase, setPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportWalletResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
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
        showToast({
          tone: 'success',
          title: 'Wallet imported',
          message: res.message,
        });
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
    <Modal title='Import wallet' onClose={onClose}>
      <div className='grid gap-4'>
        <div className='rounded-xl bg-amber-50 border border-amber-200 p-4'>
          <p className='text-sm font-bold text-amber-800'>
            This will replace the current wallet
          </p>
          <p className='text-sm text-amber-700 mt-1'>
            Restoring from a seed phrase overwrites the node's existing wallet.
            The node may restart after import. Only proceed on a trusted local
            network — the phrase is sent over HTTP.
          </p>
        </div>

        {result?.ok ? (
          <div className='rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center grid gap-2'>
            <p className='text-lg font-bold text-emerald-700'>
              Wallet imported
            </p>
            <p className='text-sm text-emerald-600'>{result.message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='grid gap-4'>
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
    </Modal>
  );
}

function HistoryDetailModal({
  item,
  accounts,
  onClose,
}: {
  item: WalletSendHistoryItem;
  accounts: WalletAccount[];
  onClose: () => void;
}) {
  const fromMatch = accounts.find(
    (account) =>
      account.address === (item.fromAccountAddress ?? '') ||
      account.miniAddress === (item.fromAccountAddress ?? ''),
  );
  const toMatch = accounts.find(
    (account) =>
      account.address === item.toAddress ||
      account.miniAddress === item.toAddress,
  );

  const fromLabel = fromMatch?.label ?? item.fromAccountLabel ?? 'Unassigned';
  const fromAddress =
    fromMatch?.miniAddress ||
    fromMatch?.address ||
    item.fromAccountAddress ||
    'unknown';
  const toAddress = toMatch?.miniAddress || toMatch?.address || item.toAddress;
  const toLabel = toMatch ? toMatch.label : 'External';

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
            From
          </p>
          <p className='text-sm text-slate-900'>{fromLabel}</p>
          <CopyableCode value={fromAddress} />
        </div>
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            To
          </p>
          <p className='text-sm text-slate-900'>{toLabel}</p>
          <CopyableCode value={toAddress} />
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

function shortAddress(value: string): string {
  if (value.length <= 18) return value;
  if (value.startsWith('Mx')) return `${value.slice(0, 8)}…${value.slice(-6)}`;
  if (value.startsWith('0x')) return `${value.slice(0, 10)}…${value.slice(-6)}`;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function displayAddress(address: string): string {
  return shortAddress(address);
}

function formatHistoryFlow(
  entry: WalletSendHistoryItem,
  accounts: WalletAccount[],
): string {
  const fromMatch = accounts.find(
    (account) =>
      account.address === (entry.fromAccountAddress ?? '') ||
      account.miniAddress === (entry.fromAccountAddress ?? ''),
  );
  const toMatch = accounts.find(
    (account) =>
      account.address === entry.toAddress ||
      account.miniAddress === entry.toAddress,
  );

  const fromLabel = fromMatch?.label ?? entry.fromAccountLabel ?? 'Unassigned';
  const fromAddr =
    fromMatch?.miniAddress ||
    fromMatch?.address ||
    entry.fromAccountAddress ||
    'unknown';
  const toAddr = toMatch?.miniAddress || toMatch?.address || entry.toAddress;
  const toTag = toMatch ? toMatch.label : 'External';

  return `From ${displayAddress(fromAddr)} (${fromLabel}) -> ${displayAddress(toAddr)} (${toTag})`;
}
