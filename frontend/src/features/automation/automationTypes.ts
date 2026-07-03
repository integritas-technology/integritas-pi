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
  | "if_payload_field_equals"
  | "wait"
  | "stamp_integritas"
  | "control_output";

export type ConditionOperator = "equals" | "not_equals" | "greater_than" | "greater_than_or_equals" | "less_than" | "less_than_or_equals" | "exists" | "does_not_exist";

export type AutomationBlock = {
  id: string;
  workflowId: string;
  createdAt: string;
  updatedAt: string;
  type: AutomationBlockType;
  enabled: boolean;
  order: number;
  parentBlockId: string | null;
  config: {
    sourceId?: string;
    targetId?: string;
    action?: "pulse";
    intervalSeconds?: number;
    durationMs?: number;
    activeOnly?: boolean;
    source?: "trigger" | "data";
    fieldPath?: string;
    operator?: ConditionOperator;
    value?: unknown;
    condition?: {
      source?: "trigger" | "data";
      fieldPath: string;
      operator: ConditionOperator;
      value?: unknown;
    } | null;
  };
  lastRunAt: string | null;
  lastError: string | null;
};

export type AutomationRun = {
  id: string;
  workflowId: string;
  workflowName: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "failed";
  triggerType: string;
  triggerSourceId: string | null;
  triggerPayload: unknown;
  durationMs: number | null;
  blockCount: number;
  error: string | null;
  blocks: AutomationBlockRun[];
};

export type AutomationBlockRun = {
  id: string;
  runId: string;
  workflowId: string;
  blockId: string | null;
  order: number;
  blockType: string;
  blockLabel: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "failed" | "skipped";
  durationMs: number | null;
  input: unknown;
  output: unknown;
  error: string | null;
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
