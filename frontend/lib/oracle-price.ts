/**
 * Oracle tick prices are u128 with signed decimal exponent (e.g. -8 for 8 decimals).
 * Matches `OracleTick` / `Round` fields on-chain.
 */
export function oraclePriceToHuman(price: bigint, expo: number): number {
  return Number(price) * 10 ** expo;
}

export function parseJsonBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (typeof v === "string") {
    const s = v.replace(/,/g, "");
    try {
      return BigInt(s.split(".")[0] ?? "0");
    } catch {
      return 0n;
    }
  }
  return 0n;
}
