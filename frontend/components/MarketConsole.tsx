"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { binanceSymbolForMarket, fetchBinanceSpotPrice } from "@/lib/binance";
import type { MarketMeta } from "@/lib/markets";
import { MARKET_PROGRAM_ID } from "@/lib/config";
import { useWallet } from "@/lib/wallet";
import { PriceChart } from "@/components/PriceChart";
import { TradePanel } from "@/components/TradePanel";
import { fetchUserPosition, type UserPositionSnap } from "@/lib/fin-position";
import {
  finHumanToBaseUnits,
  submitClaim,
  submitSettleRound
} from "@/lib/trade-submit";
import {
  fetchMarketRoundDetail,
  type MarketRoundDetail
} from "@/lib/fin-get-round";
import {
  loadRoundHistory,
  upsertRoundRecord,
  type CachedRoundRecord,
  type HistoryPoint
} from "@/lib/round-history";
import {
  fetchRecentMarketTrades,
  polkadotAppsBlockUrl,
  type MarketTrade,
} from "@/lib/market-trades";
import { finBaseToShortHuman, previewBuySide } from "@/lib/amm-trade-preview";
import { submitBuySide } from "@/lib/trade-submit";

function LiveAge({ sinceRef }: { sinceRef: React.RefObject<number | null> }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      if (spanRef.current && sinceRef.current != null) {
        const ms = Date.now() - sinceRef.current;
        spanRef.current.textContent =
          ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sinceRef]);
  return <span ref={spanRef} className="tabular-nums" />;
}

type Props = { market: MarketMeta };

type Tick = { human: number; publishTime: number };

const ROUND_MS = 5 * 60 * 1000;
// Must match `services/dia-relayer` SETTLE_TO_START_DELAY_MS (default 60000 on testnet).
// Used only for UI countdown to the relayer's next `start_round`.
const SETTLE_TO_START_DELAY_MS = Number(
  process.env.NEXT_PUBLIC_SETTLE_TO_START_DELAY_MS ?? "60000"
);

