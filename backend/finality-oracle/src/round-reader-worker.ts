import type { GearApi } from "@gear-js/api";
import type { RelayerFileConfig } from "./config.js";
import { readRoundDetail, type RoundState } from "./round-read.js";

type FeedEntry = RelayerFileConfig["feeds"][number];

export type ReaderAction = "none" | "settle" | "start" | "settle_roll";

export type RoundIntent = {
  action: ReaderAction;
  symbol: string;
  assetId: number;
  roundId: string | null;
  phase: RoundState;
  endTs: number;
  detectedAtMs: number;
  reason: string;
};

export function createIntentActionKey(marketProgramId: string, intent: RoundIntent): string | null {
  if (intent.action === "none") return null;
  const roundId = intent.roundId ?? "none";
  return `${marketProgramId}:${intent.symbol}:${roundId}:${intent.action}`;
}

/**
 * Read-only reader: inspects one market and emits a single intent.
 * @param roundMode - controls whether expired rounds emit "settle" (legacy) or "settle_roll" (rolling).
 */
export async function readIntentForFeed(
  api: GearApi,
  marketProgramId: string,
  feed: FeedEntry,
  origin: string,
  nowMs = Date.now(),
  roundMode: "legacy" | "rolling" = "legacy"
): Promise<RoundIntent> {
  try {
    const detail = await readRoundDetail(api, marketProgramId, feed.symbol, origin);
    const phase = detail.phase;

    if (phase === "None" || phase === "Resolved") {
      return {
        action: "start",
        symbol: feed.symbol,
        assetId: feed.assetId,
        roundId: detail.roundId,
        phase,
        endTs: detail.endTs,
        detectedAtMs: nowMs,
        reason: phase === "Resolved" ? "round_resolved" : "round_missing",
      };
    }

    if (nowMs >= detail.endTs) {
      return {
        action: roundMode === "rolling" ? "settle_roll" : "settle",
        symbol: feed.symbol,
        assetId: feed.assetId,
        roundId: detail.roundId,
        phase,
        endTs: detail.endTs,
        detectedAtMs: nowMs,
        reason: roundMode === "rolling" ? "round_expired_rolling" : "round_expired",
      };
    }

    return {
      action: "none",
      symbol: feed.symbol,
      assetId: feed.assetId,
      roundId: detail.roundId,
      phase,
      endTs: detail.endTs,
      detectedAtMs: nowMs,
      reason: "round_active",
    };
  } catch (e: unknown) {
    return {
      action: "none",
      symbol: feed.symbol,
      assetId: feed.assetId,
      roundId: null,
      phase: "None",
      endTs: 0,
      detectedAtMs: nowMs,
      reason: `read_error:${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
