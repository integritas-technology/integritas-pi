export type DiagnosticsTab = "proofs" | "reads";

const VALID_TABS = new Set<DiagnosticsTab>(["proofs", "reads"]);

export function isValidDiagnosticsTab(value: string | null): value is DiagnosticsTab {
  return value !== null && VALID_TABS.has(value as DiagnosticsTab);
}

export function parseDiagnosticsTab(searchParams: URLSearchParams): DiagnosticsTab {
  const raw = searchParams.get("tab");
  return raw === "reads" ? "reads" : "proofs";
}

export function diagnosticsTabToSearchParams(
  tab: DiagnosticsTab,
  current?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (tab === "proofs") {
    next.delete("tab");
  } else {
    next.set("tab", tab);
  }
  return next;
}
