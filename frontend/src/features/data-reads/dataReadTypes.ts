export type DataSourceRead = {
  id: string;
  createdAt: string;
  dataSourceId: string;
  workflowId: string | null;
  integritasProofId: string | null;
  sourceName: string;
  sourceUrl: string;
  triggerType: "manual" | "automation" | "webhook";
  status: "success" | "failed";
  hash: string | null;
  preview: unknown;
  error: string | null;
};
