/**
 * Read-only `Fin.GetRound(asset_key)` via `calculateReply` (same pattern as `verify-faucet` in Finality Oracle).
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

  export function encodeFinListRoundSnapshots(api: GearApi, assetKey: string): Uint8Array {
    return u8aConcat(
      scaleStr("Fin"),
      scaleStr("ListRoundSnapshots"),
      api.registry.createType("String", assetKey).toU8a()
    );
  }

  export function finListRoundSnapshotsReplyPrefixLen(): number {
    return scaleStr("Fin").length + scaleStr("ListRoundSnapshots").length;
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

/** Matches `programs/finality-market` IDL / Rust `RoundPhase`. "Settling" is a UI-only transient state during rolling epoch transitions. */
export type OnChainRoundPhase = "Open" | "Locked" | "Resolved" | "Settling";

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
      /** Trader FIN deposited (excludes admin seed) — used for winner payout calculation. */
      traderFinDeposited: bigint;
    };

let roundTypesRegistry: TypeRegistry | null = null;
let fallbackOriginPromise: Promise<string> | null = null;

const DEFAULT_BATCH_CONCURRENCY = 8;

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
      trader_fin_deposited: "u128",
      payout_fin_remaining: "u128",
      winning_shares_remaining: "u128",
      is_rolling: "bool"
    }
  });
  roundTypesRegistry = reg;
  return reg;
}

/**
 * Encode `Fin.GetRoundSnapshot(asset_key, round_id)` query payload.
 * Used to fetch a historical settled epoch from `round_snapshots` in rolling mode.
 */
export function encodeFinGetRoundSnapshot(
  api: GearApi,
  assetKey: string,
  roundId: bigint | number | string
): Uint8Array {
  return u8aConcat(
    scaleStr("Fin"),
    scaleStr("GetRoundSnapshot"),
    api.registry.createType("String", assetKey).toU8a(),
    api.registry.createType("u64", roundId).toU8a()
  );
}

export function finGetRoundSnapshotReplyPrefixLen(): number {
  return scaleStr("Fin").length + scaleStr("GetRoundSnapshot").length;
}

/**
 * Decode the SCALE-encoded `Option<Round>` body (after stripping the Sails reply prefix).
 * Returns a lightweight snapshot: phase + outcomeUp, suitable for market listing cards.
 */
