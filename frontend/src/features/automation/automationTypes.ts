export type AutomationWorkflow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  dataSourceId: string;
  enabled: boolean;
  pollingIntervalSeconds: number;
  stampWithIntegritas: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastHash: string | null;
  lastProofId: string | null;
  lastError: string | null;
};
