export type ParsedListQuery = {
  page: number;
  pageSize: number;
  status?: string;
  q?: string;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ListQueryInput = {
  page?: string;
  pageSize?: string;
  status?: string;
  q?: string;
};

type ParseListQueryOptions = {
  defaultPageSize?: number;
  minPageSize?: number;
  maxPageSize?: number;
  allowedStatuses?: readonly string[];
};

export function parseListQuery(
  query: ListQueryInput,
  options: ParseListQueryOptions = {},
): { ok: true; value: ParsedListQuery } | { ok: false; error: string } {
  const defaultPageSize = options.defaultPageSize ?? 50;
  const minPageSize = options.minPageSize ?? 10;
  const maxPageSize = options.maxPageSize ?? 100;

  const rawPage = query.page ? Number(query.page) : 1;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : 1;

  const rawPageSize = query.pageSize ? Number(query.pageSize) : defaultPageSize;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.min(maxPageSize, Math.max(minPageSize, Math.trunc(rawPageSize)))
    : defaultPageSize;

  const status = typeof query.status === "string" ? query.status.trim() : "";
  if (status && options.allowedStatuses && !options.allowedStatuses.includes(status)) {
    return { ok: false, error: `status must be one of: ${options.allowedStatuses.join(", ")}` };
  }

  const q = typeof query.q === "string" ? query.q.trim() : "";
  if (q.length > 200) {
    return { ok: false, error: "q must be 200 characters or fewer" };
  }

  return {
    ok: true,
    value: {
      page,
      pageSize,
      ...(status ? { status } : {}),
      ...(q ? { q } : {}),
    },
  };
}

export function toPaginatedResult<T>(
  items: T[],
  total: number,
  query: Pick<ParsedListQuery, "page" | "pageSize">,
): PaginatedResult<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
  };
}
