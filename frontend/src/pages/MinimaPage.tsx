import { useEffect, useState } from "react";
import type { MinimaStatus } from "../app/types";
import { Card } from "../components/Card";
import { JsonPreview } from "../components/JsonPreview";
import { Page } from "../components/Page";
import { StatusBadge } from "../components/StatusBadge";

export function MinimaPage() {
  const [minimaStatus, setMinimaStatus] = useState<MinimaStatus | null>(null);
  const [minimaError, setMinimaError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/minima/status")
      .then((response) => response.json() as Promise<MinimaStatus>)
      .then(setMinimaStatus)
      .catch((err: Error) => setMinimaError(err.message));
  }, []);

  return (
    <Page eyebrow="Minima Core" title="Run the Minima node" desc="Read Minima node status through the backend and Docker network.">
      <Card>
        <div className="status-row"><strong>Minima status</strong><StatusBadge ok={Boolean(minimaStatus?.ok)}>{minimaStatus ? `HTTP ${minimaStatus.status}` : minimaError ? "error" : "checking"}</StatusBadge></div>
        {minimaStatus?.source && <code>{minimaStatus.source}</code>}
        {minimaStatus?.error && <p className="error-text">{minimaStatus.error}</p>}
        {minimaStatus?.body !== undefined && <JsonPreview value={minimaStatus.body} />}
      </Card>
    </Page>
  );
}
