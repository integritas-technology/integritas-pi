export type AutomationWorkflow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  enabled: boolean;
  archived: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastHash: string | null;
  lastProofId: string | null;
  lastError: string | null;
  lastErrorDetails?: unknown;
  blocks: AutomationBlock[];
};

export type AutomationBlockType =
  | "manual_start"
  | "schedule_start"
  | "gpio_event_start"
  | "webhook_event_start"
  | "mqtt_event_start"
  | "record_trigger_event"
  | "fetch_data_source"
  | "capture_camera"
  | "set_variable"
  | "if_payload_field_equals"
  | "wait"
  | "stamp_integritas"
  | "control_output"
  | "send_transaction";

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
    action?: "pulse" | "send_request" | "publish";
    recipientAddressBookId?: string;
    tokenId?: "0x00";
    amount?: string;
    intervalSeconds?: number;
    durationMs?: number;
    bodyMode?: "custom" | "workflow_context" | "trigger_payload" | "latest_data" | "none";
    bodyTemplateText?: string;
    bodyTemplate?: unknown;
    variableName?: string;
    variableSource?: "custom_json" | "trigger_field" | "latest_data_field" | "context_field";
    valueJsonText?: string;
    activeOnly?: boolean;
    source?: "trigger" | "variable";
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
  lastErrorDetails?: unknown;
};

export type AutomationRun = {
  id: string;
  workflowId: string | null;
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
  errorDetails?: unknown;
  blocks: AutomationBlockRun[];
};

export type AutomationBlockRun = {
  id: string;
  runId: string;
  workflowId: string | null;
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
  errorDetails?: unknown;
};

export type AutomationValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  blockId?: string;
  blockType?: string;
};

export type AutomationValidationResult = {
  ok: boolean;
  errors: AutomationValidationIssue[];
  warnings: AutomationValidationIssue[];
};

