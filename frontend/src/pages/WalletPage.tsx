import { useEffect, useRef, useState } from "react";
import { Card } from "../components/Card";
import { MinimaIcon } from "../components/MinimaIcon";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import {
  createWalletAccount,
  getPaymentStatus,
  importWallet as importWalletApi,
  listWalletAccounts,
  sendPayment as sendPaymentApi
} from "../features/wallet/walletApi";
import type { ImportWalletResult, PaymentStatus, UnlabeledFundedAddress, WalletAccount, WalletAccountTokenBalance } from "../features/wallet/walletTypes";

function isMiniAddress(value: string): boolean {
  return value.startsWith("Mx");
}

export function WalletPage() {
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createFromAddress, setCreateFromAddress] = useState<string | null>(null);
  const [selected, setSelected] = useState<WalletAccount | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [unlabeledFunded, setUnlabeledFunded] = useState<UnlabeledFundedAddress[]>([]);

  async function refreshAccounts() {
    setLoading(true);
    setError(null);
    try {
      const result = await listWalletAccounts();
      setAccounts(result.accounts);
      setUnlabeledFunded(result.unlabeledFunded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAccounts();
  }, []);

  const totalMinima = accounts.reduce((sum, account) => sum + Number(account.balance.totalMinima || "0"), 0).toString();

  return (
    <Page eyebrow="Wallet" title="Wallet accounts" desc="Named account labels mapped to Minima node addresses.">
      <div className="hero-card wallet-balance-card">
        <div className="wallet-hero-header">
          <div className="wallet-hero-icon">
            <MinimaIcon size={18} />
          </div>
          <p className="eyebrow">Node wallet</p>
        </div>
        <div className="wallet-amount-row">
          <MinimaIcon size={36} className="wallet-amount-icon" />
          <span className="wallet-amount-number">{loading ? "…" : totalMinima}</span>
        </div>
        <p className="wallet-amount-label">MINIMA across labeled accounts</p>
        <div className="wallet-hero-actions">
          <button type="button" className="wallet-action-btn" onClick={() => setCreateOpen(true)}>
            Create account
          </button>
          <button type="button" className="wallet-action-btn wallet-action-btn-ghost" onClick={() => setSendOpen(true)}>
            Send payment
          </button>
          <button type="button" className="wallet-action-btn wallet-action-btn-ghost" onClick={() => setImportOpen(true)}>
            Import wallet
          </button>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="eyebrow">Accounts</p>
          <button type="button" className="btn btn-secondary" onClick={refreshAccounts} disabled={loading}>
            Refresh
          </button>
        </div>
        {loading && <p className="muted">Loading accounts…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && accounts.length === 0 && (
          <p className="muted">No labeled accounts yet. Create one to map a name to a wallet address.</p>
        )}
        <div className="grid gap-3">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => setSelected(account)}
              className="text-left rounded-2xl border border-slate-200 p-4 hover:border-slate-400 transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{account.label}</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {isMiniAddress(account.miniAddress) ? account.miniAddress : account.address}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">{account.balance.totalMinima}</p>
                  <p className="text-xs text-slate-500">MINIMA</p>
                  <p className="text-xs text-slate-500 mt-1">{account.balance.tokenCount} tokens</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {!loading && unlabeledFunded.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="eyebrow">Unlabeled funded addresses</p>
          </div>
          <p className="text-sm text-slate-500 mb-3">
            Funds were detected on these addresses but they are not mapped to a named account yet.
          </p>
          <div className="grid gap-3">
            {unlabeledFunded.map((item) => (
              <div key={item.address} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500 font-mono break-all">{item.address}</p>
                    <p className="text-sm text-slate-700 mt-1">{item.totalMinima} MINIMA · {item.tokenCount} tokens</p>
                  </div>
                  <button
                    type="button"
                    className="wallet-action-btn"
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

      {createOpen && <CreateAccountModal onClose={() => setCreateOpen(false)} onCreated={refreshAccounts} />}
      {createFromAddress && (
        <CreateAccountModal
          onClose={() => setCreateFromAddress(null)}
          onCreated={refreshAccounts}
          fixedAddress={createFromAddress}
        />
      )}
      {selected && <AccountDetailModal account={selected} onClose={() => setSelected(null)} />}
      {sendOpen && <SendPaymentModal accounts={accounts} onClose={() => setSendOpen(false)} />}
      {importOpen && <ImportWalletModal onClose={() => setImportOpen(false)} />}
    </Page>
  );
}

function CreateAccountModal({
  onClose,
  onCreated,
  fixedAddress
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  fixedAddress?: string;
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError("Label is required.");
      return;
    }
    setSubmitting(true);
    try {
      await createWalletAccount(label.trim(), fixedAddress);
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Create wallet account" onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <p className="text-sm text-slate-500">
          {fixedAddress
            ? "This labels an existing funded address and adds it as a wallet account."
            : "This creates a new labeled account by assigning one random default Minima address from this node's wallet."}
        </p>
        {fixedAddress && (
          <code className="block break-all rounded-xl bg-slate-100 p-3 text-xs text-slate-700 font-mono">{fixedAddress}</code>
        )}
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Account label</span>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Treasury" maxLength={80} />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className="rounded-xl border-0 bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
          {submitting ? "Creating…" : "Create account"}
        </button>
      </form>
    </Modal>
  );
}

function AccountDetailModal({ account, onClose }: { account: WalletAccount; onClose: () => void }) {
  const hasMx = isMiniAddress(account.miniAddress);
  return (
    <Modal title={`Account: ${account.label}`} onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Address (Mx)</p>
          {hasMx ? (
            <code className="block break-all rounded-xl bg-slate-100 p-3 text-xs text-slate-700 font-mono">{account.miniAddress}</code>
          ) : (
            <p className="text-sm text-slate-500">Not available for this imported address yet.</p>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Address (0x)</p>
          <code className="block break-all rounded-xl bg-slate-100 p-3 text-xs text-slate-700 font-mono">{account.address}</code>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900 mb-2">Funds</p>
          <div className="grid gap-2">
            {account.balance.tokens.length === 0 && <p className="text-sm text-slate-500">No funds on this address yet.</p>}
            {account.balance.tokens.map((token) => (
              <div key={token.tokenId} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{token.name}</p>
                  {!token.isNative && <p className="text-xs text-slate-500 font-mono">{token.tokenId}</p>}
                </div>
                <p className="text-sm font-semibold text-slate-900">{token.amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

type PollState = "idle" | "polling" | "confirmed" | "failed" | "timeout";

function SendPaymentModal({
  accounts,
  onClose,
}: {
  accounts: WalletAccount[];
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [fromAccountId, setFromAccountId] = useState("");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenId, setTokenId] = useState("0x00");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [txpowId, setTxpowId] = useState<string | null>(null);
  const [pollState, setPollState] = useState<PollState>("idle");
  const [pollCount, setPollCount] = useState(0);
  const [lastStatus, setLastStatus] = useState<PaymentStatus | null>(null);
  const pollRef = useRef<number | null>(null);

  const MAX_POLLS = 12;

  function stopPolling() {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function handleClose() {
    stopPolling();
    if (pollState === "polling") {
      showToast({
        tone: "info",
        title: "Payment still pending",
        message: "Transaction submitted. Check the diagnostics log for confirmation.",
        timeoutMs: 9000,
      });
    }
    onClose();
  }

  function startPolling(id: string) {
    let count = 0;
    setPollState("polling");
    pollRef.current = window.setInterval(async () => {
      count++;
      setPollCount(count);
      if (count > MAX_POLLS) {
        stopPolling();
        setPollState("timeout");
        showToast({ tone: "info", title: "Still pending", message: "Transaction not confirmed after 60 s. Check back later.", timeoutMs: 9000 });
        return;
      }
      try {
        const st = await getPaymentStatus(id);
        setLastStatus(st);
        if (st.status === "confirmed") {
          stopPolling();
          setPollState("confirmed");
          showToast({ tone: "success", title: "Payment confirmed", message: `TX ${id.slice(0, 16)}… confirmed on chain.` });
        } else if (st.status === "failed") {
          stopPolling();
          setPollState("failed");
          showToast({ tone: "error", title: "Payment failed", message: "Transaction was rejected by the network.", timeoutMs: 9000 });
        }
      } catch {
        // keep polling through transient network errors
      }
    }, 5000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const selectedAccount = accounts.find((account) => account.id === fromAccountId);
    if (!selectedAccount) { setFormError("Select a source account."); return; }
    if (!address.trim()) { setFormError("Address is required."); return; }
    const num = Number(amount);
    if (!amount || !Number.isFinite(num) || num <= 0) { setFormError("Amount must be a positive number."); return; }
    setSubmitting(true);
    try {
      const result = await sendPaymentApi({
        address: address.trim(),
        amount: amount.trim(),
        tokenId,
        fromAccountAddress: selectedAccount.address
      });
      if (!result.ok || result.status === "failed") {
        setFormError(result.message ?? "Send failed.");
        return;
      }
      if (result.txpowId) {
        setTxpowId(result.txpowId);
        startPolling(result.txpowId);
      } else {
        setPollState("confirmed");
        showToast({ tone: "success", title: "Payment sent" });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const sent = pollState !== "idle";
  const selectedAccount = accounts.find((account) => account.id === fromAccountId);
  const tokenOptions = selectedAccount
    ? selectedAccount.balance.tokens.map((token) => ({ value: token.tokenId, label: token.isNative ? "Minima (native)" : token.name }))
    : [{ value: "0x00", label: "Minima (native)" }];

  return (
    <Modal title="Send payment" onClose={handleClose}>
      {!sent ? (
        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">From account</span>
            <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label} ({account.balance.totalMinima} MINIMA)
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Recipient address</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Mx… or 0x…"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Amount</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Token</span>
            <select value={tokenId} onChange={(e) => setTokenId(e.target.value)}>
              {tokenOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          {formError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl border-0 bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send payment"}
          </button>
        </form>
      ) : (
        <div className="grid gap-4">
          <PollStatusDisplay state={pollState} pollCount={pollCount} maxPolls={MAX_POLLS} txpowId={txpowId} lastStatus={lastStatus} />
        </div>
      )}
    </Modal>
  );
}

function PollStatusDisplay({
  state,
  pollCount,
  maxPolls,
  txpowId,
  lastStatus,
}: {
  state: PollState;
  pollCount: number;
  maxPolls: number;
  txpowId: string | null;
  lastStatus: PaymentStatus | null;
}) {
  const remaining = maxPolls - pollCount;

  if (state === "confirmed") {
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center grid gap-2">
        <p className="text-lg font-bold text-emerald-700">Payment confirmed</p>
        {txpowId && <code className="text-xs text-emerald-600 break-all">{txpowId}</code>}
      </div>
    );
  }
  if (state === "failed") {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-5 text-center">
        <p className="text-lg font-bold text-red-700">Payment failed</p>
        <p className="text-sm text-red-600 mt-1">Transaction was rejected by the network.</p>
      </div>
    );
  }
  if (state === "timeout") {
    return (
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 grid gap-2">
        <p className="font-bold text-amber-700">Still pending after 60 s</p>
        <p className="text-sm text-amber-600">The transaction was submitted. Check the diagnostics log or query the TX directly.</p>
        {txpowId && <code className="text-xs text-slate-600 break-all">{txpowId}</code>}
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 grid gap-2">
      <p className="font-bold text-slate-700">Transaction submitted</p>
      <p className="text-sm text-slate-500">
        Checking for confirmation… ({pollCount}/{maxPolls}, ~{Math.max(0, remaining) * 5} s remaining)
      </p>
      {txpowId && <code className="mt-1 block break-all text-xs text-slate-500">{txpowId}</code>}
      {lastStatus && (
        <p className="text-xs text-slate-400">
          Last check: {lastStatus.status} · {new Date(lastStatus.checkedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function ImportWalletModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [phrase, setPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportWalletResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phrase.trim();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (wordCount < 12) {
      setError("Seed phrase must be at least 12 words.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await importWalletApi(trimmed);
      setResult(res);
      if (res.ok) {
        showToast({ tone: "success", title: "Wallet imported", message: res.message });
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Import wallet" onClose={onClose}>
      <div className="grid gap-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-bold text-amber-800">This will replace the current wallet</p>
          <p className="text-sm text-amber-700 mt-1">
            Restoring from a seed phrase overwrites the node's existing wallet. The node may restart after import.
            Only proceed on a trusted local network — the phrase is sent over HTTP.
          </p>
        </div>

        {result?.ok ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center grid gap-2">
            <p className="text-lg font-bold text-emerald-700">Wallet imported</p>
            <p className="text-sm text-emerald-600">{result.message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Seed phrase (12 or 24 words)
              </span>
              <textarea
                rows={4}
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="word1 word2 word3 …"
                autoComplete="off"
                spellCheck={false}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </label>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl border-0 bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {submitting ? "Importing…" : "Import wallet"}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