function decodeOptionRoundBody(body: Uint8Array): MarketRoundSnapshot {
  const reg = getRoundRegistry();
  let opt;
  try {
    opt = reg.createType("Option<Round>", body);
  } catch (e) {
    if (body.length === 0 || (body.length === 1 && body[0] === 0)) {
      return { kind: "none" };
    }
    throw e;
  }

  if (opt.isNone) {
    return { kind: "none" };
  }

  let j: Record<string, unknown>;
  try {
    const unwrapped = opt.unwrap();
    j = unwrapped.toJSON() as Record<string, unknown>;
  } catch (e) {
    return { kind: "none" };
  }

  if (!j || typeof j !== 'object') {
    return { kind: "none" };
  }

  const phaseRaw = j.phase as unknown;
  let phase: OnChainRoundPhase = "Open";
  if (typeof phaseRaw === "number") {
    // SCALE enum: 0 = Open, 1 = Locked, 2 = Resolved  (0-indexed, NOT 1-indexed)
    phase = (["Open", "Locked", "Resolved"] as const)[phaseRaw] ?? "Open";
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

/**
 * Parse a u64 value from polkadot.js toHuman() output (comma-formatted string) to a safe JS number (ms).
 * Avoids the BigInt → Number precision loss that toJSON() causes for values > 2^53.
 */
function parseU64HumanMs(human: Record<string, unknown>, key: string): number {
  const raw = human[key];
  if (raw === null || raw === undefined) return 0;
  const bn = BigInt(String(raw).replace(/,/g, "").trim() || "0");
  // Contract stores timestamps as milliseconds. Reasonable range check:
  // If value looks like seconds (< year 3000 in seconds), convert to ms.
  if (bn > 0n && bn < 32_503_680_000n) return Number(bn) * 1000;
  // Already in ms or 0
  if (bn <= 32_503_680_000_000n) return Number(bn);
  // Overflow artifact — return 0 (caller will show "waiting" state)
  return 0;
}

function decodeRoundDetailBody(body: Uint8Array): MarketRoundDetail {
  const reg = getRoundRegistry();
  const opt = reg.createType("Option<Round>", body);
  if (opt.isNone) return { kind: "none" };
  const round = (opt as any).unwrap();
  const j = round.toJSON() as Record<string, unknown>;
  // Also get human-readable form for u64 timestamps (avoids BigInt precision loss)
  const h = round.toHuman() as Record<string, unknown>;

  const phaseRaw = j.phase as unknown;
  let phase: OnChainRoundPhase = "Open";
  if (typeof phaseRaw === "number") {
    // SCALE enum: 0 = Open, 1 = Locked, 2 = Resolved  (0-indexed, NOT 1-indexed)
    phase = (["Open", "Locked", "Resolved"] as const)[phaseRaw] ?? "Open";
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

  // Use toHuman() for timestamps to avoid Number precision loss for large u64 values
  const startTs = parseU64HumanMs(h, "start_ts");
  const endTs = parseU64HumanMs(h, "end_ts");

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
  const traderFinDeposited = parseJsonBigInt(j.trader_fin_deposited ?? j.traderFinDeposited);

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
    traderFinDeposited,
  };
}


/** SS58 used only as `origin` for read-only `calculateReply` when the user has not connected a wallet. */
async function readOriginAddress(preferred: string | null): Promise<string> {
  if (preferred) return preferred;
  if (!fallbackOriginPromise) {
    fallbackOriginPromise = (async () => {
      await cryptoWaitReady();
      const { createVaraKeyring } = await import("./vara-keyring");
      return createVaraKeyring().addFromUri("//Alice").address;
    })();
  }
  return fallbackOriginPromise;
}

async function fetchMarketRoundSnapshotWithOrigin(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  origin: string,
  atBlockHash?: string | null
): Promise<MarketRoundSnapshot> {
  const payload = encodeFinGetRound(api, assetKey);

  const atBlock = atBlockHash ? (atBlockHash as `0x${string}`) : undefined;
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0,
      at: atBlock
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

async function fetchMarketRoundDetailWithOrigin(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  origin: string,
  atBlockHash?: string | null
): Promise<MarketRoundDetail> {
  const payload = encodeFinGetRound(api, assetKey);
  const atBlock = atBlockHash ? (atBlockHash as `0x${string}`) : undefined;
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0,
      at: atBlock
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

async function fetchMarketRoundSnapshotDetailWithOrigin(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  roundId: string,
  origin: string,
  atBlockHash?: string | null
): Promise<MarketRoundDetail> {
  const payload = encodeFinGetRoundSnapshot(api, assetKey, roundId);
  const atBlock = atBlockHash ? (atBlockHash as `0x${string}`) : undefined;
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0,
      at: atBlock
    },
    undefined,
    undefined
  );

  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
  const body = raw.subarray(finGetRoundSnapshotReplyPrefixLen());
  if (!code.isSuccess) {
    throw new Error(code.asString ?? "calculateReply failed");
  }
  return decodeRoundDetailBody(body);
}

async function fetchRoundSnapshotIdsWithOrigin(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  origin: string,
  atBlockHash?: string | null
): Promise<string[]> {
  const payload = encodeFinListRoundSnapshots(api, assetKey);
  const atBlock = atBlockHash ? (atBlockHash as `0x${string}`) : undefined;
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0,
      at: atBlock
    },
    undefined,
    undefined
  );

  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
  const body = raw.subarray(finListRoundSnapshotsReplyPrefixLen());
  if (!code.isSuccess) {
    throw new Error(code.asString ?? "calculateReply failed");
  }

  const vec = api.registry.createType("Vec<u64>", body) as unknown as {
    toArray: () => Array<{ toString: () => string }>;
  };
  return vec.toArray().map((x) => x.toString());
}

