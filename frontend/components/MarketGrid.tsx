"use client";

import { useEffect, useState } from "react";
import { fetchAllMarketRoundSnapshots, fetchAllMarketRoundDetails, type MarketRoundSnapshot, type MarketRoundDetail } from "@/lib/fin-get-round";
import { MARKET_PROGRAM_ID } from "@/lib/config";
import { MARKETS } from "@/lib/markets";
import { useWallet } from "@/lib/wallet";
import { MarketCard, type PoolData } from "@/components/MarketCard";
import { binanceSymbolForMarket, fetchHistoricalKlines, type Kline } from "@/lib/binance";

const COIN_ICONS: Record<string, string> = {
  btc: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  sol: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  bnb: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2.png",
  avax: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  ton: "https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png",
  hype: "https://assets.coingecko.com/coins/images/33499/small/hyperliquid.png",
  doge: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  xrp: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-888.png",
  ada: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
  dot: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
  link: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  ltc: "https://assets.coingecko.com/coins/images/2/small/litecoin.png",
  matic: "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
  arb: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.png",
  op: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
  near: "https://assets.coingecko.com/coins/images/10365/small/near.jpg",
  fil: "https://assets.coingecko.com/coins/images/12817/small/filecoin.png",
  atom: "https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png",
  inj: "https://assets.coingecko.com/coins/images/12882/small/Secondary_Symbol.png",
  tia: "https://assets.coingecko.com/coins/images/31967/small/tia.jpg",
  sei: "https://assets.coingecko.com/coins/images/28285/small/Sei_Logo_-_Transparent.png",
  wld: "https://assets.coingecko.com/coins/images/31069/small/worldcoin.jpeg",
  pepe: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg",
  shib: "https://assets.coingecko.com/coins/images/11939/small/shiba.png",
  trx: "https://assets.coingecko.com/coins/images/1094/small/tron-logo.png",
  bch: "https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png",
  etc: "https://assets.coingecko.com/coins/images/453/small/ethereum-classic-logo.png",
  uni: "https://assets.coingecko.com/coins/images/12504/small/uni.jpg",
  aave: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png"
};

type PriceChange = { percent: number; direction: "up" | "down" } | null;

async function fetch5MinPriceChange(diaSymbol: string): Promise<PriceChange> {
  try {
    const binanceSym = binanceSymbolForMarket({ diaSymbol, binanceSymbol: undefined });
    const klines = await fetchHistoricalKlines(binanceSym, "5m", 2);
    if (klines.length < 2) return null;
    
    const currentClose = klines[klines.length - 1].close;
    const oldOpen = klines[klines.length - 2].open;
    
    if (oldOpen === 0) return null;
    
    const percentChange = ((currentClose - oldOpen) / oldOpen) * 100;
    return {
      percent: Math.abs(percentChange),
      direction: percentChange >= 0 ? "up" : "down"
    };
  } catch {
    return null;
  }
}

function badgeColorClass(
  snap: MarketRoundSnapshot | "error" | undefined
): string {
  if (snap === undefined) return "border-line bg-ink/40 text-mist/70";
  if (snap === "error") return "border-risk/40 bg-risk/10 text-risk";
  if (snap.kind === "none") return "border-line bg-ink/40 text-mist/60";
  switch (snap.phase) {
    case "Open":
      return "border-shore/40 bg-shore/10 text-shore";
    case "Locked":
      return "border-ember/35 bg-ember/10 text-ember";
    case "Resolved":
      return "border-mist/30 bg-ink/60 text-mist";
    default:
      return "border-line bg-ink/40 text-mist";
  }
}

const POLL_MS = 8_000;

function computePoolData(detail: MarketRoundDetail | "error" | undefined): PoolData | undefined {
  if (!detail || detail === "error" || detail.kind === "none") return undefined;
  
  const { reserveUp, reserveDown } = detail;
  
  // FIN has 12 decimals
  const upDecimals = Number(reserveUp) / 1e12;
  const downDecimals = Number(reserveDown) / 1e12;
  
  // Compute odds: each side's odds = totalLiquidity / thatSideLiquidity
  const totalLiquidity = upDecimals + downDecimals;
  const oddsUp = totalLiquidity / upDecimals;
  const oddsDown = totalLiquidity / downDecimals;
  
  return {
    reserveUp: upDecimals.toFixed(0),
    reserveDown: downDecimals.toFixed(0),
    totalLiquidity: totalLiquidity.toFixed(0),
    oddsUp: oddsUp.toFixed(2),
    oddsDown: oddsDown.toFixed(2)
  };
}

type PhaseMap = Record<string, MarketRoundSnapshot | "error">;
type DetailMap = Record<string, MarketRoundDetail | "error">;

export function MarketGrid() {
  const { api, account } = useWallet();
  const [phases, setPhases] = useState<PhaseMap>({});
  const [details, setDetails] = useState<DetailMap>({});

  useEffect(() => {
    if (!api || !MARKET_PROGRAM_ID) {
      console.log('[MarketGrid] Skipping fetch - api:', !!api, 'MARKET_PROGRAM_ID:', MARKET_PROGRAM_ID);
      return;
    }
    console.log('[MarketGrid] Starting fetch - api ready, MARKET_PROGRAM_ID:', MARKET_PROGRAM_ID);
    let cancelled = false;
    
    const run = async () => {
      try {
        console.log('[MarketGrid] Fetching round data for markets:', MARKETS.map(m => m.slug));
        const [nextPhases, nextDetails] = await Promise.all([
          fetchAllMarketRoundSnapshots(api, MARKET_PROGRAM_ID, MARKETS, account),
          fetchAllMarketRoundDetails(api, MARKET_PROGRAM_ID, MARKETS, account)
        ]);
        console.log('[MarketGrid] Fetched phases:', nextPhases);
        console.log('[MarketGrid] Fetched details keys:', Object.keys(nextDetails));
        
        // Log each market's phase and id for debugging
        for (const m of MARKETS) {
          const phase = nextPhases[m.slug];
          const detail = nextDetails[m.slug];
          if (phase && phase !== "error" && phase.kind === "round") {
            console.log(`[MarketGrid] ${m.slug}: phase=${phase.phase}, id=${(detail as any)?.id || 'no detail'}`);
          } else if (phase === "error") {
            console.log(`[MarketGrid] ${m.slug}: ERROR`);
          } else if (phase?.kind === "none") {
            console.log(`[MarketGrid] ${m.slug}: no round`);
          }
        }
        
        if (!cancelled) {
          setPhases(nextPhases);
          setDetails(nextDetails);
        }
      } catch (e) {
        console.error('[MarketGrid] Error fetching rounds:', e);
        if (!cancelled) {
          setPhases({});
          setDetails({});
        }
      }
    };
    
    void run();
    const id = window.setInterval(() => void run(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [api, account]);

  return (
    <section className="mx-auto max-w-6xl px-2 sm:px-4 pb-8 sm:pb-12 md:pb-16 pt-4 sm:pt-6 md:pt-8">
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {MARKETS.map((m) => (
          <MarketCard
            key={m.slug}
            market={m}
            phase={phases[m.slug]}
            connected={!!api && !!MARKET_PROGRAM_ID}
            imageUrl={COIN_ICONS[m.slug]}
            poolData={computePoolData(details[m.slug])}
          />
        ))}
      </div>
    </section>
  );
}