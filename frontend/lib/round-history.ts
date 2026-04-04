/**
 * Persist resolved round snapshots in localStorage. The contract only keeps one
 * Round per asset_key — when a new start_round runs, previous outcomes disappear
 * from chain state. We cache outcomes while the tab observes them so "Previous"
 * can show UP/DOWN and price context.
 */
import type { MarketMeta } from "./markets";

export type HistoryPoint = { t: number; price: number };

export type CachedRoundRecord = {
  roundId: string;
  assetKey: string;
  startTs: number;
  endTs: number;
  startPriceHuman: number;
  endPriceHuman: number | null;
  outcomeUp: boolean;
  chartPoints: HistoryPoint[];
};

const VERSION = 1;
const MAX = 36;

function key(programId: string, assetKey: string): string {
  const safe = assetKey.replace(/[^\w/-]/g, "_");
  return `finality_round_hist_v${VERSION}_${programId.slice(0, 20)}_${safe}`;
}

export function loadRoundHistory(
  programId: string,
  assetKey: string
): CachedRoundRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(programId, assetKey));
    if (!raw) return [];
    const j = JSON.parse(raw) as CachedRoundRecord[];
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function sortDedupe(records: CachedRoundRecord[]): CachedRoundRecord[] {
  const byId = new Map<string, CachedRoundRecord>();
  for (const r of records) {
    byId.set(r.roundId, r);
  }
  return [...byId.values()].sort((a, b) => b.endTs - a.endTs).slice(0, MAX);
}

export function upsertRoundRecord(
  programId: string,
  market: MarketMeta,
  record: CachedRoundRecord
): CachedRoundRecord[] {
  if (typeof window === "undefined") return [record];
  const prev = loadRoundHistory(programId, market.assetKey);
  const next = sortDedupe([record, ...prev]);
  try {
    window.localStorage.setItem(
      key(programId, market.assetKey),
      JSON.stringify(next)
    );
  } catch {
    /* quota */
  }
  return next;
}
