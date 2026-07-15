export type DataSourceRead = {
  id: string;
  createdAt: string;
  dataSourceId: string | null;
  workflowId: string | null;
  integritasProofId: string | null;
  sourceName: string;
  sourceUrl: string;
  triggerType: "manual" | "automation" | "webhook" | "mqtt" | "gpio" | "schedule";
  status: "success" | "failed";
  hash: string | null;
  preview: unknown;
  error: string | null;
  triggerSourceId: string | null;
  triggerPayload: unknown;
  blockId: string | null;
};
