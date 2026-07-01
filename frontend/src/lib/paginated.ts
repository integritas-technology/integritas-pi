export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ListQueryParams = {
  page?: number;
  pageSize?: number;
  status?: string;
  q?: string;
};

export function buildListQueryString(params: ListQueryParams = {}): string {
  const search = new URLSearchParams();
  if (params.page && params.page > 1) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  const value = search.toString();
  return value ? `?${value}` : "";
}

export function listRangeLabel(page: number, pageSize: number, total: number) {
  if (total === 0) return "Showing 0 of 0";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `Showing ${start}–${end} of ${total}`;
}

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
