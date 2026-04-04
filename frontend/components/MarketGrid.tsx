"use client";

import { useEffect, useState } from "react";
import { fetchAllMarketRoundSnapshots, fetchAllMarketRoundDetails, type MarketRoundSnapshot, type MarketRoundDetail } from "@/lib/fin-get-round";
import { MARKET_PROGRAM_ID } from "@/lib/config";
import { MARKETS } from "@/lib/markets";
import { useWallet } from "@/lib/wallet";
import { MarketCard, type PoolData } from "@/components/MarketCard";

const COIN_ICONS: Record<string, string> = {
  btc: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  sol: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  bnb: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2.png",
  avax: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  ton: "https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png",
  hype: "https://assets.coingecko.com/coins/images/33499/small/hyperliquid.png"
};

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

const POLL_MS = 20_000;

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
    if (!api || !MARKET_PROGRAM_ID) return;
    let cancelled = false;
    
    const run = async () => {
      try {
        const [nextPhases, nextDetails] = await Promise.all([
          fetchAllMarketRoundSnapshots(api, MARKET_PROGRAM_ID, MARKETS, account),
          fetchAllMarketRoundDetails(api, MARKET_PROGRAM_ID, MARKETS, account)
        ]);
        if (!cancelled) {
          setPhases(nextPhases);
          setDetails(nextDetails);
        }
      } catch {
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