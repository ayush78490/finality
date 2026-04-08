import type { GearApi } from "@gear-js/api";
import { ReplyCode } from "@gear-js/api";
import { compactAddLength, stringToU8a, u8aConcat } from "@polkadot/util";
import { TypeRegistry } from "@polkadot/types/create/registry";

function scaleStr(v: string): Uint8Array {
  return compactAddLength(stringToU8a(v));
}

function encodeFinGetRound(api: GearApi, assetKey: string): Uint8Array {
  return u8aConcat(
    scaleStr("Fin"),
    scaleStr("GetRound"),
    api.registry.createType("String", assetKey).toU8a()
  );
}

function finGetRoundReplyPrefixLen(): number {
  return scaleStr("Fin").length + scaleStr("GetRound").length;
}

const roundTypeRegistry = (() => {
  const reg = new TypeRegistry();
  reg.register({
    RoundPhase: { _enum: ["Open", "Locked", "Resolved"] },
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
      winning_shares_remaining: "u128"
    }
  });
  return reg;
})();

/**
 * Parse a u64 value from polkadot.js `toHuman()` output without precision loss.
 * toHuman() serialises large integers as comma-formatted strings, e.g. "1,775,407,788,000".
 * toJSON() converts them to JS Number which silently loses bits above 2^53.
 */
function parseU64Human(v: unknown): bigint {
  if (v === null || v === undefined) return 0n;
  // Remove thousands-separator commas, then parse as BigInt
  const s = String(v).replace(/,/g, "").trim();
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

/**
 * The contract stores timestamps as milliseconds (confirmed from frontend decode of end_ts).
 * Any end_ts that is more than MAX_ROUND_WINDOW_MS from now is treated as a garbage
 * overflow artifact — these arise when a u64 > 2^53 gets silently rounded by toJSON().
 * We cap at 2 days; a legitimate round can never extend beyond that.
 */
const MAX_ROUND_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

/** Decode the RoundPhase field which may come back as string, number, or object from toJSON(). */
function decodePhase(j: Record<string, unknown>): RoundState {
  const phaseRaw = j.phase as unknown;
  if (typeof phaseRaw === "string") {
    if (phaseRaw === "Open" || phaseRaw === "Locked" || phaseRaw === "Resolved") return phaseRaw;
  } else if (typeof phaseRaw === "number") {
    // SCALE enum: 0=Open, 1=Locked, 2=Resolved
    const phases = ["Open", "Locked", "Resolved"] as const;
    return phases[phaseRaw] ?? "Open";
  } else if (phaseRaw && typeof phaseRaw === "object") {
    const keys = Object.keys(phaseRaw);
    if (keys[0] === "Open" || keys[0] === "Locked" || keys[0] === "Resolved") {
      return keys[0] as RoundState;
    }
  }
  return "Open";
}

export async function readRoundOptionTag(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  origin: string
): Promise<number> {
  const payload = encodeFinGetRound(api, assetKey);
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0,
    },
    undefined,
    undefined
  );
  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  if (!code.isSuccess) {
    throw new Error(code.asString ?? "Fin.GetRound calculateReply failed");
  }
  const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
  const body = raw.subarray(finGetRoundReplyPrefixLen());
  return body.length > 0 ? body[0] : -1;
}

/**
 * Wait for a newly started round to become visible (phase === "Open") on-chain.
 *
 * FIX: Previously checked `tag === 1` (any round exists), but a Resolved round also
 * has tag === 1, so this would return true immediately even when start_round failed,
 * masking the failure. Now we check for the "Open" phase explicitly.
 */
