"use client";

import Image from "next/image";
import Link from "next/link";
import { phaseBadgeLabel, type MarketRoundSnapshot } from "@/lib/fin-get-round";
import { MARKET_PROGRAM_ID } from "@/lib/config";
import type { MarketMeta } from "@/lib/markets";

const COIN_ICONS: Record<string, string> = {
  btc: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  sol: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  bnb: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2.png",
  avax: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  ton: "https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png",
  hype: "https://assets.coingecko.com/coins/images/33499/small/hyperliquid.png"
};

export interface PoolData {
  reserveUp: string;
  reserveDown: string;
  totalLiquidity: string;
  oddsUp: string;
  oddsDown: string;
}

export interface SportsCardData {
  fixtureId: number;
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  leagueName?: string;
  startingAt?: string;
}

interface MarketCardProps {
  market: MarketMeta;
  phase: MarketRoundSnapshot | "error" | undefined;
  connected: boolean;
  imageUrl?: string;
  poolData?: PoolData;
  sportsData?: SportsCardData;
}

export function MarketCard({ market, phase, connected, imageUrl, poolData, sportsData }: MarketCardProps) {
  const displayImage = imageUrl || COIN_ICONS[market.slug];
  const isSports = market.assetKey.startsWith("SPORT/") && !!sportsData;
  const phaseText =
    !connected || !MARKET_PROGRAM_ID
      ? "CONNECT"
      : phase === "error"
        ? "RPC ERROR"
        : phase === undefined
          ? "LOADING"
          : phaseBadgeLabel(phase).toUpperCase();

  const parseNum = (v?: string) => {
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const formatAmount = (val: string) => {
    if (!val || val === "0") return "--";
    const num = parseFloat(val);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toFixed(0);
  };

  const upPool = parseNum(poolData?.reserveUp);
  const downPool = parseNum(poolData?.reserveDown);
  const totalPool = Math.max(parseNum(poolData?.totalLiquidity), upPool + downPool);

  const upPct = totalPool > 0 ? Math.round((upPool / totalPool) * 100) : 50;
  const downPct = Math.max(0, 100 - upPct);

  const upLine = poolData ? `\u2191 ${poolData.oddsUp}x` : "\u2191 --";
  const downLine = poolData ? `\u2193 ${poolData.oddsDown}x` : "\u2193 --";
  const volumeLine = poolData ? `${formatAmount(poolData.totalLiquidity)} FIN Vol.` : "-- Vol.";

  const shortTeam = (name: string) => {
    const clean = name.trim();
    if (!clean) return "TEAM";
    return clean.length > 14 ? `${clean.slice(0, 14)}...` : clean;
  };

  if (isSports && sportsData) {
    const start = sportsData.startingAt ? new Date(sportsData.startingAt) : null;
    const homeMarker = upPct >= downPct ? "1" : "0";
    const awayMarker = upPct >= downPct ? "0" : "1";

    return (
      <Link
        href={`/market/${market.slug}`}
        className="group relative flex min-h-[190px] flex-col rounded-2xl border border-[#2a394a] bg-[linear-gradient(180deg,#1b2734_0%,#161f2b_100%)] p-3 sm:p-4 transition hover:-translate-y-0.5 hover:border-[#3d5169]"
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {sportsData.homeLogo ? (
                <img src={sportsData.homeLogo} alt={sportsData.homeName} className="h-5 w-5 rounded-sm object-cover" />
              ) : (
                <div className="h-5 w-5 rounded-sm bg-[#2b3a4b]" />
              )}
              <span className="text-lg leading-none text-[#dce7f3]">{homeMarker}</span>
              <span className="truncate text-xl sm:text-2xl font-semibold leading-none text-[#eff5fd]">{shortTeam(sportsData.homeName).toUpperCase()}</span>
            </div>
            <span className="text-2xl sm:text-3xl font-semibold leading-none text-[#eff5fd]">{upPct}%</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {sportsData.awayLogo ? (
                <img src={sportsData.awayLogo} alt={sportsData.awayName} className="h-5 w-5 rounded-sm object-cover" />
              ) : (
                <div className="h-5 w-5 rounded-sm bg-[#2b3a4b]" />
              )}
              <span className="text-lg leading-none text-[#dce7f3]">{awayMarker}</span>
              <span className="truncate text-xl sm:text-2xl font-semibold leading-none text-[#eff5fd]">{shortTeam(sportsData.awayName).toUpperCase()}</span>
            </div>
            <span className="text-2xl sm:text-3xl font-semibold leading-none text-[#eff5fd]">{downPct}%</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[#194b6a] px-2 py-1.5 text-center text-xs sm:text-sm font-semibold leading-none tracking-tight text-[#18d2ff]">
            {shortTeam(sportsData.homeName).toUpperCase()}
          </div>
          <div className="rounded-xl bg-[#5b1f2f] px-2 py-1.5 text-center text-xs sm:text-sm font-semibold leading-none tracking-tight text-[#ff2953]">
            {shortTeam(sportsData.awayName).toUpperCase()}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="flex min-w-0 items-center gap-2 text-[#8ea1b4]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff3f45]" />
            <span className="truncate text-[#d6e0ec]">Game {sportsData.fixtureId}</span>
            <span className="truncate font-semibold text-[#7f91a7]">{volumeLine}</span>
            <span className="truncate text-[#7f91a7]">{sportsData.leagueName ?? "SPORT"}</span>
          </div>
          <div className="flex items-center gap-2 text-[#92a6ba]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path d="M6 8h12l-1.5 11h-9z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path d="M6 4h12v16l-6-4-6 4z" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </div>
        </div>

        {start ? (
          <div className="mt-1 text-xs text-[#7f91a7]">
            {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-2 right-2 rounded-full border border-[#2a3b4b] bg-[#111b25] px-2 py-0.5 text-[9px] font-semibold text-[#8ea3b7]">
          {phaseText}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/market/${market.slug}`}
      className="group relative flex min-h-[170px] sm:min-h-[200px] md:min-h-[220px] flex-col rounded-xl sm:rounded-2xl border border-[#1e2f40] bg-[linear-gradient(105deg,#121c26_0%,#1a2632_100%)] p-3 sm:p-4 transition hover:-translate-y-0.5 hover:border-[#2d475f]"
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="relative h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 shrink-0 overflow-hidden rounded-lg sm:rounded-xl bg-[#233142] p-1.5 sm:p-2">
          <Image
            src={displayImage}
            alt={market.label}
            fill
            className="object-contain p-1 sm:p-2"
            unoptimized
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm sm:text-base md:text-lg font-semibold leading-tight text-[#d7e0e8]">
             {market.label} 5 minute up or down
          </div>
        </div>
      </div>

      <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] items-center gap-1 sm:gap-2">
          <div className="text-base sm:text-xl md:text-2xl font-medium text-[#cbd6df]">{upLine}</div>
          <div className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#d8e4ef]">{upPct}%</div>
          <span className="hidden sm:inline-block rounded-lg bg-[#1c4938] px-2 sm:px-3 py-1 text-sm md:text-base font-semibold leading-none text-[#41cf82]">
            Yes
          </span>
          <span className="hidden sm:inline-block rounded-lg bg-[#4a2b31] px-2 sm:px-3 py-1 text-sm md:text-base font-semibold leading-none text-[#ff4d57]">
            No
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] items-center gap-1 sm:gap-2">
          <div className="text-base sm:text-xl md:text-2xl font-medium text-[#cbd6df]">{downLine}</div>
          <div className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#d8e4ef]">{downPct}%</div>
          <span className="hidden sm:inline-block rounded-lg bg-[#1c4938] px-2 sm:px-3 py-1 text-sm md:text-base font-semibold leading-none text-[#41cf82]">
            Yes
          </span>
          <span className="hidden sm:inline-block rounded-lg bg-[#4a2b31] px-2 sm:px-3 py-1 text-sm md:text-base font-semibold leading-none text-[#ff4d57]">
            No
          </span>
        </div>
      </div>

      <div className="mt-auto flex items-end justify-start pt-3 sm:pt-4">
        <div>
          <div className="flex items-center gap-1.5 text-[#ff3d42]">
            <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-[#ff3d42]" />
            <span className="text-sm sm:text-base md:text-lg font-medium tracking-wide">LIVE</span>
          </div>
          <div className="mt-1 text-sm sm:text-base md:text-lg text-[#7f93a7]">{volumeLine}</div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-2 sm:bottom-3 right-2 sm:right-3 rounded-full border border-[#2a3b4b] bg-[#111b25] px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-semibold text-[#8ea3b7]">
        {phaseText}
      </div>
    </Link>
  );
}
