import { useState } from "react";
import type { MinimaPeersResponse } from "../../app/types";
import { Card } from "../../components/Card";

export function MinimaPeersCard({
  peers,
  loading,
  busy,
  onAddPeer
}: {
  peers: MinimaPeersResponse | null;
  loading: boolean;
  busy: boolean;
  onAddPeer: (peerslist: string) => Promise<void>;
}) {
  const [peerslistInput, setPeerslistInput] = useState("megammr.minima.global:9001");
  const peerItems = peers?.peers ?? [];
  const countLabel =
    peers?.count != null ? `${peers.count} connected` : loading ? "Checking…" : "Unavailable";

  async function handleAddPeer() {
    await onAddPeer(peerslistInput);
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 font-semibold text-slate-950">Peer connections</h3>
          <p className="mt-1 mb-0 text-sm text-slate-500">{countLabel}</p>
        </div>
      </div>

      {peerItems.length > 0 ? (
        <ul className="mt-4 mb-0 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {peerItems.map((peer) => (
            <li key={peer}>
              <code className="text-slate-800">{peer}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 mb-0 text-sm text-slate-500">
          {loading ? "Loading peer list…" : "No peers returned from Minima RPC."}
        </p>
      )}

      <div className="mt-5 grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="minima-peer-input">
          Add peers
        </label>
        <input
          id="minima-peer-input"
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          value={peerslistInput}
          onChange={(event) => setPeerslistInput(event.target.value)}
          placeholder="host:port or host:port,host:port"
          disabled={busy}
        />
        <button
          type="button"
          className="w-fit rounded-[14px] border-0 bg-slate-950 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={busy || !peerslistInput.trim()}
          onClick={() => {
            handleAddPeer().catch(() => undefined);
          }}
        >
          Add peers
        </button>
        <p className="m-0 text-xs leading-5 text-slate-500">
          Uses Minima <code className="text-slate-700">peers action:addpeers</code>. Comma-separate multiple
          addresses.
        </p>
      </div>
    </Card>
  );
}
