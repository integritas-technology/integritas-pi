import { useEffect, useState } from "react";
import type { MinimaCommandResult } from "../app/types";
import { Card } from "../components/Card";
import { JsonPreview } from "../components/JsonPreview";
import { Page } from "../components/Page";
import { StatusBadge } from "../components/StatusBadge";

type BalanceToken = {
  token?: string;
  tokenid?: string;
  confirmed?: string;
  unconfirmed?: string;
  sendable?: string;
};

export function WalletPage() {
  const [balance, setBalance] = useState<MinimaCommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/minima/balance")
      .then(async (response) => {
        const parsed = await response.json();
        if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
        return parsed as MinimaCommandResult;
      })
      .then(setBalance)
      .catch((err: Error) => setError(err.message));
  }, []);

  const minimaBalance = getMinimaBalance(balance);

  return (
    <Page eyebrow="Wallet" title="Wallet and tokens" desc="Read wallet balance through the backend and Minima RPC.">
      <Card className="wallet-balance-card">
        <div className="status-row">
          <div>
            <strong>Balance</strong>
            <p className="muted">Confirmed Minima wallet balance.</p>
          </div>
          <StatusBadge ok={Boolean(balance?.ok && !error)}>{balance ? `HTTP ${balance.status}` : error ? "error" : "checking"}</StatusBadge>
        </div>

        <div className="wallet-balance-value">
          <span>Confirmed</span>
          <strong>{minimaBalance?.confirmed ?? "loading..."}</strong>
          <p className="muted">{minimaBalance?.token ?? "Minima"}</p>
        </div>

        {error && <p className="error-text">{error}</p>}
        {balance && <JsonPreview value={balance.body ?? balance} label="View balance JSON" />}
      </Card>
    </Page>
  );
}

function getMinimaBalance(result: MinimaCommandResult | null) {
  const body = result?.body;
  if (!body || typeof body !== "object" || !("response" in body) || !Array.isArray((body as { response?: unknown }).response)) return null;
  return ((body as { response: BalanceToken[] }).response.find((item) => item.tokenid === "0x00") ?? (body as { response: BalanceToken[] }).response[0]) ?? null;
}
