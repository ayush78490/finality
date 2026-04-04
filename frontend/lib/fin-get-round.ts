/**
 * Read-only `Fin.GetRound(asset_key)` via `calculateReply` (same pattern as `verify-faucet` in dia-relayer).
 * Decodes `Option<Round>` and maps `RoundPhase` for UI badges.
 */
import type { GearApi } from "@gear-js/api";
import { ReplyCode } from "@gear-js/api";
import { TypeRegistry } from "@polkadot/types/create/registry";
import { compactAddLength, stringToU8a, u8aConcat } from "@polkadot/util";
import { cryptoWaitReady } from "@polkadot/util-crypto";

import type { MarketMeta } from "./markets";
import { oraclePriceToHuman, parseJsonBigInt } from "./oracle-price";

function scaleStr(v: string): Uint8Array {
  return compactAddLength(stringToU8a(v));
}

/** Same Sails SCALE as handle messages: service + method + args. */
export function encodeFinGetRound(api: GearApi, assetKey: string): Uint8Array {
  return u8aConcat(
    scaleStr("Fin"),
    scaleStr("GetRound"),
    api.registry.createType("String", assetKey).toU8a()
  );
}

export function finGetRoundReplyPrefixLen(): number {
  return scaleStr("Fin").length + scaleStr("GetRound").length;
}

/** Matches `programs/finality-market` IDL / Rust `RoundPhase`. */
export type OnChainRoundPhase = "Open" | "Locked" | "Resolved";

export type MarketRoundSnapshot = {
  /** No round on-chain yet (admin has not started one). */
  kind: "none";
} | {
  kind: "round";
  phase: OnChainRoundPhase;
  /** Only meaningful when `phase === "Resolved"`. */
  outcomeUp: boolean | null;
};

/** Full round for trading UI (prices, times, id). */
export type MarketRoundDetail =
  | { kind: "none" }
  | {
      kind: "round";
      id: string;
      startTs: number;
      endTs: number;
      startPriceHuman: number;
      startExpo: number;
      endPriceHuman: number | null;
      endExpo: number | null;
      phase: OnChainRoundPhase;
      outcomeUp: boolean | null;
      /** Pool reserves — FIN base units (12 decimals). Used to compute odds. */
      reserveUp: bigint;
      reserveDown: bigint;
      totalSharesUp: bigint;
      totalSharesDown: bigint;
      /** Trading fee in basis points (e.g. 100 = 1%). */
      feeBps: number;
      /** Admin's initial per-side seed — FIN base units. Returned to admin at settlement; excluded from winner payouts. */
      seedPerSide: bigint;
    };

let roundTypesRegistry: TypeRegistry | null = null;

function getRoundRegistry(): TypeRegistry {
  if (roundTypesRegistry) return roundTypesRegistry;
  const reg = new TypeRegistry();
  reg.register({
    RoundPhase: {
      _enum: ["Open", "Locked", "Resolved"]
    },
    Round: {
      id: "u64",
      start_ts: "u64",
      end_ts: "u64",
      start_price: "u128",
      start_expo: "i32",
      end_price: "Option<u128>",
      end_expo: "Option<i32>",
      outcome_up: "Option<bool>",
      phase: "RoundPhase",
      reserve_up: "u128",
      reserve_down: "u128",
      fee_bps: "u16",
      total_shares_up: "u128",
      total_shares_down: "u128",
      fee_acc: "u128",
      seed_per_side: "u128",
      payout_fin_remaining: "u128",
      winning_shares_remaining: "u128"
    }
  });
  roundTypesRegistry = reg;
  return reg;
}

function decodeOptionRoundBody(body: Uint8Array): MarketRoundSnapshot {
  const reg = getRoundRegistry();
  const opt = reg.createType("Option<Round>", body);
  if (opt.isNone) return { kind: "none" };
  const j = opt.unwrap().toJSON() as Record<string, unknown>;
  const phaseRaw = j.phase as unknown;
  let phase: OnChainRoundPhase = "Open";
  if (typeof phaseRaw === "number") {
    phase = [0, "Open", "Locked", "Resolved"][phaseRaw] as OnChainRoundPhase || "Open";
  } else if (typeof phaseRaw === "string") {
    if (phaseRaw === "Open" || phaseRaw === "Locked" || phaseRaw === "Resolved") {
      phase = phaseRaw;
    }
  } else if (phaseRaw && typeof phaseRaw === "object") {
    const keys = Object.keys(phaseRaw);
    if (keys.length > 0 && (keys[0] === "Open" || keys[0] === "Locked" || keys[0] === "Resolved")) {
      phase = keys[0] as OnChainRoundPhase;
    }
  }
  const rawOutcome = j.outcome_up ?? j.outcomeUp;
  let outcomeUp: boolean | null = null;
  if (phase === "Resolved" && rawOutcome != null) {
    outcomeUp = Boolean(rawOutcome);
  }
  return { kind: "round", phase, outcomeUp };
}

