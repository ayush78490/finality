/**
 * Mirrors `programs/finality-market/app/src/lib.rs` CPAMM + fee for UI previews.
 * `cpamm_shares_out` + `buy_side` flow.
 *
 * Settlement note: winners split `trader_fin_deposited` only.
 * Admin seed is returned separately via `ClaimSeed` and is not part of trader payout.
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
  /** Full pool FIN (reserves) after this buy — for display only. */
  poolAfter: bigint;
  /** Pool available for traders to win: trader-funded liquidity only. */
  tradersPoolAfter: bigint;
  /** If this side wins, est. FIN from `Claim` for your full position after trade. */
  expectedClaimFinIfWin: bigint;
  /** Same but only the marginal gain from this trade's shares (excl. rest of wallet). */
  marginalClaimFromThisBuy: bigint;
  /** Reserve of selected side / total pool (0–1). Shows raw AMM odds. */
  sidePoolShareAfter: number;
  /** Gross mult: poolAfter / sideReserveAfter — for display (includes seed). */
  impliedMult: number;
  /** Net mult: tradersPoolAfter / sideReserveAfter — actual payout multiplier if winning. */
  netMult: number;
};

/**
 * Preview a `Fin.BuySide` given current round state and optional wallet position.
 * Winners get: `trader_fin_deposited` only.
 * Admin seed is returned separately via `ClaimSeed` when the market closes.
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
  /** Admin's per-side seed — used to determine winning side seed to exclude. */
  seedPerSide: bigint;
  /** Total trader funds deposited — used directly for payout calculations. */
  traderFinDeposited: bigint;
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
    seedPerSide,
    traderFinDeposited,
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
  // On-chain claimable pool is the trader-funded pool only.
  // When traderFinDeposited is 0, the correct payout is 0.
  const tradersPoolAfter = traderFinDeposited;

  if (tradersPoolAfter === 0n) {
    return {
      sharesOut,
      poolAfter,
      tradersPoolAfter,
      expectedClaimFinIfWin: 0n,
      marginalClaimFromThisBuy: 0n,
      sidePoolShareAfter: side === "up" ? Number(newReserveUp) / Number(poolAfter) : Number(newReserveDown) / Number(poolAfter),
      impliedMult: side === "up" ? (newReserveUp === 0n ? 0 : Number(poolAfter) / Number(newReserveUp)) : (newReserveDown === 0n ? 0 : Number(poolAfter) / Number(newReserveDown)),
      netMult: 0,
    };
  }

  const totalUpAfter = totalSharesUp + (side === "up" ? sharesOut : 0n);
  const totalDownAfter = totalSharesDown + (side === "down" ? sharesOut : 0n);

  const userUpAfter = userSharesUp + (side === "up" ? sharesOut : 0n);
  const userDownAfter = userSharesDown + (side === "down" ? sharesOut : 0n);

  if (side === "up") {
    if (totalUpAfter === 0n) return null;
    const expectedClaimFinIfWin = (tradersPoolAfter * userUpAfter) / totalUpAfter;
    const marginalClaimFromThisBuy = (tradersPoolAfter * sharesOut) / totalUpAfter;
    const sideRes = newReserveUp;
    const sidePoolShareAfter =
      poolAfter === 0n ? 0 : Number(sideRes) / Number(poolAfter);
    const impliedMult =
      sideRes === 0n ? 0 : Number(poolAfter) / Number(sideRes);
    const netMult =
      sideRes === 0n ? 0 : Number(tradersPoolAfter) / Number(sideRes);
    return {
      sharesOut,
      poolAfter,
      tradersPoolAfter,
      expectedClaimFinIfWin,
      marginalClaimFromThisBuy,
      sidePoolShareAfter,
      impliedMult,
      netMult,
    };
  }

  if (totalDownAfter === 0n) return null;
  const expectedClaimFinIfWin = (tradersPoolAfter * userDownAfter) / totalDownAfter;
  const marginalClaimFromThisBuy = (tradersPoolAfter * sharesOut) / totalDownAfter;
  const sideRes = newReserveDown;
  const sidePoolShareAfter =
    poolAfter === 0n ? 0 : Number(sideRes) / Number(poolAfter);
  const impliedMult =
    sideRes === 0n ? 0 : Number(poolAfter) / Number(sideRes);
  const netMult =
    sideRes === 0n ? 0 : Number(tradersPoolAfter) / Number(sideRes);
  return {
    sharesOut,
    poolAfter,
    tradersPoolAfter,
    expectedClaimFinIfWin,
    marginalClaimFromThisBuy,
    sidePoolShareAfter,
    impliedMult,
    netMult,
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
