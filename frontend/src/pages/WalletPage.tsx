import { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { MinimaIcon } from "../components/MinimaIcon";
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
    </Page>
  );
}

function filterTokens(tokens: TokenBalance[], filter: Filter): TokenBalance[] {
  if (filter === "minima") return tokens.filter((t) => t.isNative);
  if (filter === "tokens") return tokens.filter((t) => !t.isNative);
  return tokens;
}
