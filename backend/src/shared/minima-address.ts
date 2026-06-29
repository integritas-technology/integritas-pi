/** Returns true if value looks like a Minima address (Mx… or 0x…). */
export function isMinimaAddress(value: string): boolean {
  return /^(Mx|0x)/i.test(value.trim());
}
