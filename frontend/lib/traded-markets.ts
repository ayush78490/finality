/**
 * Persist which markets (assetKey) this wallet has traded on for this deployment,
 * and optional round ids (so the profile can query GetPosition for past rounds).
 * Written by trade-submit on a successful BuySide; read by the profile page.
 */

const VERSION = 2;
const CLAIMS_VERSION = 1;

function storageKey(programId: string, account: string): string {
  return `finality_traded_v${VERSION}_${programId.slice(0, 20)}_${account.slice(0, 20)}`;
}

/** Legacy v1 key (array of asset keys only). */
function storageKeyV1(programId: string, account: string): string {
  return `finality_traded_v1_${programId.slice(0, 20)}_${account.slice(0, 20)}`;
}

function claimsStorageKey(programId: string, account: string): string {
  return `finality_claims_v${CLAIMS_VERSION}_${programId.slice(0, 20)}_${account.slice(0, 20)}`;
}

type TradedStoreV2 = {
  assetKeys: string[];
  /** Round ids we've recorded from successful buys (per asset). */
  roundsByAsset: Record<string, string[]>;
};

type ClaimedEntry = {
  claimedAtMs: number;
  amountBase: string;
};

type ClaimsStoreV1 = {
  /** assetKey -> roundId -> claim metadata */
  claimedByAssetRound: Record<string, Record<string, ClaimedEntry>>;
};

function readV2(programId: string, account: string): TradedStoreV2 {
  if (typeof window === "undefined") {
    return { assetKeys: [], roundsByAsset: {} };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(programId, account));
    if (!raw) return migrateFromV1(programId, account);
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "assetKeys" in parsed) {
      const o = parsed as TradedStoreV2;
      return {
        assetKeys: Array.isArray(o.assetKeys) ? o.assetKeys : [],
        roundsByAsset:
          o.roundsByAsset && typeof o.roundsByAsset === "object"
            ? o.roundsByAsset
            : {},
      };
    }
    return migrateFromV1(programId, account);
  } catch {
    return { assetKeys: [], roundsByAsset: {} };
  }
}

function migrateFromV1(programId: string, account: string): TradedStoreV2 {
  if (typeof window === "undefined") return { assetKeys: [], roundsByAsset: {} };
  try {
    const raw = window.localStorage.getItem(storageKeyV1(programId, account));
    if (!raw) return { assetKeys: [], roundsByAsset: {} };
    const parsed = JSON.parse(raw) as unknown;
    const keys = Array.isArray(parsed) ? (parsed as string[]) : [];
    const store: TradedStoreV2 = { assetKeys: keys, roundsByAsset: {} };
    window.localStorage.setItem(storageKey(programId, account), JSON.stringify(store));
    return store;
  } catch {
    return { assetKeys: [], roundsByAsset: {} };
  }
}

function writeV2(programId: string, account: string, store: TradedStoreV2): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(programId, account), JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function readClaims(programId: string, account: string): ClaimsStoreV1 {
  if (typeof window === "undefined") {
    return { claimedByAssetRound: {} };
  }
  try {
    const raw = window.localStorage.getItem(claimsStorageKey(programId, account));
    if (!raw) return { claimedByAssetRound: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "claimedByAssetRound" in parsed &&
      (parsed as { claimedByAssetRound?: unknown }).claimedByAssetRound &&
      typeof (parsed as { claimedByAssetRound?: unknown }).claimedByAssetRound === "object"
    ) {
      return parsed as ClaimsStoreV1;
    }
    return { claimedByAssetRound: {} };
  } catch {
    return { claimedByAssetRound: {} };
  }
}

function writeClaims(programId: string, account: string, store: ClaimsStoreV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(claimsStorageKey(programId, account), JSON.stringify(store));
  } catch {
    /* quota */
  }
}

export function getTradedAssetKeys(programId: string, account: string): string[] {
  const v2 = readV2(programId, account);
  if (v2.assetKeys.length > 0) return [...new Set(v2.assetKeys)];
  const m = migrateFromV1(programId, account);
  return [...new Set(m.assetKeys)];
}

/** Round ids recorded from trades (for profile position lookup). */
export function getTradedRoundIdsForAsset(
  programId: string,
  account: string,
  assetKey: string
): string[] {
  const v2 = readV2(programId, account);
  return v2.roundsByAsset[assetKey] ?? [];
}

export function recordTradedMarket(
  programId: string,
  account: string,
  assetKey: string,
  roundId?: string
): void {
  if (typeof window === "undefined") return;
  const store = readV2(programId, account);
  if (!store.assetKeys.includes(assetKey)) {
    store.assetKeys = [...store.assetKeys, assetKey];
  }
  if (roundId) {
    const prev = store.roundsByAsset[assetKey] ?? [];
    if (!prev.includes(roundId)) {
      store.roundsByAsset[assetKey] = [...prev, roundId];
    }
  }
  writeV2(programId, account, store);
}

export function recordClaimedRound(
  programId: string,
  account: string,
  assetKey: string,
  roundId: string,
  amountBase: bigint
): void {
  if (typeof window === "undefined") return;
  const store = readClaims(programId, account);
  const byRound = store.claimedByAssetRound[assetKey] ?? {};
  byRound[roundId] = {
    claimedAtMs: Date.now(),
    amountBase: amountBase.toString(),
  };
  store.claimedByAssetRound[assetKey] = byRound;
  writeClaims(programId, account, store);
}

export function getClaimedRound(
  programId: string,
  account: string,
  assetKey: string,
  roundId: string
): { claimedAtMs: number; amountBase: bigint } | null {
  const store = readClaims(programId, account);
  const entry = store.claimedByAssetRound[assetKey]?.[roundId];
  if (!entry) return null;
  try {
    return {
      claimedAtMs: Number(entry.claimedAtMs) || 0,
      amountBase: BigInt(entry.amountBase || "0"),
    };
  } catch {
    return null;
  }
}