function fmtUsd(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatCountdown(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m} MIN ${s} SECS`;
}

function fmtRange(startMs: number, endMs: number) {
  const now = Date.now();
  const isStale = now - endMs > 300000;
  
  if (isStale) {
    return "New round starting soon...";
  }
  
  const o: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  };
  return `${new Date(startMs).toLocaleString(undefined, o)} – ${new Date(endMs).toLocaleString(undefined, o)}`;
}

function tryFinHumanToBase(s: string): bigint | null {
  try {
    return finHumanToBaseUnits(s.trim() || "0");
  } catch {
    return null;
  }
}

export function MarketConsole({ market }: Props) {
  const { account, api, refreshFinBalance } = useWallet();
  const [tick, setTick] = useState<Tick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priceToBeat, setPriceToBeat] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [wallTimeLeftSec, setWallTimeLeftSec] = useState(0);
  const windowStartMsRef = useRef<number | null>(null);

  const [roundDetail, setRoundDetail] = useState<MarketRoundDetail | null>(null);
  const roundDetailRef = useRef<MarketRoundDetail | null>(null);
  const pointsForRoundRef = useRef<HistoryPoint[]>([]);
  const roundIdRef = useRef<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<CachedRoundRecord[]>([]);

  const [viewMode, setViewMode] = useState<"live" | "history">("live");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const [side, setSide] = useState<"up" | "down">("up");
  const [finAmount, setFinAmount] = useState("1");
  const [minShares, setMinShares] = useState("0");
  const [txPending, setTxPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txOk, setTxOk] = useState<string | null>(null);
  const [recentTrades, setRecentTrades] = useState<MarketTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesError, setTradesError] = useState<string | null>(null);

  const [userPosition, setUserPosition] = useState<UserPositionSnap | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [settlePending, setSettlePending] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleOk, setSettleOk] = useState<string | null>(null);
  const [claimPending, setClaimPending] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimOk, setClaimOk] = useState<string | null>(null);

  const lastFetchAtRef = useRef<number | null>(null);

  const binancePair = useMemo(() => binanceSymbolForMarket(market), [market]);

  roundDetailRef.current = roundDetail;

  useEffect(() => {
    if (!MARKET_PROGRAM_ID) return;
    setHistoryRecords(loadRoundHistory(MARKET_PROGRAM_ID, market.assetKey));
  }, [market.assetKey]);

  useEffect(() => {
    const rd = roundDetail;
    if (rd?.kind !== "round") return;
    if (roundIdRef.current !== rd.id) {
      roundIdRef.current = rd.id;
      pointsForRoundRef.current = [];
    }
  }, [roundDetail]);

  useEffect(() => {
    if (!api || !MARKET_PROGRAM_ID) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const d = await fetchMarketRoundDetail(
          api,
          MARKET_PROGRAM_ID,
          market.assetKey,
          account
        );
        if (cancelled) return;
        setRoundDetail(d);

        if (
          d.kind === "round" &&
          d.phase === "Resolved" &&
          d.outcomeUp !== null &&
          d.endPriceHuman != null
        ) {
          const next = upsertRoundRecord(
            MARKET_PROGRAM_ID,
            market,
            {
              roundId: d.id,
              assetKey: market.assetKey,
              startTs: d.startTs,
              endTs: d.endTs,
              startPriceHuman: d.startPriceHuman,
              endPriceHuman: d.endPriceHuman,
              outcomeUp: d.outcomeUp,
              chartPoints: pointsForRoundRef.current.length
                ? [...pointsForRoundRef.current]
                : []
            }
          );
          setHistoryRecords(next);
        }
      } catch {
        if (!cancelled) setRoundDetail(null);
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [api, account, market.assetKey, market]);

  useEffect(() => {
    let on = true;
    const poll = async () => {
      try {
        const human = await fetchBinanceSpotPrice(binancePair);
        if (!on) return;
        const now = Date.now();
        lastFetchAtRef.current = now;
        setTick({ human, publishTime: Math.floor(now / 1000) });
        setHistory((prev) => {
          const next = [...prev, { t: now, price: human }];
          return next.slice(-300);
        });
        setError(null);

        const rd = roundDetailRef.current;
        if (
          rd?.kind === "round" &&
          rd.phase === "Open" &&
          now >= rd.startTs &&
          now <= rd.endTs
        ) {
          pointsForRoundRef.current = [...pointsForRoundRef.current, { t: now, price: human }].slice(
            -500
          );
        }

        const windowStart = Math.floor(now / ROUND_MS) * ROUND_MS;
        if (windowStartMsRef.current === null) {
          windowStartMsRef.current = windowStart;
          setPriceToBeat(human);
        } else if (windowStartMsRef.current !== windowStart) {
          windowStartMsRef.current = windowStart;
          setPriceToBeat(human);
        }
      } catch (e: unknown) {
        if (!on) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    poll();
    const id = window.setInterval(poll, 1000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, [binancePair]);

  const loadTrades = useCallback(async () => {
    if (!api || !MARKET_PROGRAM_ID) {
      setRecentTrades([]);
      setTradesLoading(false);
      setTradesError(null);
      return;
    }
    setTradesLoading(true);
    setTradesError(null);
    try {
      const rows = await fetchRecentMarketTrades(api, MARKET_PROGRAM_ID, market.assetKey, {
        maxTrades: 15,
      });
      setRecentTrades(rows);
    } catch (e: unknown) {
      setTradesError(e instanceof Error ? e.message : String(e));
      setRecentTrades([]);
    } finally {
      setTradesLoading(false);
    }
  }, [api, market.assetKey]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadTrades(), 250);
    const id = window.setInterval(() => void loadTrades(), 60_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, [loadTrades]);

  useEffect(() => {
    const update = () => {
      const end = Math.ceil(Date.now() / ROUND_MS) * ROUND_MS;
      setWallTimeLeftSec(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  const hasHistory = historyRecords.length > 0;

  /** Seconds until this **on-chain** round ends (Open only). */
  const timeLeftSec = useMemo((): number | null => {
    // If no round data, use wall clock
    if (!roundDetail || roundDetail.kind !== "round") {
      return wallTimeLeftSec;
    }
    
    // If round is Resolved or Locked, return null
    if (roundDetail.phase === "Resolved" || roundDetail.phase === "Locked") {
      return null;
    }
    
    // If round is Open but ended more than 5 minutes ago, use wall clock
    const roundEndedAgo = Date.now() - roundDetail.endTs;
    if (roundEndedAgo > 300000) {
      return wallTimeLeftSec;
    }
    
    // Active round - show actual countdown
    return Math.max(0, Math.floor((roundDetail.endTs - Date.now()) / 1000));
  }, [roundDetail, wallTimeLeftSec]);

  const resolvedNextOpenInSec = useMemo((): number | null => {
    if (roundDetail?.kind !== "round" || roundDetail.phase !== "Resolved") return null;
    if (!Number.isFinite(roundDetail.endTs) || roundDetail.endTs <= 0) return null;
    const remainingMs = roundDetail.endTs + SETTLE_TO_START_DELAY_MS - Date.now();
    return Math.max(0, Math.floor(remainingMs / 1000));
  // `wallTimeLeftSec` ticks every 1s; reuse it so the countdown updates while the round stays `Resolved`.
  }, [roundDetail, wallTimeLeftSec]);

  const effectivePriceToBeat = useMemo(() => {
    if (roundDetail?.kind === "round" && roundDetail.startPriceHuman > 0) {
      return roundDetail.startPriceHuman;
    }
    return priceToBeat;
  }, [roundDetail, priceToBeat]);

  const selectedPast = useMemo(() => {
    if (!historyRecords.length) return null;
    if (selectedHistoryId) {
      return historyRecords.find((r) => r.roundId === selectedHistoryId) ?? historyRecords[0];
    }
    return historyRecords[0];
  }, [historyRecords, selectedHistoryId]);

  useEffect(() => {
    if (viewMode === "history" && historyRecords.length && !selectedHistoryId) {
      setSelectedHistoryId(historyRecords[0].roundId);
    }
  }, [viewMode, historyRecords, selectedHistoryId]);

  const skew = useMemo(() => {
    if (!tick || effectivePriceToBeat == null) return null;
    const delta = tick.human - effectivePriceToBeat;
    return { delta };
  }, [tick, effectivePriceToBeat]);

  const FIN_DEC = 1_000_000_000_000; // 12 decimals
  const poolOdds = useMemo(() => {
    if (roundDetail?.kind !== "round") return null;
    const { reserveUp, reserveDown, seedPerSide } = roundDetail;
    const total = reserveUp + reserveDown;
    if (total === 0n) return null;
    const upPct = Math.round(Number(reserveUp * 10000n / total) / 100);
    const downPct = 100 - upPct;
    const upFin = Number(reserveUp) / FIN_DEC;
    const downFin = Number(reserveDown) / FIN_DEC;
    const totalFin = Number(total) / FIN_DEC;
    // Payout multiplier uses the full pool — winners split everything (seed + user trades).
    const multUp = upFin > 0 ? (totalFin / upFin) : 0;
    const multDown = downFin > 0 ? (totalFin / downFin) : 0;
    return { upPct, downPct, upFin, downFin, totalFin, multUp, multDown };
  }, [roundDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const rd = roundDetail;
    if (!api || !MARKET_PROGRAM_ID || !account || rd?.kind !== "round") {
      setUserPosition(null);
      setPositionError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchUserPosition(
          api,
          MARKET_PROGRAM_ID,
          market.assetKey,
          rd.id,
          account,
          account
        );
        if (!cancelled) {
          setUserPosition(p);
          setPositionError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setUserPosition(null);
          setPositionError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, account, market.assetKey, roundDetail]);

  const awaitingSettlement = useMemo(() => {
    if (roundDetail?.kind !== "round" || roundDetail.phase !== "Open") return false;
    return Date.now() >= roundDetail.endTs;
  }, [roundDetail]);

  /** Live estimate after this order (matches on-chain CPAMM + settle/claim split). */
  const tradePreview = useMemo(() => {
    if (roundDetail?.kind !== "round" || roundDetail.phase !== "Open") return null;
    if (awaitingSettlement) return null;
    const base = tryFinHumanToBase(finAmount);
    if (base === null || base <= 0n) return null;
    return previewBuySide({
      side,
      finInBase: base,
      feeBps: roundDetail.feeBps ?? 100,
      reserveUp: roundDetail.reserveUp,
      reserveDown: roundDetail.reserveDown,
      totalSharesUp: roundDetail.totalSharesUp,
      totalSharesDown: roundDetail.totalSharesDown,
      userSharesUp: userPosition?.sharesUp ?? 0n,
      userSharesDown: userPosition?.sharesDown ?? 0n,
      seedPerSide: roundDetail.seedPerSide ?? 0n,
    });
  }, [
    roundDetail,
    side,
    finAmount,
    userPosition,
    awaitingSettlement
  ]);

  const canSettle = useMemo(
    () =>
      viewMode === "live" &&
      awaitingSettlement &&
      Boolean(api && account && MARKET_PROGRAM_ID),
    [viewMode, awaitingSettlement, api, account]
  );

  const hasClaimableWinnings = useMemo(() => {
    if (
      viewMode !== "live" ||
      roundDetail?.kind !== "round" ||
      roundDetail.phase !== "Resolved" ||
      roundDetail.outcomeUp === null ||
      !userPosition
    ) {
      return false;
    }
    if (roundDetail.outcomeUp) return userPosition.sharesUp > 0n;
    return userPosition.sharesDown > 0n;
  }, [viewMode, roundDetail, userPosition]);

  const onChainStatusLabel = useMemo(() => {
    if (roundDetail?.kind !== "round") return "No active round";
    const r = roundDetail;
    if (r.phase === "Resolved" && r.outcomeUp !== null) {
      return r.outcomeUp ? "Resolved · UP won" : "Resolved · DOWN won";
    }
    if (r.phase === "Locked") return "Locked (settlement in progress)";
    if (r.phase === "Open") {
      if (Date.now() >= r.endTs) return "Awaiting settlement";
      return "Trading open";
    }
    return r.phase;
  }, [roundDetail]);

  const onSettle = useCallback(async () => {
    setSettleError(null);
    setSettleOk(null);
    if (!api || !account || !MARKET_PROGRAM_ID) return;
    setSettlePending(true);
    try {
      await submitSettleRound({ api, account, assetKey: market.assetKey });
      setSettleOk("Round settled on-chain. Outcome is fixed.");
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e: unknown) {
      setSettleError(e instanceof Error ? e.message : String(e));
    } finally {
      setSettlePending(false);
    }
  }, [api, account, market.assetKey]);

  const onClaim = useCallback(async () => {
    setClaimError(null);
    setClaimOk(null);
    if (!api || !account || !MARKET_PROGRAM_ID) return;
    setClaimPending(true);
    try {
      await submitClaim({ api, account, assetKey: market.assetKey });
      setClaimOk("FIN sent to your wallet (check balance).");
      await new Promise((r) => setTimeout(r, 2500));
      await refreshFinBalance();
    } catch (e: unknown) {
      setClaimError(e instanceof Error ? e.message : String(e));
    } finally {
      setClaimPending(false);
    }
  }, [api, account, market.assetKey, refreshFinBalance]);

  const onBuy = useCallback(async () => {
    setTxError(null);
    setTxOk(null);
    if (!api || !account) {
      setTxError("Connect your wallet first.");
      return;
    }
    if (!MARKET_PROGRAM_ID) {
      setTxError("Market program id is not configured.");
      return;
    }
    let minSharesBn = 0n;
    try {
      minSharesBn = BigInt(minShares.trim() || "0");
    } catch {
      setTxError("Min. shares must be a whole number (base units).");
      return;
    }
    setTxPending(true);
    try {
      await submitBuySide({
        api,
        account,
        assetKey: market.assetKey,
        side,
        finHuman: finAmount,
        minSharesOut: minSharesBn,
        roundId:
          roundDetail?.kind === "round" ? roundDetail.id : undefined,
      });

      setTxOk(
        `${finAmount} FIN committed ${side.toUpperCase()} on ${market.short}/USD. ` +
          `Claim after the round resolves on-chain.`
      );

      await new Promise((r) => setTimeout(r, 3000));
      await refreshFinBalance();
      void loadTrades();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : String(e));
    } finally {
      setTxPending(false);
    }
  }, [
    api,
    account,
    finAmount,
    minShares,
    market.assetKey,
    market.short,
    refreshFinBalance,
    side,
    loadTrades,
    roundDetail,
  ]);

  const buyDisabled =
    !account ||
    !api ||
    !MARKET_PROGRAM_ID ||
    txPending ||
    !tick ||
    viewMode === "history" ||
    awaitingSettlement;

  const showLiveResolution =
    viewMode === "live" &&
    roundDetail?.kind === "round" &&
    roundDetail.phase === "Resolved" &&
    roundDetail.outcomeUp !== null;

  const chartPointsLive = viewMode === "live" ? history : selectedPast?.chartPoints ?? [];
  const chartBeat =
    viewMode === "history" && selectedPast
      ? selectedPast.startPriceHuman
      : effectivePriceToBeat;
  const chartLive =
    viewMode === "history" && selectedPast
      ? selectedPast.endPriceHuman ?? selectedPast.chartPoints.at(-1)?.price ?? null
      : tick?.human ?? null;

  return (
    <div className="mx-auto grid max-w-[1700px] gap-3 sm:gap-4 md:gap-5 px-2 sm:px-4 pb-8 sm:pb-10 md:pb-12 pt-2 sm:pt-4 lg:grid-cols-[1.45fr_.55fr] lg:px-6">
      <section className="rounded-2xl sm:rounded-3xl border border-[#1e2f41] bg-[linear-gradient(180deg,#0f1822_0%,#0d1721_100%)] p-4 sm:p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start justify-between gap-3 sm:gap-5">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-lg sm:rounded-xl bg-[#f49b22] text-2xl sm:text-3xl font-black text-white">
              {market.short.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold leading-tight tracking-tight text-white md:text-[2.25rem]">{market.label} Up or Down</h1>
              <p className="mt-0.5 sm:mt-1 text-base sm:text-lg text-[#8ea4b8] md:text-xl">
                {roundDetail?.kind === "round"
                  ? fmtRange(roundDetail.startTs, roundDetail.endTs)
                  : "Waiting for active round"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 sm:gap-8 mt-2 sm:mt-0">
            {hasHistory && (
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-[#2a3b4b] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setViewMode("live")}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      viewMode === "live"
                        ? "bg-[#2d475f] text-white"
                        : "bg-[#111b25] text-[#8ea4b8] hover:text-white"
                    }`}
                  >
                    Live
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("history")}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      viewMode === "history"
                        ? "bg-[#2d475f] text-white"
                        : "bg-[#111b25] text-[#8ea4b8] hover:text-white"
                    }`}
                  >
                    History
                  </button>
                </div>
                {viewMode === "history" && historyRecords.length > 1 && (
                  <select
                    value={selectedHistoryId || ""}
                    onChange={(e) => setSelectedHistoryId(e.target.value)}
                    className="bg-[#111b25] text-white text-xs px-2 py-1.5 rounded-lg border border-[#2a3b4b] cursor-pointer"
                  >
                    {historyRecords.map((r) => (
                      <option key={r.roundId} value={r.roundId}>
                        Round #{r.roundId}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div className="text-right">
              <div className="font-mono text-3xl sm:text-4xl font-semibold text-[#ff4c55] md:text-[2.6rem]">
                {timeLeftSec !== null
                  ? `${String(Math.floor(timeLeftSec / 60)).padStart(2, "0")}  ${String(timeLeftSec % 60).padStart(2, "0")}`
                  : "00  00"}
              </div>
              <div className="mt-0.5 sm:mt-1 flex justify-end gap-3 sm:gap-6 text-xs sm:text-sm text-[#7f93a7]">
                <span>MINS</span>
                <span>SECS</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <div>
            <div className="text-base sm:text-lg font-semibold text-[#7f93a7]">Price To Beat</div>
            <div className="mt-1 font-mono text-3xl sm:text-4xl font-semibold text-[#98a8b9] md:text-[2.6rem]">
              {effectivePriceToBeat != null ? `$${fmtUsd(effectivePriceToBeat)}` : "..."}
            </div>
          </div>
          <div className="border-t border-[#203346] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <div className="flex items-center gap-2 text-base sm:text-lg font-semibold text-[#f6a61f]">
              <span>Current Price</span>
              {skew ? (
                <span className={`text-xs sm:text-sm ${skew.delta >= 0 ? "text-[#39d27d]" : "text-[#ff4b52]"}`}>
                  {skew.delta >= 0 ? `▲ $${fmtUsd(Math.abs(skew.delta))}` : `▼ $${fmtUsd(Math.abs(skew.delta))}`}
                </span>
              ) : null}
            </div>
            <div className="mt-1 font-mono text-3xl sm:text-4xl font-semibold text-[#ffb022] md:text-[2.6rem]">
              {tick ? `$${fmtUsd(tick.human)}` : "..."}
            </div>
          </div>
        </div>

        {showLiveResolution && roundDetail?.kind === "round" ? (
          <div className="mt-6 rounded-2xl border border-white/15 bg-gradient-to-br from-panel to-ink/80 p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 ${
                  roundDetail.outcomeUp
                    ? "border-shore bg-shore/20 text-shore"
                    : "border-risk bg-risk/25 text-risk"
                }`}
              >
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-mist/70">Outcome</div>
                <div
                  className={`font-display text-2xl text-white ${
                    roundDetail.outcomeUp ? "text-shore" : "text-risk"
                  }`}
                >
                  {roundDetail.outcomeUp ? "UP" : "DOWN"}
                </div>
                <p className="mt-1 text-sm text-mist/80">
                  {fmtRange(roundDetail.startTs, roundDetail.endTs)} · Winners claim FIN from the
                  pool via <span className="font-mono text-mist">Fin.Claim</span> while this
                  round is still the active one on-chain.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {viewMode === "history" && selectedPast ? (
          <div className="mt-6 rounded-2xl border border-white/15 bg-gradient-to-br from-panel to-ink/80 p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 ${
                  selectedPast.outcomeUp
                    ? "border-shore bg-shore/20 text-shore"
                    : "border-risk bg-risk/25 text-risk"
                }`}
              >
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-mist/70">Outcome</div>
                <div
                  className={`font-display text-2xl ${
                    selectedPast.outcomeUp ? "text-shore" : "text-risk"
                  }`}
                >
                  {selectedPast.outcomeUp ? "UP" : "DOWN"}
                </div>
                <p className="mt-1 text-sm text-mist/80">
                  {fmtRange(selectedPast.startTs, selectedPast.endTs)} · Saved in this browser
                  only.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 hidden gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-ink/35 p-4">
            <div className="text-xs font-medium text-mist/80">
              {viewMode === "history" ? "Start price (oracle)" : "Price to beat"}
            </div>
            <div className="mt-2 font-mono text-3xl text-white md:text-4xl">
              {viewMode === "history" && selectedPast ? (
                <>
                  <span className="text-lg text-mist/60">$</span>
                  {fmtUsd(selectedPast.startPriceHuman)}
                </>
              ) : effectivePriceToBeat != null ? (
                <>
                  <span className="text-lg text-mist/60">$</span>
                  {fmtUsd(effectivePriceToBeat)}
                </>
              ) : (
                "…"
              )}
            </div>
            <p className="mt-2 text-xs text-mist/60">
              {viewMode === "history"
                ? "Snapshot at round start."
                : roundDetail?.kind === "round"
                  ? "From on-chain oracle for this round."
                  : "First Binance sample in this wall-clock window (fallback)."}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-ink/35 p-4">
            <div className="text-xs font-medium text-mist/80">
              {viewMode === "history" ? "Settlement price (oracle)" : "Live price (Binance)"}
            </div>
            <div className="mt-2 font-mono text-3xl text-white md:text-4xl">
              {viewMode === "history" && selectedPast?.endPriceHuman != null ? (
                <>
                  <span className="text-lg text-mist/60">$</span>
                  {fmtUsd(selectedPast.endPriceHuman)}
                </>
              ) : tick ? (
                <>
                  <span className="text-lg text-mist/60">$</span>
                  {fmtUsd(tick.human)}
                </>
              ) : error ? (
                "—"
              ) : (
                "…"
              )}
            </div>
            <div className="mt-2 text-xs text-mist/70">
              {viewMode === "history" ? (
                <>
                  {selectedPast && selectedPast.endPriceHuman != null ? (
                    <span
                      className={
                        selectedPast.endPriceHuman >= selectedPast.startPriceHuman
                          ? "text-shore"
                          : "text-risk"
                      }
                    >
                      Δ{" "}
                      {fmtUsd(selectedPast.endPriceHuman - selectedPast.startPriceHuman)} vs start
                    </span>
                  ) : (
                    "—"
                  )}
                </>
              ) : (
                <>
                  {binancePair}
                  {lastFetchAtRef.current != null ? (
                    <>
                      {" · updated "}
                      <LiveAge sinceRef={lastFetchAtRef} />
                      {" ago"}
                    </>
                  ) : null}
                </>
              )}
            </div>
            {viewMode === "live" && skew ? (
              <div className="mt-2 text-xs text-ember">
                {skew.delta >= 0 ? "Above" : "Below"} price to beat · Δ {fmtUsd(skew.delta)}
              </div>
            ) : null}
            {viewMode === "live" && error ? (
              <div className="mt-2 text-xs text-risk">Binance: {error}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-[#223447] bg-[#0f1822] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs text-mist/70">
            <span className="font-medium text-mist">
              {viewMode === "history" ? "Price path (saved session)" : "Live price chart"}
            </span>
            <span>{viewMode === "history" ? "Reference only" : `Binance spot · ${binancePair}`}</span>
          </div>
          <div className="relative mt-3 h-[260px] overflow-hidden rounded-2xl border border-[#223447] bg-[#0b141d] p-1.5 sm:h-72 sm:p-2 md:h-80">
            <PriceChart
              points={chartPointsLive}
              priceToBeat={chartBeat}
              livePrice={chartLive}
              beatLineLabel={
                viewMode === "history"
                  ? `Start ${chartBeat != null ? fmtUsd(chartBeat) : ""}`
                  : undefined
              }
              caption={
                viewMode === "history"
                  ? "Saved samples from this browser during that round."
                  : undefined
              }
              symbol={binancePair}
            />
          </div>
        </div>

        <div className="mt-6 hidden rounded-2xl border border-line bg-ink/30 p-4 text-xs text-mist/80 space-y-3">
          <div className="font-semibold text-white text-sm">Rules</div>
          <div>
            <div className="font-semibold text-mist mb-1">Resolution</div>
            <p className="leading-relaxed">
              This market resolves <span className="font-semibold text-shore">UP</span> if the
              oracle price at settlement is <span className="text-mist">≥</span> the start price
              for that round, otherwise <span className="font-semibold text-risk">DOWN</span>.
              Payouts use the parimutuel pool; claim your share after resolution.
            </p>
          </div>
        </div>
      </section>

      <aside className="relative z-10 min-w-0">
        <TradePanel
          market={market}
          roundDetail={roundDetail}
          userPosition={userPosition}
          viewMode={viewMode}
          refreshFinBalance={refreshFinBalance}
          onBuySuccess={() => {
            loadTrades();
            return Promise.resolve();
          }}
        />

        {viewMode === "live" && roundDetail?.kind === "round" ? (
          <div className="mt-4 bg-[#111b27] rounded-2xl border border-[#1e2a36] p-4">
            <div className="text-sm font-semibold text-white mb-3">Settlement</div>
            <p className="text-[11px] text-[#6f8296] leading-relaxed">
              Use <span className="font-mono text-[#8fa4b7]">Settle round</span> to lock the outcome
              after the timer ends, or let the relayer settle automatically.
            </p>

            {roundDetail.phase === "Open" && !awaitingSettlement ? (
              <p className="mt-2 text-xs text-[#6f8296]">
                Current round is open. Timer will show when settlement is available.
              </p>
            ) : null}

            {awaitingSettlement ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[#8fa4b7]">
                  Trading ended. Submit settlement to lock the outcome.
                </p>
                <button
                  type="button"
                  disabled={!canSettle || !account || settlePending || roundDetail.phase !== "Open"}
                  onClick={() => void onSettle()}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-[#2d1a15] border border-[#e1775e]/40 rounded-xl transition hover:bg-[#3a251d] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {settlePending
                    ? "Signing..."
                    : !account
                      ? "Connect wallet"
                      : "Settle round"}
                </button>
                {settleError ? <p className="text-xs text-[#f87171]">{settleError}</p> : null}
                {settleOk ? <p className="text-xs text-[#39d27d]">{settleOk}</p> : null}
              </div>
            ) : null}

            {roundDetail.phase === "Resolved" && roundDetail.outcomeUp !== null ? (
              <div className="mt-3 space-y-2 border-t border-[#1e2a36] pt-3">
                <p className="text-xs text-[#8fa4b7]">
                  Outcome:{" "}
                  <span className={roundDetail.outcomeUp ? "font-semibold text-[#39d27d]" : "font-semibold text-[#f87171]"}>
                    {roundDetail.outcomeUp ? "UP" : "DOWN"}
                  </span>
                  . Claim your winnings if you held winning shares.
                </p>
                {hasClaimableWinnings ? (
                  <button
                    type="button"
                    disabled={!account || claimPending}
                    onClick={() => void onClaim()}
                    className="w-full py-2.5 text-sm font-semibold text-white bg-[#1a2a1e] border border-[#39d27d]/45 rounded-xl transition hover:bg-[#253528] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {claimPending ? "Signing..." : "Claim FIN"}
                  </button>
                ) : (
                  <p className="text-xs text-[#6f8296]">
                    {userPosition && (userPosition.sharesUp > 0n || userPosition.sharesDown > 0n)
                      ? "No claimable winnings for this outcome."
                      : "No position in this round."}
                  </p>
                )}
                {claimError ? <p className="text-xs text-[#f87171]">{claimError}</p> : null}
                {claimOk ? <p className="text-xs text-[#39d27d]">{claimOk}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 bg-[#111b27] rounded-2xl border border-[#1e2a36] p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-sm font-semibold text-white">Recent Trades</div>
            <button
              type="button"
              onClick={() => void loadTrades()}
              disabled={tradesLoading || !api || !MARKET_PROGRAM_ID}
              className="text-[11px] text-[#6f8296] bg-[#0d1219] px-2 py-1 rounded-lg border border-[#1e2a36] transition hover:border-[#8fa4b7] hover:text-white disabled:opacity-40"
            >
              {tradesLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {tradesLoading ? (
            <p className="text-xs text-[#6f8296] animate-pulse">Loading trades...</p>
          ) : tradesError ? (
            <p className="text-xs text-[#f87171]">{tradesError}</p>
          ) : recentTrades.length === 0 && api && MARKET_PROGRAM_ID ? (
            <p className="text-xs text-[#6f8296]">
              No recent trades found.
            </p>
          ) : recentTrades.length > 0 ? (
            <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {recentTrades.map((t) => (
                <li
                  key={`${t.blockHash}-${t.extrinsicIndex}-${t.extrinsicHash}`}
                  className="bg-[#0d1219] rounded-xl px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={t.side === "up" ? "font-semibold text-[#39d27d]" : "font-semibold text-[#f87171]"}
                    >
                      {t.side === "up" ? "UP" : "DOWN"}
                    </span>
                    <span className="font-mono text-[#8fa4b7]">{t.finHuman} FIN</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-[#6f8296]">
                    <span className="font-mono">{t.accountShort}</span>
                    <a
                      href={polkadotAppsBlockUrl(t.blockHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2d84ff] hover:underline"
                    >
                      Block {t.blockNumber}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
