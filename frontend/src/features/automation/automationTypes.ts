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
  blocks: AutomationBlock[];
  rules: AutomationRule[];
};

export type AutomationBlockType =
  | "manual_start"
  | "schedule_start"
  | "gpio_event_start"
  | "webhook_event_start"
  | "mqtt_event_start"
  | "record_trigger_event"
  | "fetch_data_source"
  | "wait"
  | "stamp_integritas";

export type AutomationBlock = {
  id: string;
  workflowId: string;
  createdAt: string;
  updatedAt: string;
  type: AutomationBlockType;
  enabled: boolean;
  order: number;
  config: {
    sourceId?: string;
    intervalSeconds?: number;
    durationMs?: number;
    activeOnly?: boolean;
  };
  lastRunAt: string | null;
  lastError: string | null;
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
