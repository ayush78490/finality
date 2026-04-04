import type { MarketMeta } from "./markets";

export function binanceSymbolForMarket(m: Pick<MarketMeta, "diaSymbol" | "binanceSymbol">): string {
  if (m.binanceSymbol?.trim()) return m.binanceSymbol.trim().toUpperCase();
  return `${m.diaSymbol.toUpperCase()}USDT`;
}

/**
 * Last trade price from Binance public API (no API key).
 * https://binance-docs.github.io/apidocs/spot/en/#symbol-price-ticker
 */
export async function fetchBinanceSpotPrice(symbol: string): Promise<number> {
  const sym = symbol.toUpperCase();
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Binance ${res.status}: ${t.slice(0, 120)}`);
  }
  const j = (await res.json()) as { price?: string };
  const p = j.price != null ? Number.parseFloat(j.price) : NaN;
  if (!Number.isFinite(p) || p <= 0) throw new Error(`Binance invalid price for ${sym}`);
  return p;
}

export interface Kline {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type KlineInterval = (typeof INTERVALS)[number];

/**
 * Fetch historical klines/candlestick data from Binance
 * https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
 */
export async function fetchHistoricalKlines(
  symbol: string,
  interval: KlineInterval = "5m",
  limit: number = 100
): Promise<Kline[]> {
  const sym = symbol.toUpperCase();
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${interval}&limit=${Math.min(limit, 1000)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Binance klines ${res.status}: ${t.slice(0, 120)}`);
  }
  const data = (await res.json()) as [
    number, // open time in milliseconds
    string, // open
    string, // high
    string, // low
    string, // close
    string, // volume
    number, // close time
    string, // quote asset volume
    number, // number of trades
    string, // taker buy base asset volume
    string, // taker buy quote asset volume
    string  // ignore
  ][];
  return data.map(d => ({
    t: d[0],
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5])
  }));
}