function decodeRoundDetailBody(body: Uint8Array): MarketRoundDetail {
  const reg = getRoundRegistry();
  const opt = reg.createType("Option<Round>", body);
  if (opt.isNone) return { kind: "none" };
  const j = opt.unwrap().toJSON() as Record<string, unknown>;
  const phaseRaw = j.phase as unknown;
  let phase: OnChainRoundPhase = "Open";
  if (typeof phaseRaw === "number") {
    phase = [0, "Open", "Locked", "Resolved"][phaseRaw] as OnChainRoundPhase || "Open";
  } else if (typeof phaseRaw === "string") {
    if (phaseRaw === "Open" || phaseRaw === "Locked" || phaseRaw === "Resolved") {
      phase = phaseRaw;
    }
  } else if (phaseRaw && typeof phaseRaw === "object") {
    const keys = Object.keys(phaseRaw);
    if (keys.length > 0 && (keys[0] === "Open" || keys[0] === "Locked" || keys[0] === "Resolved")) {
      phase = keys[0] as OnChainRoundPhase;
    }
  }
  const id = String(j.id ?? "0");

  const startTs = Number(j.start_ts ?? 0);
  const endTs = Number(j.end_ts ?? 0);
  const startExpo = Number(j.start_expo ?? -8);
  const endExpoRaw = j.end_expo ?? j.endExpo;
  const endExpo =
    endExpoRaw === null || endExpoRaw === undefined
      ? null
      : Number(endExpoRaw);

  const sp = parseJsonBigInt(j.start_price);
  const startPriceHuman = oraclePriceToHuman(sp, startExpo);

  let endPriceHuman: number | null = null;
  const ep = j.end_price ?? j.endPrice;
  if (ep != null && endExpo !== null) {
    endPriceHuman = oraclePriceToHuman(parseJsonBigInt(ep), endExpo);
  }

  const rawOutcome = j.outcome_up ?? j.outcomeUp;
  let outcomeUp: boolean | null = null;
  if (phase === "Resolved" && rawOutcome != null) {
    outcomeUp = Boolean(rawOutcome);
  }

  const reserveUp = parseJsonBigInt(j.reserve_up ?? j.reserveUp);
  const reserveDown = parseJsonBigInt(j.reserve_down ?? j.reserveDown);
  const totalSharesUp = parseJsonBigInt(j.total_shares_up ?? j.totalSharesUp);
  const totalSharesDown = parseJsonBigInt(j.total_shares_down ?? j.totalSharesDown);
  const feeBpsRaw = j.fee_bps ?? j.feeBps;
  const feeBps =
    typeof feeBpsRaw === "number"
      ? feeBpsRaw
      : typeof feeBpsRaw === "string"
        ? Number.parseInt(feeBpsRaw, 10) || 0
        : 0;
  const seedPerSide = parseJsonBigInt(j.seed_per_side ?? j.seedPerSide);

  return {
    kind: "round",
    id,
    startTs,
    endTs,
    startPriceHuman,
    startExpo,
    endPriceHuman,
    endExpo,
    phase,
    outcomeUp,
    reserveUp,
    reserveDown,
    totalSharesUp,
    totalSharesDown,
    feeBps,
    seedPerSide,
  };
}

/** SS58 used only as `origin` for read-only `calculateReply` when the user has not connected a wallet. */
async function readOriginAddress(preferred: string | null): Promise<string> {
  if (preferred) return preferred;
  await cryptoWaitReady();
  const { createVaraKeyring } = await import("./vara-keyring");
  return createVaraKeyring().addFromUri("//Alice").address;
}

/**
 * Fetches current parimutuel round state for an asset from the market program.
 * Requires a live `GearApi` (wallet provider).
 */
export async function fetchMarketRoundSnapshot(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  originAccount: string | null
): Promise<MarketRoundSnapshot> {
  const origin = await readOriginAddress(originAccount);
  const payload = encodeFinGetRound(api, assetKey);
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0
    },
    undefined,
    undefined
  );

  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
  const body = raw.subarray(finGetRoundReplyPrefixLen());

  if (!code.isSuccess) {
    throw new Error(code.asString ?? "calculateReply failed");
  }

  return decodeOptionRoundBody(body);
}

/** Same RPC as `fetchMarketRoundSnapshot`, returns full decoded round for prices / ids. */
export async function fetchMarketRoundDetail(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  originAccount: string | null
): Promise<MarketRoundDetail> {
  const origin = await readOriginAddress(originAccount);
  const payload = encodeFinGetRound(api, assetKey);
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0
    },
    undefined,
    undefined
  );

  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
  const body = raw.subarray(finGetRoundReplyPrefixLen());

  if (!code.isSuccess) {
    throw new Error(code.asString ?? "calculateReply failed");
  }

  return decodeRoundDetailBody(body);
}

/** Map on-chain enum to short UI labels for cards. */
export function phaseBadgeLabel(snap: MarketRoundSnapshot): string {
  if (snap.kind === "none") return "No round";
  switch (snap.phase) {
    case "Open":
      return "Open";
    case "Locked":
      return "Locked";
    case "Resolved":
      return snap.outcomeUp === true
        ? "Resolved · UP"
        : snap.outcomeUp === false
          ? "Resolved · DOWN"
          : "Resolved";
    default:
      return String(snap.phase);
  }
}

export async function fetchAllMarketRoundSnapshots(
  api: GearApi,
  marketProgramId: string,
  markets: MarketMeta[],
  originAccount: string | null
): Promise<Record<string, MarketRoundSnapshot | "error">> {
  const out: Record<string, MarketRoundSnapshot | "error"> = {};
  for (const m of markets) {
    try {
      out[m.slug] = await fetchMarketRoundSnapshot(
        api,
        marketProgramId,
        m.assetKey,
        originAccount
      );
    } catch {
      out[m.slug] = "error";
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}

export async function fetchAllMarketRoundDetails(
  api: GearApi,
  marketProgramId: string,
  markets: MarketMeta[],
  originAccount: string | null
): Promise<Record<string, MarketRoundDetail | "error">> {
  const out: Record<string, MarketRoundDetail | "error"> = {};
  for (const m of markets) {
    try {
      out[m.slug] = await fetchMarketRoundDetail(
        api,
        marketProgramId,
        m.assetKey,
        originAccount
      );
    } catch {
      out[m.slug] = "error";
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}
