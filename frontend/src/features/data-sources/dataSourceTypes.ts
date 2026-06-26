export type DataSource = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  type: "json-api" | "internal-json-api" | "webhook" | "mqtt" | "gpio-input";
  status: string;
  description: string | null;
  config: {
    url?: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    healthStatusUrl?: string;
    webhookToken?: string;
    brokerUrl?: string;
    topic?: string;
    chip?: string;
    pin?: number;
    pull?: "off" | "up" | "down";
    edge?: "rising" | "falling" | "both";
    debounceMs?: number;
    activeState?: "high" | "low";
    body?: unknown;
  };
  lastReadAt: string | null;
  lastError: string | null;
  lastPreview: unknown;
  lastHash: string | null;
};

export type DataSourceTemplate = {
  title: string;
  description: string;
  type: DataSource["type"];
  config: Partial<DataSource["config"]>;
};

export type DataSourceHealthStatus = {
  ok: boolean;
  status?: number;
  source?: string;
  body?: unknown;
  checkedAt?: string;
  error?: string;
};

export type DataSourceCapabilities = {
  gpioInput: {
    available: boolean;
    devicePath: string;
    reason: string | null;
  };
};
