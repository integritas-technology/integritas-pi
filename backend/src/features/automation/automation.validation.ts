import { getAddressBookEntryById } from "../address-book/address-book.repository.js";
import { getDataSource } from "../data-sources/dataSources.repository.js";
import { parseGpioOutputConfig } from "../data-sources/dataSources.service.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { getWalletStatus } from "../wallet/wallet.service.js";
import { listAutomationBlocks, type AutomationBlockType } from "./automation.repository.js";

export type AutomationValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  blockId?: string;
  blockType?: AutomationBlockType;
};

export type AutomationValidationResult = {
  ok: boolean;
  errors: AutomationValidationIssue[];
  warnings: AutomationValidationIssue[];
};

export type AutomationDraftValidationBlock = {
  clientId?: string | null;
  type: AutomationBlockType;
  enabled?: boolean;
  parentBlockId?: string | null;
  config: BlockConfig;
};

type ValidationBlock = {
  id: string;
  type: AutomationBlockType;
  enabled: boolean;
  parentId: string | null;
  config: BlockConfig;
};

export type BlockConfig = {
  sourceId?: string;
  targetId?: string;
  action?: string;
  durationMs?: number;
  bodyMode?: string;
  bodyTemplateText?: string;
  bodyTemplate?: unknown;
  variableName?: string;
  variableSource?: string;
  valueJsonText?: string;
  source?: "trigger" | "data";
  fieldPath?: string;
  operator?: string;
  value?: unknown;
  condition?: { source?: "trigger" | "data" } | null;
  recipientAddressBookId?: string;
  tokenId?: string;
  amount?: string;
};

export async function validateAutomationWorkflow(workflowId: string): Promise<AutomationValidationResult> {
  const blocks = listAutomationBlocks(workflowId).map((block): ValidationBlock => ({
    id: block.id,
    type: block.type,
    enabled: Boolean(block.enabled),
    parentId: block.parent_block_id,
    config: parseConfig(block)
  }));
  return validateAutomationBlockGraph(blocks);
}

export async function validateAutomationDraft(blocks: AutomationDraftValidationBlock[]): Promise<AutomationValidationResult> {
  return validateAutomationBlockGraph(blocks.map((block, index): ValidationBlock => ({
    id: block.clientId || `draft-${index}`,
    type: block.type,
    enabled: block.enabled !== false,
    parentId: block.parentBlockId ?? null,
    config: block.config
  })));
}

async function validateAutomationBlockGraph(blocks: ValidationBlock[]): Promise<AutomationValidationResult> {
  const issues: AutomationValidationIssue[] = [];
  const mainBlocks = blocks.filter((block) => !block.parentId);
  const startBlock = mainBlocks[0];

  if (mainBlocks.length === 0) {
    addIssue(issues, "error", "workflow.no_blocks", "Workflow has no blocks.");
  } else if (!startBlock.type.endsWith("_start")) {
    addIssue(issues, "error", "workflow.missing_start", "The first workflow block must be a start block.", startBlock);
  }

  if (mainBlocks.slice(1).some((block) => block.type.endsWith("_start"))) {
    addIssue(issues, "error", "workflow.multiple_starts", "Only the first workflow block can be a start block.");
  }

  if (startBlock && !startBlock.enabled) {
    addIssue(issues, "error", "workflow.start_disabled", "The start block is disabled, so this workflow cannot run.", startBlock);
  }

  if (blocks.filter((block) => block.enabled && !block.type.endsWith("_start") && !block.parentId).length === 0) {
    addIssue(issues, "warning", "workflow.no_enabled_actions", "Workflow has no enabled action blocks after the start block.");
  }

  let hasData = false;
  const startType = startBlock?.type;
  const startConfig = startBlock?.config ?? {};

  for (const block of mainBlocks) {
    if (!block.enabled) continue;
    const config = block.config;

    validateBlockReference(block, config, issues);

    if (block.type === "record_trigger_event") {
      if (startType !== "gpio_event_start" && startType !== "webhook_event_start" && startType !== "mqtt_event_start") {
        addIssue(issues, "error", "record_trigger_event.requires_event_start", "Record trigger event requires a GPIO, webhook, or MQTT event start block.", block);
      }
      if (!startConfig.sourceId) addIssue(issues, "error", "record_trigger_event.missing_source", "Record trigger event requires the start block to reference a device/source.", block);
      hasData = true;
    }

    if (block.type === "fetch_data_source") {
      hasData = true;
    }

    if (block.type === "set_variable") {
      validateSetVariableBlock(block, config, hasData, issues);
    }

    if (block.type === "if_payload_field_equals" && (config.source ?? "trigger") === "data" && !hasData) {
      addIssue(issues, "error", "condition.data_before_data_block", "This condition reads Data, but no enabled record/fetch block runs before it.", block);
    }

    for (const attachedBlock of blocks.filter((item) => item.enabled && item.parentId === block.id)) {
      const attachedConfig = attachedBlock.config;
      if (attachedBlock.type !== "stamp_integritas") {
        addIssue(issues, "error", "attached.unsupported", "Only Integritas stamp blocks can be attached to another block.", attachedBlock);
        continue;
      }
      if (block.type !== "record_trigger_event" && block.type !== "fetch_data_source") {
        addIssue(issues, "error", "stamp_integritas.invalid_parent", "Integritas stamps must be attached to a record or fetch block.", attachedBlock);
      }
      if (!hasData) {
        addIssue(issues, "error", "stamp_integritas.no_hash", "Integritas stamping requires a prior record/fetch block that creates a hash.", attachedBlock);
      }
      if (attachedConfig.condition && (attachedConfig.condition.source ?? "data") === "data" && !hasData) {
        addIssue(issues, "error", "stamp_integritas.condition_data_before_data_block", "Stamp condition reads Data, but no data is available before this stamp.", attachedBlock);
      }
      if (!getIntegritasApiKey()) {
        addIssue(issues, "warning", "stamp_integritas.no_api_key", "Integritas API key is not configured; this stamp block will fail until a key is saved.", attachedBlock);
      }
    }
  }

  await validateTransactionBalances(blocks.filter((block) => block.enabled), issues);

  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  return { ok: errors.length === 0, errors, warnings };
}

