"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketMeta } from "@/lib/markets";
import { useWallet } from "@/lib/wallet";
import { fetchMarketRoundDetail, type MarketRoundDetail } from "@/lib/fin-get-round";
import { MARKET_PROGRAM_ID } from "@/lib/config";
import { fetchUserPosition, type UserPositionSnap } from "@/lib/fin-position";
import { TradePanel } from "@/components/TradePanel";

type Props = {
  market: MarketMeta;
};

type ApiParticipant = {
  name?: string;
  image_path?: string;
  meta?: { location?: "home" | "away" };
};

type ApiFixture = {
  id: number;
  name?: string;
  state_id?: number;
  starting_at?: string;
  ending_at?: string;
  result_info?: string;
  league?: { name?: string };
  participants?: ApiParticipant[];
};

type ProbPoint = {
  t: number;
  up: number;
  down: number;
};

function parseFixtureId(assetKey: string): number | null {
  const m = assetKey.match(/^SPORT\/(\d+)\//i);
  if (!m?.[1]) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

function toPct(round: MarketRoundDetail | null): { up: number; down: number } {
  if (!round || round.kind !== "round") return { up: 50, down: 50 };
  const total = round.reserveUp + round.reserveDown;
  if (total <= 0n) return { up: 50, down: 50 };
  const up = Number((round.reserveUp * 10000n) / total) / 100;
  const down = Math.max(0, 100 - up);
  return { up, down };
}

function teamShort(name: string): string {
  const clean = name.trim().toUpperCase();
  if (!clean) return "TEAM";
  return clean.length > 11 ? `${clean.slice(0, 11)}...` : clean;
}

function chartPath(points: number[], width: number, height: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const y = height - (points[0] / 100) * height;
    return `M 0 ${y.toFixed(2)} L ${width} ${y.toFixed(2)}`;
  }
  return points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - (v / 100) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function SportsMarketConsole({ market }: Props) {
  const { api, account, refreshFinBalance } = useWallet();
  const [fixture, setFixture] = useState<ApiFixture | null>(null);
  const [roundDetail, setRoundDetail] = useState<MarketRoundDetail | null>(null);
  const [userPosition, setUserPosition] = useState<UserPositionSnap | null>(null);
  const [history, setHistory] = useState<ProbPoint[]>([]);

  const fixtureId = useMemo(() => parseFixtureId(market.assetKey), [market.assetKey]);

  const fetchRoundNow = useCallback(async () => {
    if (!api || !MARKET_PROGRAM_ID) return;
    try {
      const next = await fetchMarketRoundDetail(api, MARKET_PROGRAM_ID, market.assetKey, account);
      setRoundDetail(next);
      const p = toPct(next);
      setHistory((prev) => {
        const now = Date.now();
        const updated = [...prev, { t: now, up: p.up, down: p.down }];
        return updated.slice(-80);
      });
    } catch {
      setRoundDetail(null);
    }
  }, [api, account, market.assetKey]);

  useEffect(() => {
    if (!fixtureId) {
      setFixture(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/fixtures?ids=${fixtureId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { fixtures?: ApiFixture[] };
        const rows = Array.isArray(data.fixtures) ? data.fixtures : [];
        if (!cancelled) setFixture(rows[0] ?? null);
      } catch {
        if (!cancelled) setFixture(null);
      }
    };

    void run();
    const id = window.setInterval(() => void run(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fixtureId]);

  useEffect(() => {
    if (!api || !MARKET_PROGRAM_ID) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await fetchRoundNow();
    };

    void run();
    const id = window.setInterval(() => void run(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [api, fetchRoundNow]);

  useEffect(() => {
    if (!api || !MARKET_PROGRAM_ID || !account || roundDetail?.kind !== "round") {
      setUserPosition(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const next = await fetchUserPosition(
          api,
          MARKET_PROGRAM_ID,
          market.assetKey,
          roundDetail.id,
          account,
          account
        );
        if (!cancelled) setUserPosition(next);
      } catch {
        if (!cancelled) setUserPosition(null);
      }
    };

    void run();
    const id = window.setInterval(() => void run(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [api, account, market.assetKey, roundDetail]);

  const home = fixture?.participants?.find((p) => p.meta?.location === "home");
  const away = fixture?.participants?.find((p) => p.meta?.location === "away");
  const homeName = home?.name ?? "HOME";
  const awayName = away?.name ?? "AWAY";

  const pct = toPct(roundDetail);
  const matchEndTs = useMemo(() => {
    if (!fixture?.ending_at) return null;
    const ts = new Date(fixture.ending_at).getTime();
    return Number.isFinite(ts) ? ts : null;
  }, [fixture?.ending_at]);

  const fixtureFinished = useMemo(() => {
    // SportMonks: 5 = finished/resulted in this codebase.
    if (fixture?.state_id === 5) return true;
    const info = (fixture?.result_info ?? "").toLowerCase();
    if (!info) return false;
    return info.includes("final") || info === "ft";
  }, [fixture?.state_id, fixture?.result_info]);

  const effectiveRoundDetail = useMemo<MarketRoundDetail | null>(() => {
    if (!roundDetail || roundDetail.kind !== "round") return roundDetail;
    let endTs = roundDetail.endTs;

    if (matchEndTs) {
      endTs = matchEndTs;
    }

    // If fixture is still live/not finished, never show ended due to stale/incorrect timestamps.
    if (!fixtureFinished && endTs <= Date.now()) {
      endTs = Date.now() + 5 * 60 * 1000;
    }

    return { ...roundDetail, endTs };
  }, [roundDetail, matchEndTs, fixtureFinished]);

  const totalLiquidityFin = useMemo(() => {
    if (!roundDetail || roundDetail.kind !== "round") return "--";
    const total = roundDetail.reserveUp + roundDetail.reserveDown;
    const asNum = Number(total) / 1e12;
    if (!Number.isFinite(asNum)) return "--";
    return `$${asNum.toFixed(2)} Vol.`;
  }, [roundDetail]);

  const homeWins = pct.up >= pct.down;
  const score = homeWins ? "1 - 0" : "0 - 1";

  const chartUp = history.map((h) => h.up);
  const chartDown = history.map((h) => h.down);
  const width = 1000;
  const height = 260;
  const kickoff = fixture?.starting_at ? new Date(fixture.starting_at) : null;

  return (
    <section className="mx-auto max-w-[1400px] px-3 sm:px-4 pb-8 pt-2 sm:pt-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_420px] gap-4 lg:gap-6">
        <div className="rounded-2xl lg:rounded-3xl border border-[#1e2f41] bg-[linear-gradient(180deg,#111a24_0%,#0d151f_100%)] p-4 sm:p-5 lg:p-6">
          <div className="text-xs sm:text-sm text-[#7f94aa]">
            Esports · {fixture?.league?.name ?? "League"}
          </div>
          <h1 className="mt-1 sm:mt-2 text-lg xs:text-xl sm:text-2xl lg:text-3xl font-semibold text-white">{homeName} vs {awayName}</h1>

          <div className="mt-4 sm:mt-6 lg:mt-8 grid grid-cols-3 items-center gap-1 sm:gap-2">
            <div className="text-center">
              {home?.image_path ? (
                <img src={home.image_path} alt={homeName} className="mx-auto h-8 w-8 xs:h-10 xs:w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-md object-cover" />
              ) : (
                <div className="mx-auto h-8 w-8 xs:h-10 xs:w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-md bg-[#1a2b3a]" />
              )}
              <div className="mt-1 sm:mt-2 text-xs xs:text-sm sm:text-xl lg:text-3xl font-semibold text-[#8ec7ff] truncate px-0.5 sm:px-1">{teamShort(homeName)}</div>
            </div>
            <div className="text-center">
              <div className="text-xl xs:text-2xl sm:text-4xl lg:text-5xl font-semibold text-white">{score}</div>
              <div className="mt-1 sm:mt-2 text-xs xs:text-sm sm:text-lg lg:text-2xl font-semibold text-[#ff4552]">LIVE · {fixture?.result_info || "Open"}</div>
            </div>
            <div className="text-center">
              {away?.image_path ? (
                <img src={away.image_path} alt={awayName} className="mx-auto h-8 w-8 xs:h-10 xs:w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-md object-cover" />
              ) : (
                <div className="mx-auto h-8 w-8 xs:h-10 xs:w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-md bg-[#1a2b3a]" />
              )}
              <div className="mt-1 sm:mt-2 text-xs xs:text-sm sm:text-xl lg:text-3xl font-semibold text-[#dbe8f5] truncate px-0.5 sm:px-1">{teamShort(awayName)}</div>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 lg:mt-8 text-lg xs:text-xl sm:text-2xl lg:text-3xl font-semibold text-[#80bfff]">{totalLiquidityFin}</div>

          <div className="mt-3 sm:mt-4 rounded-xl border border-[#203446] bg-[#0d151f] p-2 sm:p-3">
            <div className="relative h-[160px] xs:h-[180px] sm:h-[200px] md:h-[240px] lg:h-[280px] w-full">
              <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
                {[0, 25, 50, 75, 100].map((y) => {
                  const py = height - (y / 100) * height;
                  return (
                    <g key={y}>
                      <line x1="0" y1={py} x2={width} y2={py} stroke="#23384d" strokeDasharray="3 6" />
                    </g>
                  );
                })}
                <path d={chartPath(chartUp, width, height)} fill="none" stroke="#79b8ff" strokeWidth="4" />
                <path d={chartPath(chartDown, width, height)} fill="none" stroke="#ff2f53" strokeWidth="4" />
              </svg>
              <div className="absolute right-2 top-2 text-right">
                <div className="text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-[#79b8ff]">{pct.up.toFixed(1)}%</div>
                <div className="text-[10px] xs:text-xs sm:text-sm lg:text-base text-[#9fb2c6]">{teamShort(homeName)}</div>
              </div>
              <div className="absolute right-2 bottom-2 text-right">
                <div className="text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-[#ff2f53]">{pct.down.toFixed(1)}%</div>
                <div className="text-[10px] xs:text-xs sm:text-sm lg:text-base text-[#c2d2e1]">{teamShort(awayName)}</div>
              </div>
            </div>
          </div>

          {kickoff ? (
            <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-[#7f94aa]">
              {kickoff.toLocaleDateString()} {kickoff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          ) : null}
        </div>

        <aside className="w-full lg:w-[340px] xl:w-auto">
          <TradePanel
            market={market}
            roundDetail={effectiveRoundDetail}
            userPosition={userPosition}
            viewMode="live"
            refreshFinBalance={refreshFinBalance}
            teamNames={{ home: homeName, away: awayName }}
            onBuySuccess={async () => {
              // Force immediate refreshes so odds/liquidity update right after successful buy.
              void fetchRoundNow();
              setTimeout(() => void fetchRoundNow(), 500);
              setTimeout(() => void fetchRoundNow(), 1200);
              setTimeout(() => void fetchRoundNow(), 2500);
              return Promise.resolve();
            }}
          />
        </aside>
      </div>
    </section>
  );
}
