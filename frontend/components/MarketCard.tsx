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
  sui: "https://cryptologos.cc/logos/sui-sui-logo.png?v=040",
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
  sparklinePoints?: string;
  price?: number;
  /** True while the rolling epoch transition is in progress (SettleAndRoll mid-flight). */
  isSettling?: boolean;
}

function parseNum(v?: string): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(v: string): string {
  if (!v || v === "0") return "--";
  const num = parseFloat(v);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

function shortTeam(name: string): string {
  const clean = name.trim();
  if (!clean) return "TEAM";
  return clean.length > 14 ? `${clean.slice(0, 14)}...` : clean;
}

function buildSparkPoints(upPct: number): string {
  const sparkTemplate = [22, 19, 20, 16, 18, 15, 16, 13, 14, 11, 13, 10];
  const momentum = (upPct - 50) / 50;
  return sparkTemplate
    .map((v, i) => {
      const x = 10 + i * 18;
      const drift = (i - 5) * 0.25;
      const y = Math.max(8, Math.min(32, v - momentum * 5 + drift));
      return `${x},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function MarketCard({ market, phase, connected, imageUrl, poolData, sportsData, sparklinePoints, price, isSettling }: MarketCardProps) {
  const displayImage = imageUrl || COIN_ICONS[market.slug] || "/favicon.ico";
  const isSports = market.assetKey.startsWith("SPORT/") && !!sportsData;
  const phaseText =
    !connected || !MARKET_PROGRAM_ID
      ? "CONNECT"
      : isSettling
        ? "SETTLING..."
        : phase === "error"
          ? "RPC ERROR"
          : phase === undefined
            ? "LOADING"
            : phaseBadgeLabel(phase).toUpperCase();

  const upPool = parseNum(poolData?.reserveUp);
  const downPool = parseNum(poolData?.reserveDown);
  const totalPool = Math.max(parseNum(poolData?.totalLiquidity), upPool + downPool);

  const upPct = totalPool > 0 ? Math.round((upPool / totalPool) * 100) : 50;
  const downPct = Math.max(0, 100 - upPct);

  const upLine = poolData ? `↑ ${poolData.oddsUp}x` : "↑ --";
  const downLine = poolData ? `↓ ${poolData.oddsDown}x` : "↓ --";
  const volumeLine = poolData ? `${formatAmount(poolData.totalLiquidity)} FIN Vol.` : "-- Vol.";

  const trendUp = upPct >= downPct;
  const headlinePct = trendUp ? upPct : downPct;
  const spreadPct = Math.abs(upPct - downPct);
  const trendLabel = trendUp ? "UP" : "DOWN";
  const oddsLabel = trendUp ? upLine : downLine;
  const oddsValue = trendUp ? poolData?.oddsUp : poolData?.oddsDown;
  const sparkPoints = buildSparkPoints(upPct);

  if (isSports && sportsData) {
    const start = sportsData.startingAt ? new Date(sportsData.startingAt) : null;
    const favHome = upPct >= downPct;

    return (
      <Link
        href={`/market/${market.slug}`}
        className="group relative flex min-h-[230px] flex-col overflow-hidden rounded-[28px] border border-[#1f3347] bg-[radial-gradient(125%_160%_at_8%_0%,#1a2a3a_0%,#101925_45%,#0c141d_100%)] p-4 shadow-[0_20px_45px_rgba(2,9,16,0.55)] no-underline [text-decoration:none] hover:no-underline hover:[text-decoration:none] transition hover:-translate-y-0.5 hover:border-[#2c4b67]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_95%_0%,rgba(26,141,226,0.18)_0%,rgba(26,141,226,0)_100%)]" />

        <div className="relative flex items-start justify-between gap-3 pr-24">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#d9e6f2]">{sportsData.leagueName ?? "Sports Market"}</p>
            <p className="mt-0.5 truncate text-xs uppercase tracking-[0.14em] text-[#7f95aa]">
              {shortTeam(sportsData.homeName)} vs {shortTeam(sportsData.awayName)}
            </p>
          </div>
          <div className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-[18px] rounded-tr-[20px] border border-[#2a455f] border-r-0 border-t-0 bg-[#0d1722]/95 px-3 py-1.5 text-[10px] font-semibold text-[#89a0b5]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f49b22]" />
            {phaseText}
          </div>
        </div>

        <div className="relative mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[2.2rem] leading-none text-[#f2f7fc]">{headlinePct}%</div>
            <p className="mt-1 text-xs text-[#9bb0c5]">
              {favHome ? shortTeam(sportsData.homeName) : shortTeam(sportsData.awayName)} momentum
            </p>
          </div>
          <div className="rounded-xl border border-[#2a435d] bg-[#101a26] px-2.5 py-2 text-right">
            <div className={`text-sm font-semibold ${trendUp ? "text-[#39d27d]" : "text-[#f26b73]"}`}>
              {trendUp ? "+" : "-"}
              {spreadPct}%
            </div>
            <div className="mt-0.5 text-[11px] text-[#8ea4b8]">{oddsValue ? `${oddsValue}x odds` : "-- odds"}</div>
          </div>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-2xl border border-[#2d4f6f] bg-[linear-gradient(135deg,#11273a_0%,#17324a_50%,#11263a_100%)] p-3">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_20%_15%,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_100%)]" />
          <div className="relative flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {sportsData.homeLogo ? (
                <img src={sportsData.homeLogo} alt={sportsData.homeName} className="h-6 w-6 rounded-md object-cover ring-1 ring-black/20" />
              ) : (
                <div className="h-6 w-6 rounded-md bg-[#24384c]" />
              )}
              {sportsData.awayLogo ? (
                <img src={sportsData.awayLogo} alt={sportsData.awayName} className="-ml-1 h-6 w-6 rounded-md object-cover ring-1 ring-black/20" />
              ) : (
                <div className="-ml-1 h-6 w-6 rounded-md bg-[#24384c]" />
              )}
            </div>
            <span className="rounded-full bg-[#0f1f2e]/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8dc3ec]">
              5 Min
            </span>
          </div>

          <svg viewBox="0 0 220 38" className="relative mt-2 h-10 w-full" fill="none" aria-hidden="true">
            <polyline points={sparkPoints} stroke="#a7daff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="176" y1="10" x2="214" y2="10" stroke="#6f9abd" strokeDasharray="2 3" strokeWidth="1.6" />
          </svg>

          <div className="relative mt-1 flex items-center justify-between text-[10px] font-semibold text-[#132231]">
            <span>{shortTeam(sportsData.homeName)}</span>
            <span>{shortTeam(sportsData.awayName)}</span>
          </div>
        </div>

        <div className="relative mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-[#a8bbcc]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#24405b] bg-[#0f1925] px-2 py-1">
            <span className={`h-1.5 w-1.5 rounded-full ${phaseText === "OPEN" ? "bg-[#39d27d]" : "bg-[#f49b22]"}`} />
            {phaseText === "OPEN" ? "Open" : phaseText}
          </span>
          <span className="inline-flex items-center rounded-full border border-[#24405b] bg-[#0f1925] px-2 py-1">
            {volumeLine}
          </span>
          <span className="inline-flex items-center rounded-full border border-[#24405b] bg-[#0f1925] px-2 py-1">
            #{sportsData.fixtureId}
          </span>
          {start ? (
            <span className="inline-flex items-center rounded-full border border-[#24405b] bg-[#0f1925] px-2 py-1">
              {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/market/${market.slug}`}
      className="group relative flex min-h-[230px] flex-col overflow-hidden rounded-[28px] border border-[#1f3347] bg-[radial-gradient(125%_160%_at_8%_0%,#1a2a3a_0%,#101925_45%,#0c141d_100%)] p-4 shadow-[0_20px_45px_rgba(2,9,16,0.55)] no-underline [text-decoration:none] hover:no-underline hover:[text-decoration:none] transition hover:-translate-y-0.5 hover:border-[#2c4b67]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_95%_0%,rgba(26,141,226,0.18)_0%,rgba(26,141,226,0)_100%)]" />

      <div className="relative flex items-start justify-between gap-3 pr-24">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[#27405a] bg-[#111c29] p-2">
            <Image
              src={displayImage}
              alt={market.label}
              fill
              className="object-contain p-1"
              unoptimized
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#d9e6f2]">{market.label}</p>
            <p className="mt-0.5 truncate text-xs uppercase tracking-[0.14em] text-[#7f95aa]">{market.slug}</p>
          </div>
        </div>
        <div className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-[18px] rounded-tr-[20px] border border-[#2a455f] border-r-0 border-t-0 bg-[#0d1722]/95 px-3 py-1.5 text-[10px] font-semibold text-[#89a0b5]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f49b22]" />
          {phaseText}
        </div>
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[2.2rem] leading-none text-[#f2f7fc]">{headlinePct}%</div>
          <p className="mt-1 text-xs text-[#9bb0c5]">{trendLabel} sentiment</p>
        </div>
        <div className="rounded-xl border border-[#2a435d] bg-[#101a26] px-2.5 py-2 text-right">
          <div className={`text-sm font-semibold ${trendUp ? "text-[#39d27d]" : "text-[#f26b73]"}`}>
            {trendUp ? "+" : "-"}
            {spreadPct}%
          </div>
          <div className="mt-0.5 text-[11px] text-[#8ea4b8]">{oddsValue ? `${oddsValue}x odds` : "-- odds"}</div>
        </div>
      </div>

      <p className="relative mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#92a9bf]">Round Momentum</p>

      <div className="relative mt-2 overflow-hidden rounded-2xl border border-[#2d4f6f] bg-[linear-gradient(135deg,#11273a_0%,#17324a_50%,#11263a_100%)] p-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_20%_15%,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_100%)]" />
        <div className="relative flex items-start justify-between gap-2">
          <div className="text-[11px] font-semibold text-[#152433]">
            <div>{upPct}% UP</div>
            <div>{downPct}% DOWN</div>
          </div>
          <span className="rounded-full bg-[#0f1f2e]/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8dc3ec]">
            5 Min
          </span>
        </div>

        <svg viewBox="0 0 220 38" className="relative mt-2 h-10 w-full" fill="none" aria-hidden="true">
          <polyline
            points={sparklinePoints && sparklinePoints.length > 0 ? sparklinePoints : sparkPoints}
            stroke="#a7daff"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line x1="176" y1="10" x2="214" y2="10" stroke="#6f9abd" strokeDasharray="2 3" strokeWidth="1.6" />
        </svg>

        <div className="relative mt-1 flex items-center justify-between text-[10px] font-semibold text-[#132231]">
          <span>Start</span>
          <span>Now</span>
        </div>
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-[#a8bbcc]">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#24405b] bg-[#0f1925] px-2 py-1">
          <span className={`h-1.5 w-1.5 rounded-full ${phaseText === "OPEN" ? "bg-[#39d27d]" : "bg-[#f49b22]"}`} />
          {phaseText === "OPEN" ? "Open" : phaseText}
        </span>
        <span className="inline-flex items-center rounded-full border border-[#24405b] bg-[#0f1925] px-2 py-1">FIN</span>
        <span className="inline-flex items-center rounded-full border border-[#24405b] bg-[#0f1925] px-2 py-1">{volumeLine}</span>
        <span className="inline-flex items-center rounded-full border border-[#24405b] bg-[#0f1925] px-2 py-1">{oddsLabel}</span>
      </div>
    </Link>
  );
}