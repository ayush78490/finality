/**
 * Spot price from Binance public API (no API key for /api/v3/ticker/price).
 * Scaled 8-decimal price for `Oracle.submit_round` / `OracleTick`-compatible display (u128 + expo -8).
 */
export type BinanceTick = {
  price: bigint;
  conf: bigint;
  expo: number;
  publishTimeSec: bigint;
};

const EXPO = -8;

function binanceHttpTimeoutMs(): number {
  const raw = process.env.BINANCE_HTTP_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 8000;
}

export function binanceSymbolForFeed(feed: {
  diaSymbol: string;
  binanceSymbol?: string;
}): string {
  if (feed.binanceSymbol?.trim()) return feed.binanceSymbol.trim().toUpperCase();
  return `${feed.diaSymbol.toUpperCase()}USDT`;
}

export async function fetchBinanceSpotTick(symbol: string): Promise<BinanceTick> {
  const sym = symbol.toUpperCase();
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`;
  const controller = new AbortController();
  const timeoutMs = binanceHttpTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Binance request failed for ${sym}: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Binance ${res.status} ${sym}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { price?: string };
  const p = j.price != null ? Number.parseFloat(j.price) : NaN;
  if (!Number.isFinite(p) || p <= 0) {
    throw new Error(`Binance invalid price for ${sym}`);
  }
  const scaled = BigInt(Math.round(p * 1e8));
  return {
    price: scaled,
    conf: 1n,
    expo: EXPO,
    publishTimeSec: BigInt(Math.floor(Date.now() / 1000)),
  };
}
