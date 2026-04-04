export type MarketMeta = {
  slug: string;
  label: string;
  short: string;
  /** Must match `assetId` in `config/oracle.config.json` / on-chain `Oracle.add_asset` + `Fin.register_asset`. */
  assetId: number;
  /** DIA REST path segment: /v1/quotation/{diaSymbol} (legacy relayer only). */
  diaSymbol: string;
  /** Binance spot pair for live UI (default `{diaSymbol}USDT`). */
  binanceSymbol?: string;
  /** Same string as `register_asset` in `config/oracle.config.json` (`symbol`, e.g. `ETH/USD`). */
  assetKey: string;
  accent: "ember" | "shore" | "risk" | "mist";
};

// assetId order matches `Oracle.add_asset` then `Fin.register_asset` in bootstrap (0..n-1 on a fresh program).
export const MARKETS: MarketMeta[] = [
  { slug: "btc", label: "Bitcoin", short: "BTC", diaSymbol: "BTC", assetId: 0, assetKey: "BTC/USD", accent: "ember" },
  { slug: "eth", label: "Ethereum", short: "ETH", diaSymbol: "ETH", assetId: 1, assetKey: "ETH/USD", accent: "shore" },
  { slug: "sol", label: "Solana", short: "SOL", diaSymbol: "SOL", assetId: 2, assetKey: "SOL/USD", accent: "risk" },
  { slug: "bnb", label: "BNB", short: "BNB", diaSymbol: "BNB", assetId: 3, assetKey: "BNB/USD", accent: "mist" },
  { slug: "avax", label: "Avalanche", short: "AVAX", diaSymbol: "AVAX", assetId: 4, assetKey: "AVAX/USD", accent: "shore" },
  { slug: "ton", label: "TON", short: "TON", diaSymbol: "TON", assetId: 5, assetKey: "TON/USD", accent: "ember" },
  { slug: "hype", label: "Hyperliquid", short: "HYPE", diaSymbol: "HYPE", assetId: 6, assetKey: "HYPE/USD", accent: "risk" }
];

export function marketBySlug(slug: string) {
  return MARKETS.find((m) => m.slug === slug);
}
