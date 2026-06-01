import { Page } from "../components/Page";
import { FilesPanel } from "../features/files/FilesPanel";

export function DataSourcesPage() {
  return (
    <Page eyebrow="Data Sources" title="Local data access" desc="Current implementation: read-only file explorer for the configured host directory.">
      <FilesPanel />
    </Page>
  );
}
