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
  rules: AutomationRule[];
};

export type AutomationRule = {
  id: string;
  workflowId: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  type: "collect_data" | "stamp_integritas";
  enabled: boolean;
  order: number;
  when: unknown;
  condition: unknown;
  then: unknown;
  lastRunAt: string | null;
  lastError: string | null;
};
