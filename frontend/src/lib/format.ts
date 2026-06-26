export function formatSize(size?: number) {
  if (size === undefined) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Trim noisy Minima decimal strings for display (e.g. 0.006000000… → 0.006).
 * Use formatAmountAdaptive on wallet page, formatAmountThreshold on dashboard.
 */
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

/**
 * Show full precision with trailing zeros trimmed — no decimal cap.
 * Used on the wallet page where the layout can wrap.
 * E.g. 0.00000001 → "0.00000001", 0.123456789 → "0.123456789", 100.10 → "100.1".
 */
export function formatAmountAdaptive(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '.') return '0';
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;

  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [intPart = '0', fracPart = ''] = unsigned.split('.');
  const clipped = fracPart.replace(/0+$/, '');
  const formatted = clipped ? `${intPart || '0'}.${clipped}` : intPart || '0';
  return negative ? `-${formatted}` : formatted;
}

/**
 * Like formatMinimaAmount but adds inequality prefixes for hidden precision:
 * - "< 0.000001" when a non-zero value truncates to "0"
 * - "> 0.123456" when non-zero digits exist beyond maxDecimals
 * For compact contexts like the dashboard.
 */
export function formatAmountThreshold(value: string, maxDecimals = 6): string {
  const formatted = formatMinimaAmount(value, maxDecimals);
  const trimmed = value.trim();
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) return formatted;

  if (formatted === '0') {
    if (/^-?0+(\.0*)?$/.test(trimmed)) return '0';
    return `< 0.${'0'.repeat(maxDecimals - 1)}1`;
  }

  const unsigned = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
  const [, fracPart = ''] = unsigned.split('.');
  if (fracPart.length > maxDecimals && /[1-9]/.test(fracPart.slice(maxDecimals))) {
    return `> ${formatted}`;
  }

  return formatted;
}