async function mapWithConcurrency<T>(
  items: MarketMeta[],
  worker: (m: MarketMeta) => Promise<T>,
  concurrency = DEFAULT_BATCH_CONCURRENCY
): Promise<T[]> {
  if (items.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const out = new Array<T>(items.length);
  let cursor = 0;

  async function runOne(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= items.length) return;
      out[i] = await worker(items[i]);
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => runOne()));
  return out;
}

/**
 * Fetches current parimutuel round state for an asset from the market program.
 * Requires a live `GearApi` (wallet provider).
 */
export async function fetchMarketRoundSnapshot(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  originAccount: string | null,
  atBlockHash?: string | null
): Promise<MarketRoundSnapshot> {
  const origin = await readOriginAddress(originAccount);
  return fetchMarketRoundSnapshotWithOrigin(api, marketProgramId, assetKey, origin, atBlockHash);
}

/** Same RPC as `fetchMarketRoundSnapshot`, returns full decoded round for prices / ids. */
export async function fetchMarketRoundDetail(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  originAccount: string | null,
  atBlockHash?: string | null
): Promise<MarketRoundDetail> {
  const origin = await readOriginAddress(originAccount);
  return fetchMarketRoundDetailWithOrigin(api, marketProgramId, assetKey, origin, atBlockHash);
}

/** Fetch one historical snapshot detail by explicit round id. */
export async function fetchMarketRoundSnapshotDetail(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  roundId: string,
  originAccount: string | null,
  atBlockHash?: string | null
): Promise<MarketRoundDetail> {
  const origin = await readOriginAddress(originAccount);
  return fetchMarketRoundSnapshotDetailWithOrigin(
    api,
    marketProgramId,
    assetKey,
    roundId,
    origin,
    atBlockHash
  );
}

/** Fetch the latest historical snapshot for an asset (if any). */
export async function fetchLatestRoundSnapshotDetail(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  originAccount: string | null,
  atBlockHash?: string | null
): Promise<MarketRoundDetail | null> {
  const origin = await readOriginAddress(originAccount);
  const ids = await fetchRoundSnapshotIdsWithOrigin(
    api,
    marketProgramId,
    assetKey,
    origin,
    atBlockHash
  );
  if (!ids.length) return null;
  const latest = ids[ids.length - 1];
  const detail = await fetchMarketRoundSnapshotDetailWithOrigin(
    api,
    marketProgramId,
    assetKey,
    latest,
    origin,
    atBlockHash
  );
  return detail.kind === "round" ? detail : null;
}

/** Map on-chain enum to short UI labels for cards. */
export function phaseBadgeLabel(snap: MarketRoundSnapshot): string {
  if (snap.kind === "none") return "No round";
  switch (snap.phase) {
    case "Open":
      return "Open";
    case "Locked":
      return "Locked";
    case "Settling":
      return "Settling\u2026";
    case "Resolved":
      return snap.outcomeUp === true
        ? "Resolved \u00b7 UP"
        : snap.outcomeUp === false
          ? "Resolved \u00b7 DOWN"
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
  const origin = await readOriginAddress(originAccount);
  const out: Record<string, MarketRoundSnapshot | "error"> = {};

  const rows = await mapWithConcurrency(markets, async (m) => {
    try {
      const value = await fetchMarketRoundSnapshotWithOrigin(
        api,
        marketProgramId,
        m.assetKey,
        origin
      );
      return { slug: m.slug, value };
    } catch {
      return { slug: m.slug, value: "error" as const };
    }
  });

  for (const row of rows) {
    out[row.slug] = row.value;
  }

  return out;
}

export async function fetchAllMarketRoundDetails(
  api: GearApi,
  marketProgramId: string,
  markets: MarketMeta[],
  originAccount: string | null
): Promise<Record<string, MarketRoundDetail | "error">> {
  const origin = await readOriginAddress(originAccount);
  const out: Record<string, MarketRoundDetail | "error"> = {};

  const rows = await mapWithConcurrency(markets, async (m) => {
    try {
      const value = await fetchMarketRoundDetailWithOrigin(
        api,
        marketProgramId,
        m.assetKey,
        origin
      );
      return { slug: m.slug, value };
    } catch {
      return { slug: m.slug, value: "error" as const };
    }
  });

  for (const row of rows) {
    out[row.slug] = row.value;
  }

  return out;
}
