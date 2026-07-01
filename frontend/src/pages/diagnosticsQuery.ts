export type DiagnosticsTab = "proofs" | "reads";

const VALID_TABS = new Set<DiagnosticsTab>(["proofs", "reads"]);

export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const PROOF_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
] as const;

export const READ_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
] as const;

export type DiagnosticsListQuery = {
  page: number;
  pageSize: number;
  status: string;
  q: string;
};

export function isValidDiagnosticsTab(value: string | null): value is DiagnosticsTab {
  return value !== null && VALID_TABS.has(value as DiagnosticsTab);
}

export function parseDiagnosticsTab(searchParams: URLSearchParams): DiagnosticsTab {
  const raw = searchParams.get("tab");
  return raw === "reads" ? "reads" : "proofs";
}

export function defaultDiagnosticsListQuery(): DiagnosticsListQuery {
  return { page: 1, pageSize: DEFAULT_PAGE_SIZE, status: "", q: "" };
}

export function parseDiagnosticsListQuery(
  searchParams: URLSearchParams,
  tab: DiagnosticsTab,
): DiagnosticsListQuery {
  const defaults = defaultDiagnosticsListQuery();
  const rawPage = Number(searchParams.get("page"));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : defaults.page;

  const rawPageSize = Number(searchParams.get("pageSize"));
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(100, Math.max(10, Math.trunc(rawPageSize)))
    : defaults.pageSize;

  const rawStatus = searchParams.get("status")?.trim() ?? "";
  const allowedStatuses = tab === "proofs"
    ? ["pending", "ready", "failed"]
    : ["success", "failed"];
  const status = allowedStatuses.includes(rawStatus) ? rawStatus : "";

  const q = (searchParams.get("q") ?? "").trim().slice(0, 200);

  return { page, pageSize, status, q };
}

export function diagnosticsSearchParams(input: {
  tab: DiagnosticsTab;
  query: DiagnosticsListQuery;
}): URLSearchParams {
  const next = new URLSearchParams();
  if (input.tab === "reads") next.set("tab", "reads");
  if (input.query.page > 1) next.set("page", String(input.query.page));
  if (input.query.pageSize !== DEFAULT_PAGE_SIZE) next.set("pageSize", String(input.query.pageSize));
  if (input.query.status) next.set("status", input.query.status);
  if (input.query.q) next.set("q", input.query.q);
  return next;
}
