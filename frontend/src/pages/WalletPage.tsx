import { useEffect, useRef, useState } from "react";
import { Card } from "../components/Card";
import { MinimaIcon } from "../components/MinimaIcon";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import {
  getPaymentStatus,
  getReceiveAddress,
  getWalletStatus,
  sendPayment as sendPaymentApi,
} from "../features/wallet/walletApi";
import type {
  PaymentStatus,
  ReceiveAddress,
  TokenBalance,
  WalletStatus,
} from "../features/wallet/walletTypes";

type Filter = "all" | "minima" | "tokens";

export function WalletPage() {
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    getWalletStatus().then(setStatus).catch((err: Error) => setError(err.message));
  }, []);

  const native = status?.tokens.find((t) => t.isNative) ?? null;
  const visible = filterTokens(status?.tokens ?? [], filter);

  return (
    <Page eyebrow="Wallet" title="Wallet and tokens" desc="Minima wallet balance and token holdings for this node.">
      <div className="hero-card wallet-balance-card">
        <div className="wallet-hero-header">
          <div className="wallet-hero-icon">
            <MinimaIcon size={18} />
          </div>
          <p className="eyebrow">Primary wallet</p>
        </div>

        <div>
          <div className="wallet-amount-row">
            <MinimaIcon size={36} className="wallet-amount-icon" />
            <span className="wallet-amount-number">
              {native?.confirmed ?? (error ? "—" : "…")}
            </span>
          </div>
          <p className="wallet-amount-label">MINIMA confirmed</p>
        </div>

        {(native || error) && (
          <div className="wallet-hero-stats">
            {native && (
              <>
                <div>
                  <p className="wallet-stat-label">Unconfirmed</p>
                  <p className="wallet-stat-value">{native.unconfirmed}</p>
                </div>
                <div>
                  <p className="wallet-stat-label">Sendable</p>
                  <p className="wallet-stat-value">{native.sendable}</p>
                </div>
              </>
            )}
            {error && <p className="error-text">{error}</p>}
          </div>
        )}

        <div className="wallet-hero-actions">
          <button type="button" className="wallet-action-btn" onClick={() => setReceiveOpen(true)}>
            Receive address
          </button>
          <button type="button" className="wallet-action-btn wallet-action-btn-ghost" onClick={() => setSendOpen(true)}>
            Send payment
          </button>
        </div>
      </div>

      <Card>
        <div className="wallet-filter-row">
          <p className="eyebrow">Token holdings</p>
          <div className="subtabs">
            {(["all", "minima", "tokens"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? "active" : ""}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "minima" ? "Minima" : "Tokens"}
              </button>
            ))}
          </div>
        </div>

        {!status && !error && <p className="muted">Loading…</p>}
        {status && visible.length === 0 && <p className="muted">No tokens to display.</p>}

        {visible.length > 0 && (
          <table className="wallet-token-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Confirmed</th>
                <th>Unconfirmed</th>
                <th>Sendable</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((token) => (
                <tr key={token.tokenId}>
                  <td>
                    <span>{token.name}</span>
                    {!token.isNative && <code className="token-id">{token.tokenId}</code>}
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      {token.isNative && <MinimaIcon size={13} className="text-slate-400 shrink-0" />}
                      {token.confirmed}
                    </span>
                  </td>
                  <td>{token.unconfirmed}</td>
                  <td>{token.sendable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {receiveOpen && <ReceiveAddressModal onClose={() => setReceiveOpen(false)} />}
      {sendOpen && (
        <SendPaymentModal
          tokens={status?.tokens ?? []}
          onClose={() => setSendOpen(false)}
        />
      )}
    </Page>
  );
}

function ReceiveAddressModal({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<ReceiveAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function fetch() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    getReceiveAddress()
      .then(setResult)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetch(); }, []);

  function copyAddress() {
    const addr = result?.miniAddress || result?.address;
    if (!addr) return;
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal title="Receive address" onClose={onClose}>
      <div className="grid gap-4">
        <p className="text-sm text-slate-500">
          One of your node's 64 pre-created wallet addresses, selected at random.
          Share this address to receive MINIMA or tokens.
        </p>

        {loading && <p className="text-slate-500 text-sm">Fetching address…</p>}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="grid gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                Minima address (Mx)
              </p>
              <div className="flex items-start gap-3 rounded-2xl bg-slate-950 p-4">
                <code className="flex-1 break-all text-sm text-emerald-400 font-mono leading-relaxed">
                  {result.miniAddress}
                </code>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="shrink-0 rounded-xl border-0 bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {result.address && result.address !== result.miniAddress && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Hex address (0x)
                </p>
                <code className="block break-all rounded-xl bg-slate-100 p-3 text-xs text-slate-600 font-mono">
                  {result.address}
                </code>
              </div>
            )}

            {result.publicKey && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Public key
                </p>
                <code className="block break-all rounded-xl bg-slate-100 p-3 text-xs text-slate-600 font-mono">
                  {result.publicKey}
                </code>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={fetch}
            disabled={loading}
            className="rounded-xl border-0 bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Get another address
          </button>
        </div>
      </div>
    </Modal>
  );
}

type PollState = "idle" | "polling" | "confirmed" | "failed" | "timeout";

function SendPaymentModal({
  tokens,
  onClose,
}: {
  tokens: TokenBalance[];
  onClose: () => void;
}) {
  const { showToast } = useToast();
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
    if (!address.trim()) { setFormError("Address is required."); return; }
    const num = Number(amount);
    if (!amount || !Number.isFinite(num) || num <= 0) { setFormError("Amount must be a positive number."); return; }
    setSubmitting(true);
    try {
      const result = await sendPaymentApi({ address: address.trim(), amount: amount.trim(), tokenId });
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
  const tokenOptions = [
    { value: "0x00", label: "Minima (native)" },
    ...tokens.filter((t) => !t.isNative).map((t) => ({ value: t.tokenId, label: t.name })),
  ];

  return (
    <Modal title="Send payment" onClose={handleClose}>
      {!sent ? (
        <form onSubmit={handleSubmit} className="grid gap-4">
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

function filterTokens(tokens: TokenBalance[], filter: Filter): TokenBalance[] {
  if (filter === "minima") return tokens.filter((t) => t.isNative);
  if (filter === "tokens") return tokens.filter((t) => !t.isNative);
  return tokens;
}
