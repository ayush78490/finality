/**
 * Mirrors `programs/finality-market/app/src/lib.rs` CPAMM + fee for UI previews.
 * `cpamm_shares_out` + `buy_side` flow.
 *
 * Settlement note: winners split the full pool (seed + all user trades) pro-rata by shares.
 * `seed_per_side` is stored for informational display only.
 */

/** Same as contract: k = a*b, new_b = k/(a+fin_eff), shares_out = b - new_b */
export function cpammSharesOut(
  a: bigint,
  b: bigint,
  finEff: bigint
): { newA: bigint; newB: bigint; sharesOut: bigint } | null {
  const newA = a + finEff;
  if (newA === 0n) return null;
  const k = a * b;
  const newB = k / newA;
  if (newB > b) return null;
  const sharesOut = b - newB;
  if (sharesOut <= 0n) return null;
  return { newA, newB, sharesOut };
}

export type TradePreview = {
  /** Shares minted for this buy (base units). */
  sharesOut: bigint;
  /** Full pool FIN (reserves) after this buy — this is what winners split. */
  poolAfter: bigint;
  /** If this side wins, est. FIN from `Claim` for your full position after trade. */
  expectedClaimFinIfWin: bigint;
  /** Same but only the marginal gain from this trade's shares (excl. rest of wallet). */
  marginalClaimFromThisBuy: bigint;
  /** Reserve of selected side / total pool (0–1). Shows raw AMM odds. */
  sidePoolShareAfter: number;
  /** Gross mult: poolAfter / sideReserveAfter — actual payout multiplier if winning. */
  impliedMult: number;
};

/**
 * Preview a `Fin.BuySide` given current round state and optional wallet position.
 * Winners split the full pool (seed + all user trades) — `seedPerSide` is for display only.
 */
export function previewBuySide(params: {
  side: "up" | "down";
  finInBase: bigint;
  feeBps: number;
  reserveUp: bigint;
  reserveDown: bigint;
  totalSharesUp: bigint;
  totalSharesDown: bigint;
  userSharesUp: bigint;
  userSharesDown: bigint;
  /** Admin's per-side seed (informational only — included in winner payouts). */
  seedPerSide: bigint;
}): TradePreview | null {
  const {
    side,
    finInBase,
    feeBps,
    reserveUp,
    reserveDown,
    totalSharesUp,
    totalSharesDown,
    userSharesUp,
    userSharesDown,
  } = params;

  if (finInBase <= 0n) return null;
  const bps = BigInt(Math.min(10_000, Math.max(0, feeBps)));
  const fee = (finInBase * bps) / 10_000n;
  const finEff = finInBase - fee;
  if (finEff <= 0n) return null;

  let newReserveUp = reserveUp;
  let newReserveDown = reserveDown;
  let sharesOut: bigint;

  if (side === "up") {
    const a = reserveUp;
    const b = reserveDown;
    if (a === 0n || b === 0n) return null;
    const out = cpammSharesOut(a, b, finEff);
    if (!out) return null;
    newReserveUp = out.newA;
    newReserveDown = out.newB;
    sharesOut = out.sharesOut;
  } else {
    const a = reserveDown;
    const b = reserveUp;
    if (a === 0n || b === 0n) return null;
    const out = cpammSharesOut(a, b, finEff);
    if (!out) return null;
    newReserveDown = out.newA;
    newReserveUp = out.newB;
    sharesOut = out.sharesOut;
  }

  const poolAfter = newReserveUp + newReserveDown;

  const totalUpAfter = totalSharesUp + (side === "up" ? sharesOut : 0n);
  const totalDownAfter = totalSharesDown + (side === "down" ? sharesOut : 0n);

  const userUpAfter = userSharesUp + (side === "up" ? sharesOut : 0n);
  const userDownAfter = userSharesDown + (side === "down" ? sharesOut : 0n);

  if (side === "up") {
    if (totalUpAfter === 0n) return null;
    const expectedClaimFinIfWin = (poolAfter * userUpAfter) / totalUpAfter;
    const marginalClaimFromThisBuy = (poolAfter * sharesOut) / totalUpAfter;
    const sideRes = newReserveUp;
    const sidePoolShareAfter =
      poolAfter === 0n ? 0 : Number(sideRes) / Number(poolAfter);
    const impliedMult =
      sideRes === 0n ? 0 : Number(poolAfter) / Number(sideRes);
    return {
      sharesOut,
      poolAfter,
      expectedClaimFinIfWin,
      marginalClaimFromThisBuy,
      sidePoolShareAfter,
      impliedMult,
    };
  }

  if (totalDownAfter === 0n) return null;
  const expectedClaimFinIfWin = (poolAfter * userDownAfter) / totalDownAfter;
  const marginalClaimFromThisBuy = (poolAfter * sharesOut) / totalDownAfter;
  const sideRes = newReserveDown;
  const sidePoolShareAfter =
    poolAfter === 0n ? 0 : Number(sideRes) / Number(poolAfter);
  const impliedMult =
    sideRes === 0n ? 0 : Number(poolAfter) / Number(sideRes);
  return {
    sharesOut,
    poolAfter,
    expectedClaimFinIfWin,
    marginalClaimFromThisBuy,
    sidePoolShareAfter,
    impliedMult,
  };
}

/** FIN base units → human string (trim trailing zeros). */
export function finBaseToShortHuman(base: bigint, decimals = 12): string {
  const d = 10n ** BigInt(decimals);
  const whole = base / d;
  const frac = base % d;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