function validateBlockReference(block: ValidationBlock, config: BlockConfig, issues: AutomationValidationIssue[]) {
  if (block.type === "gpio_event_start" || block.type === "webhook_event_start" || block.type === "mqtt_event_start" || block.type === "fetch_data_source") {
    const source = config.sourceId ? getDataSource(config.sourceId) : undefined;
    if (!source) {
      addIssue(issues, "error", `${block.type}.missing_source`, "Block references a missing device/source.", block);
      return;
    }
    if (block.type === "gpio_event_start" && source.type !== "gpio-input") addIssue(issues, "error", "gpio_event_start.invalid_source", "GPIO start requires a GPIO input source.", block);
    if (block.type === "webhook_event_start" && source.type !== "webhook") addIssue(issues, "error", "webhook_event_start.invalid_source", "Webhook start requires a webhook source.", block);
    if (block.type === "mqtt_event_start" && source.type !== "mqtt") addIssue(issues, "error", "mqtt_event_start.invalid_source", "MQTT start requires an MQTT source.", block);
    if (block.type === "fetch_data_source" && (source.type === "gpio-input" || source.type === "gpio-output" || source.type === "webhook" || source.type === "mqtt" || source.type === "http-output" || source.type === "mqtt-output")) addIssue(issues, "error", "fetch_data_source.invalid_source", "Fetch block requires an HTTP JSON source.", block);
  }

  if (block.type === "control_output") {
    const target = config.targetId ? getDataSource(config.targetId) : undefined;
    if (!target || !isOutputTarget(target.type)) {
      addIssue(issues, "error", "control_output.missing_target", "Control output references a missing or non-output device.", block);
      return;
    }
    if (target.type === "gpio-output") {
      const targetConfig = parseGpioOutputConfig(JSON.parse(target.config) as unknown);
      if (targetConfig.profile !== "led") addIssue(issues, "error", "control_output.unsupported_profile", "Only LED output targets are supported.", block);
      addIssue(issues, "warning", "control_output.hardware", "Control output drives GPIO hardware. Verify wiring and test pulse before enabling this workflow.", block);
    }
    if (target.type === "http-output") addIssue(issues, "warning", "control_output.http", "Control output sends an HTTP request to the configured target when this workflow runs.", block);
    if (target.type === "mqtt-output") addIssue(issues, "warning", "control_output.mqtt", "Control output publishes an MQTT message to the configured broker/topic when this workflow runs.", block);
    validateOutputBodyConfig(block, config, target.type, issues);
  }

  if (block.type === "send_transaction") {
    const recipient = config.recipientAddressBookId ? getAddressBookEntryById(config.recipientAddressBookId) : null;
    if (!recipient) addIssue(issues, "error", "send_transaction.missing_recipient", "Send transaction references a missing address book recipient.", block);
    if (String(config.tokenId ?? "0x00").toLowerCase() !== "0x00") addIssue(issues, "error", "send_transaction.unsupported_token", "Send transaction currently supports only native MINIMA tokenid 0x00.", block);
    if (!isPositiveDecimal(String(config.amount ?? ""))) addIssue(issues, "error", "send_transaction.invalid_amount", "Send transaction requires a positive amount.", block);
    addIssue(issues, "warning", "send_transaction.moves_funds", "This block sends wallet funds automatically when the workflow runs.", block);
  }
}

function isOutputTarget(type: string) {
  return type === "gpio-output" || type === "http-output" || type === "mqtt-output";
}