export async function waitForRoundVisible(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  origin: string,
  opts?: { attempts?: number; intervalMs?: number }
): Promise<boolean> {
  const attempts = opts?.attempts ?? 12;
  const intervalMs = opts?.intervalMs ?? 1500;

  for (let i = 0; i < attempts; i++) {
    const state = await readRoundState(api, marketProgramId, assetKey, origin);
    if (state === "Open") return true;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}

export type RoundState = "Open" | "Locked" | "Resolved" | "None";

export type RoundDetail = {
  /** Same as RoundState but typed as "None" when no round exists. */
  phase: RoundState;
  /**
   * Round end timestamp in **milliseconds**.
   * The contract stores end_ts as milliseconds (confirmed from on-chain data).
   * Garbage-overflow values (> 2 days from now) are normalised to 0 so the
   * caller treats them as expired.
   */
  endTs: number;
};

/**
 * Reads the full round and returns phase + endTs (ms).
 * Returns `{ phase: "None", endTs: 0 }` when no round exists.
 *
 * FIX: Uses toHuman() instead of toJSON() to read u64 end_ts without precision loss.
 * u64 values > 2^53 get silently mangled by toJSON() (e.g. 4611686025362572000,
 * 13835058062217350000) — toHuman() returns them as comma-formatted strings.
 */
export async function readRoundDetail(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  origin: string
): Promise<RoundDetail> {
  const payload = encodeFinGetRound(api, assetKey);
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0,
    },
    undefined,
    undefined
  );
  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  if (!code.isSuccess) {
    throw new Error(code.asString ?? "Fin.GetRound calculateReply failed");
  }
  const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
  const body = raw.subarray(finGetRoundReplyPrefixLen());

  if (body.length === 0 || body[0] === 0) return { phase: "None", endTs: 0 };

  const roundBody = body.slice(1);
  try {
    const opt = roundTypeRegistry.createType("Option<Round>", roundBody);
    if (opt.isNone) return { phase: "None", endTs: 0 };
    const round = opt.unwrap();

    // Phase — safe to use toJSON() (enum index is small, no precision issue)
    const j = round.toJSON() as Record<string, unknown>;
    const phase = decodePhase(j);

    // end_ts — MUST use toHuman() to avoid BigInt → Number precision loss.
    // toJSON() on a u64 > 2^53 silently rounds, producing garbage values like
    // 4611686025362572000 or 13835058062217350000.
    const h = round.toHuman() as Record<string, unknown>;
    const endTsBigInt = parseU64Human(h.end_ts);

    // Contract stores timestamps as milliseconds.
    // If the value looks like seconds (< year 3000 in seconds) convert to ms.
    // Year 3000 in seconds ≈ 32_503_680_000; in ms ≈ 32_503_680_000_000.
    let endTs: number;
    if (endTsBigInt > 0n && endTsBigInt < 32_503_680_000n) {
      // Stored in seconds — convert to ms
      endTs = Number(endTsBigInt) * 1000;
    } else if (endTsBigInt > 0n && endTsBigInt <= 32_503_680_000_000n) {
      // Already in ms, reasonable value
      endTs = Number(endTsBigInt);
    } else {
      // Value is out of any sane range (overflow artifact) — treat as 0 (expired)
      console.log(
        JSON.stringify({
          level: "warn",
          msg: "end_ts_overflow_artifact",
          symbol: assetKey,
          rawBigInt: endTsBigInt.toString(),
          treating_as: "expired",
        })
      );
      endTs = 0;
    }

    // Safety cap: if endTs is more than 2 days in the future, something is wrong.
    // Normalise to 0 so classifySettleSim treats it as expired.
    if (endTs > Date.now() + MAX_ROUND_WINDOW_MS) {
      console.log(
        JSON.stringify({
          level: "warn",
          msg: "end_ts_unreasonably_large",
          symbol: assetKey,
          endTsMs: endTs,
          msFromNow: endTs - Date.now(),
          treating_as: "expired",
        })
      );
      endTs = 0;
    }

    return { phase, endTs };
  } catch (e) {
    console.error("Failed to decode round detail:", e);
    return { phase: "None", endTs: 0 };
  }
}

export async function readRoundState(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  origin: string
): Promise<RoundState> {
  const payload = encodeFinGetRound(api, assetKey);
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0,
    },
    undefined,
    undefined
  );
  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  if (!code.isSuccess) {
    throw new Error(code.asString ?? "Fin.GetRound calculateReply failed");
  }
  const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
  const body = raw.subarray(finGetRoundReplyPrefixLen());

  if (body.length === 0) return "None";

  const tag = body[0];
  if (tag === 0) return "None";

  const roundBody = body.slice(1);
  try {
    const opt = roundTypeRegistry.createType("Option<Round>", roundBody);
    if (opt.isNone) return "None";
    const round = opt.unwrap();
    const j = round.toJSON() as Record<string, unknown>;
    return decodePhase(j);
  } catch (e) {
    console.error("Failed to decode round state:", e);
    return "None";
  }
}
