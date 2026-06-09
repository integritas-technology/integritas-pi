export type DataSource = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  type: "json-api" | "internal-json-api";
  status: string;
  description: string | null;
  config: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    healthStatusUrl?: string;
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
  config: DataSource["config"];
};

export type DataSourceHealthStatus = {
  ok: boolean;
  status?: number;
  source?: string;
  body?: unknown;
  checkedAt?: string;
  error?: string;
};
