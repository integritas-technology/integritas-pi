export type IntegritasStatusItem = {
  uid?: string;
  onchain?: boolean;
  address?: string;
  data?: string;
  proof?: string;
  root?: string;
  status?: boolean;
  error?: string;
};

export type IntegritasErrorCode =
  | "upstream_unavailable"
  | "rate_limited"
  | "unauthorized"
  | "stamp_failed"
  | "status_failed"
  | "verify_failed";

export type IntegritasOperation = "stamp" | "status" | "verify";

export type IntegritasApiFailure = {
  ok: false;
  status: number;
  error: string;
  errorCode: IntegritasErrorCode;
  responseBody: unknown;
  retryAfter?: string;
};
