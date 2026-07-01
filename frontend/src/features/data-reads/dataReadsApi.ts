import { getJson } from "../../lib/api";
import { buildListQueryString, type ListQueryParams, type PaginatedResponse } from "../../lib/paginated";
import type { DataSourceRead } from "./dataReadTypes";

export async function listDataReads(params: ListQueryParams = { page: 1, pageSize: 50 }) {
  return getJson<PaginatedResponse<DataSourceRead>>(`/api/data-reads${buildListQueryString(params)}`);
}
