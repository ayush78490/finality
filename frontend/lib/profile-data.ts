/**
 * Profile page data — fast version.
 *
 * Uses localStorage (written by trade-submit on every successful BuySide) to know
 * which markets to show. Queries `GetPosition` for the **current** round and for
 * recent past round ids (stored + rolling window), because after `start_round` the
 * UI round id advances while old positions remain keyed by the previous id.
 */
import type { GearApi } from "@gear-js/api";
import { MARKET_PROGRAM_ID, getAdminWallet } from "./config";
import { fetchMarketRoundDetail, type MarketRoundDetail } from "./fin-get-round";
import { fetchUserPosition } from "./fin-position";
import { MARKETS, type MarketMeta } from "./markets";
import { getTradedAssetKeys, getTradedRoundIdsForAsset } from "./traded-markets";

export type ProfileMarketSummary = {
  market: MarketMeta;
  detail: MarketRoundDetail;
  /** Position in the on-chain current round (`GetRound` id). */
  sharesUp: bigint;
  sharesDown: bigint;
  /** Best-effort: non-zero position from a past round id (when current round shows 0). */
  pastRoundPosition: {
    roundId: string;
    sharesUp: bigint;
    sharesDown: bigint;
  } | null;
  canTryClaim: boolean;
  outcomeLabel: "UP" | "DOWN" | null;
  error?: string;
};

export type CreatedMarketInfo = {
  market: MarketMeta;
  detail: MarketRoundDetail;
  roundCount: number;
  status: "active" | "ended" | "no_round";
};

function isResolvedWinner(detail: MarketRoundDetail, up: bigint, down: bigint): boolean {
  if (detail.kind !== "round") return false;
  if (detail.phase !== "Resolved" || detail.outcomeUp === null) return false;
  return detail.outcomeUp ? up > 0n : down > 0n;
}

/** Build round ids to query for positions (current + stored + recent history). */
function roundIdsToProbe(
  currentIdStr: string,
  programId: string,
  account: string,
  assetKey: string
): string[] {
  const cur = BigInt(currentIdStr);
  const s = new Set<string>();
  s.add(currentIdStr);
  for (const r of getTradedRoundIdsForAsset(programId, account, assetKey)) {
    if (/^\d+$/.test(r)) s.add(r);
  }
  for (let i = 1; i <= 20; i++) {
    const p = cur - BigInt(i);
    if (p < 1n) break;
    s.add(p.toString());
  }
  return [...s];
}

async function fetchOne(
  api: GearApi,
  programId: string,
  market: MarketMeta,
  account: string
): Promise<ProfileMarketSummary> {
  const detail = await fetchMarketRoundDetail(api, programId, market.assetKey, account);

  let sharesUp = 0n;
  let sharesDown = 0n;
  let pastRoundPosition: ProfileMarketSummary["pastRoundPosition"] = null;

  if (detail.kind === "round") {
    const ids = roundIdsToProbe(detail.id, programId, account, market.assetKey);
    const results = await Promise.allSettled(
      ids.map(async (rid) => {
        const pos = await fetchUserPosition(api, programId, market.assetKey, rid, account, account);
        return { rid, pos };
      })
    );

    const byId = new Map<string, { sharesUp: bigint; sharesDown: bigint }>();
    for (const r of results) {
      if (r.status === "fulfilled") {
        byId.set(r.value.rid, {
          sharesUp: r.value.pos.sharesUp,
          sharesDown: r.value.pos.sharesDown,
        });
      }
    }

    const cur = byId.get(detail.id);
    sharesUp = cur?.sharesUp ?? 0n;
    sharesDown = cur?.sharesDown ?? 0n;

    /** Latest past round (not current id) with any shares — for “where did my trade go?” */
    let bestRid = -1n;
    let best: { sharesUp: bigint; sharesDown: bigint } | null = null;
    for (const [ridStr, pos] of byId) {
      if (ridStr === detail.id) continue;
      if (pos.sharesUp === 0n && pos.sharesDown === 0n) continue;
      const ridBn = BigInt(ridStr);
      if (ridBn > bestRid) {
        bestRid = ridBn;
        best = pos;
      }
    }
    if (best && bestRid >= 0n) {
      pastRoundPosition = {
        roundId: bestRid.toString(),
        sharesUp: best.sharesUp,
        sharesDown: best.sharesDown,
      };
    }
  }

  const outcomeLabel =
    detail.kind === "round" && detail.phase === "Resolved" && detail.outcomeUp !== null
      ? detail.outcomeUp
        ? "UP"
        : "DOWN"
      : null;

  return {
    market,
    detail,
    sharesUp,
    sharesDown,
    pastRoundPosition,
    canTryClaim: isResolvedWinner(detail, sharesUp, sharesDown),
    outcomeLabel,
  };
}

export async function fetchProfileMarketSummaries(
  api: GearApi,
  account: string
): Promise<ProfileMarketSummary[]> {
  if (!MARKET_PROGRAM_ID) return [];

  const tradedKeys = getTradedAssetKeys(MARKET_PROGRAM_ID, account);
  const markets = MARKETS.filter((m) => tradedKeys.includes(m.assetKey));

  if (markets.length === 0) return [];

  const settled = await Promise.allSettled(
    markets.map((m) => fetchOne(api, MARKET_PROGRAM_ID!, m, account))
  );

  const out: ProfileMarketSummary[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    if (r.status === "fulfilled") {
      out.push(r.value);
    } else {
      out.push({
        market: markets[i]!,
        detail: { kind: "none" },
        sharesUp: 0n,
        sharesDown: 0n,
        pastRoundPosition: null,
        canTryClaim: false,
        outcomeLabel: null,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }

  return out.sort((a, b) => {
    if (a.canTryClaim !== b.canTryClaim) return a.canTryClaim ? -1 : 1;
    const aHas = a.sharesUp > 0n || a.sharesDown > 0n || a.pastRoundPosition != null;
    const bHas = b.sharesUp > 0n || b.sharesDown > 0n || b.pastRoundPosition != null;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.market.slug.localeCompare(b.market.slug);
  });
}

export async function fetchCreatedMarkets(api: GearApi): Promise<CreatedMarketInfo[]> {
  if (!MARKET_PROGRAM_ID || !getAdminWallet()) return [];

  const results = await Promise.allSettled(
    MARKETS.map(async (market) => {
      const detail = await fetchMarketRoundDetail(api, MARKET_PROGRAM_ID!, market.assetKey, getAdminWallet());
      let status: CreatedMarketInfo["status"] = "no_round";
      let roundCount = 0;

      if (detail.kind === "round") {
        roundCount = parseInt(detail.id, 10);
        if (detail.phase === "Resolved") {
          status = "ended";
        } else if (detail.phase === "Open" || detail.phase === "Locked") {
          status = "active";
        }
      }

      return {
        market,
        detail,
        roundCount,
        status,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<CreatedMarketInfo> => r.status === "fulfilled")
    .map((r) => r.value);
}
