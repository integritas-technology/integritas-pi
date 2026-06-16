export function formatSize(size?: number) {
  if (size === undefined) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** Trim noisy Minima decimal strings for display (e.g. 0.006000000… → 0.006). */
export function formatMinimaAmount(value: string, maxDecimals = 6): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === ".") return "0";
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [intPart = "0", fracPart = ""] = unsigned.split(".");
  const clipped = fracPart.slice(0, maxDecimals).replace(/0+$/, "");
  const formatted = clipped ? `${intPart || "0"}.${clipped}` : (intPart || "0");
  return negative ? `-${formatted}` : formatted;
}
