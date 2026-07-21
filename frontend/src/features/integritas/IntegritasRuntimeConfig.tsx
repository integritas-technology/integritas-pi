import { ExternalLink } from "lucide-react";
import type { IntegritasConfig } from "../../app/types";
import { StatusBadge } from "../../components/StatusBadge";

function ConfigDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
      <dt className="m-0 text-sm font-medium text-slate-500">{label}</dt>
      <dd className="m-0 font-mono text-sm text-slate-800 break-all">
        {value}
      </dd>
    </div>
  );
}

export function IntegritasRuntimeConfig({
  config,
}: {
  config: IntegritasConfig | null;
}) {
  const portalUrl = config?.portalUrl;
  const connected = config?.apiKeySource === "connect";

  return (
    <section className="grid min-w-0 gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="m-0 text-sm font-semibold text-slate-900">
            Runtime configuration
          </h4>
          <StatusBadge ok={connected}>
            {connected
              ? "Integritas Connect linked"
              : "Integritas Connect not linked"}
          </StatusBadge>
        </div>
        <dl className="m-0 grid gap-3">
          <ConfigDetail
            label="baseUrl"
            value={config?.baseUrl ?? "loading..."}
          />
          <ConfigDetail
            label="requestId"
            value={config?.requestId ?? "loading..."}
          />
          <ConfigDetail
            label="apiKeySource"
            value={config?.apiKeySource ?? "loading..."}
          />
        </dl>
      </div>

      {portalUrl && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <a
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 underline-offset-2 hover:underline"
            href={portalUrl}
            target="_blank"
            rel="noreferrer"
          >
            View API usage in Integritas portal
            <ExternalLink
              size={14}
              aria-hidden
            />
          </a>
        </div>
      )}
    </section>
  );
}