function validateOutputBodyConfig(block: ValidationBlock, config: BlockConfig, targetType: string, issues: AutomationValidationIssue[]) {
  if (targetType !== "http-output" && targetType !== "mqtt-output") return;
  const bodyMode = String(config.bodyMode ?? "workflow_context");
  if (bodyMode !== "custom" && bodyMode !== "workflow_context" && bodyMode !== "trigger_payload" && bodyMode !== "latest_data" && bodyMode !== "none") {
    addIssue(issues, "error", "control_output.invalid_body_mode", "Output body mode is invalid.", block);
  }
  if (targetType === "mqtt-output" && bodyMode === "none") addIssue(issues, "error", "control_output.mqtt_body_required", "MQTT output requires a message payload.", block);
  if (bodyMode === "custom") {
    const text = typeof config.bodyTemplateText === "string" ? config.bodyTemplateText : JSON.stringify(config.bodyTemplate ?? {});
    try {
      JSON.parse(text) as unknown;
    } catch {
      addIssue(issues, "error", "control_output.invalid_custom_body", "Custom output body must be valid JSON.", block);
    }
  }
}

function validateSetVariableBlock(block: ValidationBlock, config: BlockConfig, hasData: boolean, issues: AutomationValidationIssue[]) {
  const variableName = String(config.variableName ?? "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variableName)) addIssue(issues, "error", "set_variable.invalid_name", "Set variable requires a valid variable name.", block);
  const variableSource = String(config.variableSource ?? "custom_json");
  if (variableSource !== "custom_json" && variableSource !== "trigger_field" && variableSource !== "latest_data_field" && variableSource !== "context_field") addIssue(issues, "error", "set_variable.invalid_source", "Set variable source is invalid.", block);
  if (variableSource === "latest_data_field" && !hasData) addIssue(issues, "error", "set_variable.data_before_data_block", "Latest data variables require a Record trigger event or Fetch data block before this block.", block);
  if (variableSource === "custom_json") {
    try {
      JSON.parse(config.valueJsonText ?? "null") as unknown;
    } catch {
      addIssue(issues, "error", "set_variable.invalid_json", "Variable custom JSON must be valid JSON.", block);
    }
    return;
  }
  const fieldPath = String(config.fieldPath ?? "").trim();
  if (!fieldPath) addIssue(issues, "error", "set_variable.missing_field_path", "Set variable field source requires a field path.", block);
  if (fieldPath && !/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(fieldPath)) addIssue(issues, "error", "set_variable.invalid_field_path", "Field path can only contain letters, numbers, underscores, dashes, and dots.", block);
}

async function validateTransactionBalances(blocks: ValidationBlock[], issues: AutomationValidationIssue[]) {
  const transactionBlocks = blocks.filter((block) => block.type === "send_transaction");
  if (transactionBlocks.length === 0) return;

  try {
    const wallet = await getWalletStatus();
    const nativeToken = wallet.tokens.find((token) => token.isNative || token.tokenId.toLowerCase() === "0x00");
    if (!nativeToken) {
      for (const block of transactionBlocks) addIssue(issues, "error", "send_transaction.no_native_balance", "Wallet does not report a native MINIMA balance.", block);
      return;
    }
    for (const block of transactionBlocks) {
      const amount = String(block.config.amount ?? "").trim();
      if (isPositiveDecimal(amount) && compareDecimalStrings(amount, nativeToken.sendable) > 0) {
        addIssue(issues, "error", "send_transaction.insufficient_balance", `Amount exceeds available balance (${nativeToken.sendable} MINIMA).`, block);
      }
    }
  } catch (error) {
    for (const block of transactionBlocks) {
      addIssue(issues, "error", "send_transaction.wallet_unavailable", `Wallet balance could not be checked: ${error instanceof Error ? error.message : "unknown error"}.`, block);
    }
  }
}

function parseConfig(block: { config_json: string }) {
  return JSON.parse(block.config_json) as BlockConfig;
}

function addIssue(issues: AutomationValidationIssue[], level: AutomationValidationIssue["level"], code: string, message: string, block?: ValidationBlock) {
  issues.push({ level, code, message, blockId: block?.id, blockType: block?.type });
}

function isPositiveDecimal(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
  return compareDecimalStrings(trimmed, "0") > 0;
}

function compareDecimalStrings(a: string, b: string) {
  const normalize = (value: string) => {
    const trimmed = value.trim();
    const [intPart = "0", fracPart = ""] = trimmed.split(".");
    return {
      int: intPart.replace(/^0+(?=\d)/, "") || "0",
      frac: fracPart
    };
  };
  const aNorm = normalize(a);
  const bNorm = normalize(b);
  const fracLen = Math.max(aNorm.frac.length, bNorm.frac.length);
  const aCombined = `${aNorm.int}${aNorm.frac.padEnd(fracLen, "0")}`;
  const bCombined = `${bNorm.int}${bNorm.frac.padEnd(fracLen, "0")}`;
  if (aCombined === bCombined) return 0;
  return BigInt(aCombined) > BigInt(bCombined) ? 1 : -1;
}
