import { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { Page } from "../components/Page";
import { getWalletStatus } from "../features/wallet/walletApi";
import type { TokenBalance, WalletStatus } from "../features/wallet/walletTypes";

type Filter = "all" | "minima" | "tokens";

export function WalletPage() {
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    getWalletStatus().then(setStatus).catch((err: Error) => setError(err.message));
  }, []);

  const native = status?.tokens.find((t) => t.isNative) ?? null;
  const visible = filterTokens(status?.tokens ?? [], filter);

  return (
    <Page eyebrow="Wallet" title="Wallet and tokens" desc="Minima wallet balance and token holdings for this node.">
      <Card className="wallet-balance-card">
        <div className="wallet-balance-header">
          <div>
            <p className="eyebrow">Primary wallet</p>
            <p className="wallet-balance-amount">{native?.confirmed ?? (error ? "—" : "…")}</p>
            <p className="muted">MINIMA confirmed</p>
          </div>
          <div className="wallet-balance-meta">
            {native && (
              <>
                <p className="muted">Unconfirmed: {native.unconfirmed}</p>
                <p className="muted">Sendable: {native.sendable}</p>
              </>
            )}
            {error && <p className="error-text">{error}</p>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="wallet-filter-header">
          <p className="eyebrow">Token holdings</p>
          <div className="wallet-filter-tabs">
            {(["all", "minima", "tokens"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? "pill pill-active" : "pill"}
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
                  <td>{token.confirmed}</td>
                  <td>{token.unconfirmed}</td>
                  <td>{token.sendable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Page>
  );
}

function filterTokens(tokens: TokenBalance[], filter: Filter): TokenBalance[] {
  if (filter === "minima") return tokens.filter((t) => t.isNative);
  if (filter === "tokens") return tokens.filter((t) => !t.isNative);
  return tokens;
}
