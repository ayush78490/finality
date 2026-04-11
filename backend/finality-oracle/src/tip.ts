/**
 * Parse pool priority from a 1014 error message.
 * Substrate format: "Priority is too low: (POOL_PRIORITY vs OUR_PRIORITY)"
 * The first (larger) number is the stuck tx priority we must exceed.
 */
export function parsePoolPriority(msg: string): bigint | null {
  const m = msg.match(/\((\d+)\s+vs\s+(\d+)\)/);
  if (!m) return null;
  const a = BigInt(m[1]);
  const b = BigInt(m[2]);
  return a > b ? a : b;
}

/**
 * Compute a tip that will beat `poolPriority`.
 * Substrate: priority ≈ partialFee + tip  →  tip = poolPriority - partialFee + buffer.
 */
export function tipToBeat(poolPriority: bigint, partialFee: bigint): bigint {
  const BUFFER = 1_000_000n;
  return poolPriority > partialFee
    ? poolPriority - partialFee + BUFFER
    : partialFee + BUFFER;
}

/**
 * Returns a tip high enough for an initial (non-replacement) submit:
 * partialFee + small buffer so priority > 0, not competing with mempool.
 */
export async function initialTip(
  tx: { paymentInfo: (addr: string) => Promise<{ partialFee: { toString(): string } }> },
  signerAddress: string
): Promise<bigint> {
  try {
    const pf = BigInt((await tx.paymentInfo(signerAddress)).partialFee.toString());
    return pf + 1_000_000n;
  } catch {
    return 1_000_000n;
  }
}
