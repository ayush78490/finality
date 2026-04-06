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
  { slug: "hype", label: "Hyperliquid", short: "HYPE", diaSymbol: "HYPE", assetId: 6, assetKey: "HYPE/USD", accent: "risk" },
  { slug: "doge", label: "Dogecoin", short: "DOGE", diaSymbol: "DOGE", assetId: 7, assetKey: "DOGE/USD", accent: "mist" },
  { slug: "xrp", label: "XRP", short: "XRP", diaSymbol: "XRP", assetId: 8, assetKey: "XRP/USD", accent: "ember" },
  { slug: "ada", label: "Cardano", short: "ADA", diaSymbol: "ADA", assetId: 9, assetKey: "ADA/USD", accent: "shore" },
  { slug: "dot", label: "Polkadot", short: "DOT", diaSymbol: "DOT", assetId: 10, assetKey: "DOT/USD", accent: "risk" },
  { slug: "link", label: "Chainlink", short: "LINK", diaSymbol: "LINK", assetId: 11, assetKey: "LINK/USD", accent: "ember" },
  { slug: "ltc", label: "Litecoin", short: "LTC", diaSymbol: "LTC", assetId: 12, assetKey: "LTC/USD", accent: "mist" },
  { slug: "matic", label: "Polygon", short: "MATIC", diaSymbol: "MATIC", assetId: 13, assetKey: "MATIC/USD", accent: "shore" },
  { slug: "arb", label: "Arbitrum", short: "ARB", diaSymbol: "ARB", assetId: 14, assetKey: "ARB/USD", accent: "risk" },
  { slug: "op", label: "Optimism", short: "OP", diaSymbol: "OP", assetId: 15, assetKey: "OP/USD", accent: "ember" },
  { slug: "near", label: "NEAR Protocol", short: "NEAR", diaSymbol: "NEAR", assetId: 16, assetKey: "NEAR/USD", accent: "mist" },
  { slug: "fil", label: "Filecoin", short: "FIL", diaSymbol: "FIL", assetId: 17, assetKey: "FIL/USD", accent: "shore" },
  { slug: "atom", label: "Cosmos", short: "ATOM", diaSymbol: "ATOM", assetId: 18, assetKey: "ATOM/USD", accent: "risk" },
  { slug: "inj", label: "Injective", short: "INJ", diaSymbol: "INJ", assetId: 19, assetKey: "INJ/USD", accent: "ember" },
  { slug: "tia", label: "Celestia", short: "TIA", diaSymbol: "TIA", assetId: 20, assetKey: "TIA/USD", accent: "mist" },
  { slug: "sei", label: "Sei", short: "SEI", diaSymbol: "SEI", assetId: 21, assetKey: "SEI/USD", accent: "shore" },
  { slug: "wld", label: "Worldcoin", short: "WLD", diaSymbol: "WLD", assetId: 22, assetKey: "WLD/USD", accent: "risk" },
  { slug: "pepe", label: "Pepe", short: "PEPE", diaSymbol: "PEPE", assetId: 23, assetKey: "PEPE/USD", accent: "ember" },
  { slug: "shib", label: "Shiba Inu", short: "SHIB", diaSymbol: "SHIB", assetId: 24, assetKey: "SHIB/USD", accent: "mist" },
  { slug: "trx", label: "TRON", short: "TRX", diaSymbol: "TRX", assetId: 25, assetKey: "TRX/USD", accent: "shore" },
  { slug: "bch", label: "Bitcoin Cash", short: "BCH", diaSymbol: "BCH", assetId: 26, assetKey: "BCH/USD", accent: "risk" },
  { slug: "etc", label: "Ethereum Classic", short: "ETC", diaSymbol: "ETC", assetId: 27, assetKey: "ETC/USD", accent: "ember" },
  { slug: "uni", label: "Uniswap", short: "UNI", diaSymbol: "UNI", assetId: 28, assetKey: "UNI/USD", accent: "mist" },
  { slug: "aave", label: "Aave", short: "AAVE", diaSymbol: "AAVE", assetId: 29, assetKey: "AAVE/USD", accent: "shore" }
];

export function marketBySlug(slug: string) {
  return MARKETS.find((m) => m.slug === slug);
}
