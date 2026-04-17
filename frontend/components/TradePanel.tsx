"use client";

import { useCallback, useMemo, useState } from "react";
import type { MarketRoundDetail } from "@/lib/fin-get-round";
import { fetchMarketRoundDetail } from "@/lib/fin-get-round";
import type { MarketMeta } from "@/lib/markets";
import { previewBuySide, finBaseToShortHuman } from "@/lib/amm-trade-preview";
import { finHumanToBaseUnits } from "@/lib/trade-submit";
import { submitBuySide } from "@/lib/trade-submit";
import { useWallet } from "@/lib/wallet";
import { MARKET_PROGRAM_ID } from "@/lib/config";

function tryFinHumanToBase(s: string): bigint | null {
  try {
    return finHumanToBaseUnits(s.trim() || "0");
  } catch {
    return null;
  }
}

function formatFinUpTo3(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function roundStateChanged(before: MarketRoundDetail | null, after: MarketRoundDetail): boolean {
  if (!before) return after.kind === "round";
  if (before.kind !== "round") return after.kind === "round";
  if (after.kind !== "round") return true;
  
  const changed = (
    before.id !== after.id ||
    before.phase !== after.phase ||
    before.reserveUp !== after.reserveUp ||
    before.reserveDown !== after.reserveDown ||
    before.totalSharesUp !== after.totalSharesUp ||
    before.totalSharesDown !== after.totalSharesDown ||
    before.traderFinDeposited !== after.traderFinDeposited
  );
  if (!changed) {
    console.log('[DEBUG] roundStateChanged: no change detected', {
      before: { 
        id: before.id, 
        reserveUp: before.reserveUp?.toString(), 
        reserveDown: before.reserveDown?.toString(),
        totalSharesUp: before.totalSharesUp?.toString(),
        totalSharesDown: before.totalSharesDown?.toString(),
        traderFinDeposited: before.traderFinDeposited?.toString()
      },
      after: { 
        id: after.id, 
        reserveUp: after.reserveUp?.toString(), 
        reserveDown: after.reserveDown?.toString(),
        totalSharesUp: after.totalSharesUp?.toString(),
        totalSharesDown: after.totalSharesDown?.toString(),
        traderFinDeposited: after.traderFinDeposited?.toString()
      }
    });
  }
  return changed;
}

type PoolOdds = {
  upPct: number;
  downPct: number;
  upFin: number;
  downFin: number;
  totalFin: number;
  multUp: number;
  multDown: number;
  netMultUp: number;
  netMultDown: number;
};

type Props = {
  market: MarketMeta;
  roundDetail: MarketRoundDetail | null;
  userPosition: { sharesUp: bigint; sharesDown: bigint } | null;
  viewMode: "live" | "history";
  onBuySuccess?: () => void | Promise<void>;
  refreshFinBalance: () => Promise<string | null>;
  /** Team names for sports markets - displays instead of "Up/Down" */
  teamNames?: { home: string; away: string } | null;
};

const FIN_DEC = 1_000_000_000_000;

export function TradePanel({
  market,
  roundDetail,
  userPosition,
  viewMode,
  onBuySuccess,
  refreshFinBalance,
  teamNames,
}: Props) {
  const { account, api } = useWallet();
  const [side, setSide] = useState<"up" | "down">("up");
  const [finAmount, setFinAmount] = useState("1");
  const [txPending, setTxPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txOk, setTxOk] = useState<string | null>(null);

  const poolOdds = useMemo((): PoolOdds | null => {
    if (roundDetail?.kind !== "round") return null;
    const { reserveUp, reserveDown, seedPerSide, traderFinDeposited } = roundDetail;
    const total = reserveUp + reserveDown;
    if (total === 0n) return null;
    const upPct = Math.round(Number(reserveUp * 10000n / total) / 100);
    const downPct = 100 - upPct;
    const upFin = Number(reserveUp) / FIN_DEC;
    const downFin = Number(reserveDown) / FIN_DEC;
    const totalFin = Number(total) / FIN_DEC;
    const multUp = upFin > 0 ? totalFin / upFin : 0;
    const multDown = downFin > 0 ? totalFin / downFin : 0;
    // Traders can only win from traderFinDeposited (excludes admin seed)
    const tradersPoolFin = Number(traderFinDeposited) / FIN_DEC;
    const netMultUp = upFin > 0 && tradersPoolFin > 0 ? tradersPoolFin / upFin : 0;
    const netMultDown = downFin > 0 && tradersPoolFin > 0 ? tradersPoolFin / downFin : 0;
    return { upPct, downPct, upFin, downFin, totalFin, multUp, multDown, netMultUp, netMultDown };
  }, [roundDetail]);

  const isStaleRound = useMemo(() => {
    if (roundDetail?.kind !== "round" || roundDetail.phase !== "Open") return false;
    const roundEndedAgo = Date.now() - roundDetail.endTs;
    return roundEndedAgo > 300000;
  }, [roundDetail]);

  const awaitingSettlement = useMemo(() => {
    if (roundDetail?.kind !== "round" || roundDetail.phase !== "Open") return false;
    // If round is stale (ended more than 5 min ago), treat as not awaiting
    if (isStaleRound) return false;
    return Date.now() >= roundDetail.endTs;
  }, [roundDetail, isStaleRound]);

  const canTrade = useMemo(() => {
    if (roundDetail?.kind !== "round") return false;
    if (roundDetail.phase !== "Open") return false;
    // Allow trading if round is stale (will use wall clock timer)
    if (isStaleRound) return true;
    // Otherwise only allow if round hasn't ended
    return Date.now() < roundDetail.endTs;
  }, [roundDetail, isStaleRound]);

  const tradePreview = useMemo(() => {
    if (!canTrade) return null;
    if (roundDetail?.kind !== "round") return null;
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
      traderFinDeposited: roundDetail.traderFinDeposited ?? 0n,
    });
  }, [roundDetail, side, finAmount, userPosition, canTrade]);

  const onChainStatusLabel = useMemo(() => {
    if (roundDetail?.kind !== "round") return "No active round";
    const r = roundDetail;
    if (r.phase === "Resolved" && r.outcomeUp !== null) {
      return r.outcomeUp ? (teamNames?.home ? `${teamNames.home} Won` : "UP Won") : (teamNames?.away ? `${teamNames.away} Won` : "DOWN Won");
    }
    if (r.phase === "Locked") return "Settling...";
    if (r.phase === "Open") {
      if (Date.now() >= r.endTs) return "Awaiting settlement";
      return "Open";
    }
    return r.phase;
  }, [roundDetail, teamNames]);

  const onBuy = useCallback(async () => {
    setTxError(null);
    setTxOk(null);
    if (!api || !account) {
      setTxError("Connect wallet first");
      return;
    }
    if (!MARKET_PROGRAM_ID) {
      setTxError("Market program not configured");
      return;
    }
    if (!canTrade) {
      setTxError("Trading not available");
      return;
    }
    const amount = tryFinHumanToBase(finAmount);
    if (!amount || amount <= 0n) {
      setTxError("Enter a valid amount");
      return;
    }
    setTxPending(true);
    try {
      const submitResult = await submitBuySide({
        api,
        account,
        assetKey: market.assetKey,
        side,
        finHuman: finAmount,
        minSharesOut: 1n,
        roundId: roundDetail?.kind === "round" ? roundDetail.id : undefined,
      });

      const txHint = submitResult.buyTxHash
        ? ` Tx ${submitResult.buyTxHash.slice(0, 12)}...`
        : "";
      setTxOk(`${finAmount} FIN committed ${side.toUpperCase()}${txHint}`);
      await refreshFinBalance();
      await onBuySuccess?.();
      setFinAmount(finAmount);
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : String(e));
    } finally {
      setTxPending(false);
    }
  }, [api, account, finAmount, market.assetKey, refreshFinBalance, side, onBuySuccess, roundDetail]);

  const buyDisabled =
    !account ||
    !api ||
    !MARKET_PROGRAM_ID ||
    txPending ||
    viewMode === "history" ||
    !canTrade;

  const toWinByOdds = useMemo(() => {
    if (tradePreview) {
      const claim = Number(finBaseToShortHuman(tradePreview.marginalClaimFromThisBuy));
      if (!Number.isFinite(claim)) return null;
      return formatFinUpTo3(claim);
    }
    const amount = Number.parseFloat(finAmount || "0");
    if (!Number.isFinite(amount) || amount <= 0 || !poolOdds) return null;
    const mult = side === "up" ? poolOdds.netMultUp : poolOdds.netMultDown;
    if (!Number.isFinite(mult) || mult <= 0) return null;
    return formatFinUpTo3(amount * mult);
  }, [tradePreview, finAmount, poolOdds, side]);

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-[#1f3142] bg-[linear-gradient(180deg,#111b26_0%,#0f1822_100%)] p-3 xs:p-4 sm:p-5 md:p-6">
      <div className="mb-3 sm:mb-4 flex items-center justify-between border-b border-[#243547] pb-3">
        <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 text-base xs:text-lg sm:text-xl font-semibold">
          <button className="border-b-2 border-white pb-1 text-white">Buy</button>
          <button className="pb-1 text-[#7f93a7]">Sell</button>
        </div>
        <button className="flex items-center gap-1 text-sm xs:text-base sm:text-lg font-semibold text-[#d7e2ec]">
          Market
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {viewMode === "history" && (
        <div className="text-xs text-[#e1775e] bg-[#2a1a15] px-3 py-2 rounded-lg mb-3">
          Switch to live to trade
        </div>
      )}

      <div className="bg-[#0d1219] rounded-xl px-3 py-2 mb-4">
        <div className="text-[10px] text-[#6f8296]">Status</div>
        <div className="text-sm font-semibold text-white">{onChainStatusLabel}</div>
        {roundDetail?.kind === "round" && userPosition && (
          <div className="text-[10px] text-[#6f8296] mt-1 font-mono">
            {teamNames ? `${teamNames.home}: ${userPosition.sharesUp.toString()} · ${teamNames.away}: ${userPosition.sharesDown.toString()}` : `UP: ${userPosition.sharesUp.toString()} · DOWN: ${userPosition.sharesDown.toString()}`}
          </div>
        )}
      </div>

      <div className="mb-3 sm:mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide("up")}
          className={`rounded-xl py-2 sm:py-3 text-base xs:text-lg sm:text-xl font-semibold transition ${
            side === "up"
              ? "border border-[#3aa062]/50 bg-[#3aa062] text-[#ddf7e8]"
              : "border border-[#1e2a36] bg-[#1b2634] text-[#75879a]"
          }`}
        >
          <div>{teamNames?.home ?? "Up"} {poolOdds ? `${poolOdds.upPct}%` : "--"}</div>
          {poolOdds && (
            <div className="mt-0.5 text-[11px] font-normal opacity-80">{poolOdds.upFin.toFixed(2)} FIN</div>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSide("down")}
          className={`rounded-xl py-2 sm:py-3 text-base xs:text-lg sm:text-xl font-semibold transition ${
            side === "down"
              ? "border border-[#d83a3f]/50 bg-[#d42f34] text-[#ffe1e3]"
              : "border border-[#1e2a36] bg-[#1b2634] text-[#75879a]"
          }`}
        >
          <div>{teamNames?.away ?? "Down"} {poolOdds ? `${poolOdds.downPct}%` : "--"}</div>
          {poolOdds && (
            <div className="mt-0.5 text-[11px] font-normal opacity-80">{poolOdds.downFin.toFixed(2)} FIN</div>
          )}
        </button>
      </div>

      {poolOdds && (
        <div className="bg-[#0d1219] rounded-xl px-3 py-2 mb-4 text-[11px]">
          <div className="flex justify-between text-[#6f8296]">
            <span>Pool</span>
            <span className="font-mono text-[#8fa4b7]">{poolOdds.totalFin.toFixed(2)} FIN</span>
          </div>
          <div className="h-1.5 mt-2 rounded-full bg-[#1a1515] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#39d27d] to-[#39d27d]/70 transition-all"
              style={{ width: `${poolOdds.upPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 font-mono text-[10px]">
            <span className="text-[#39d27d]">UP {poolOdds.upFin.toFixed(2)}</span>
            <span className="text-[#f87171]">DOWN {poolOdds.downFin.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-end justify-between gap-2">
          <div className="text-sm xs:text-base sm:text-lg md:text-xl font-semibold text-[#d8e2ec]">Amount</div>
          <div className="font-mono text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#dce7f2]">
            $<input
              type="number"
              inputMode="decimal"
              placeholder="0"
              className="w-14 xs:w-16 sm:w-20 md:w-24 bg-transparent text-inherit font-inherit font-bold outline-none placeholder:text-[#5a6a7a] placeholder:font-mono placeholder:text-xl xs:placeholder:text-2xl sm:placeholder:text-3xl md:placeholder:text-4xl lg:placeholder:text-5xl"
              value={finAmount}
              onChange={(e) => setFinAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-2 sm:mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 sm:gap-2">
          <button type="button" onClick={() => setFinAmount((Number(finAmount || "0") + 1).toString())} className="rounded-xl bg-[#1c2a39] py-1.5 sm:py-2 text-[11px] xs:text-xs sm:text-sm md:text-base font-semibold text-[#c6d4e2]">+$1</button>
          <button type="button" onClick={() => setFinAmount((Number(finAmount || "0") + 5).toString())} className="rounded-xl bg-[#1c2a39] py-1.5 sm:py-2 text-[11px] xs:text-xs sm:text-sm md:text-base font-semibold text-[#c6d4e2]">+$5</button>
          <button type="button" onClick={() => setFinAmount((Number(finAmount || "0") + 10).toString())} className="rounded-xl bg-[#1c2a39] py-1.5 sm:py-2 text-[11px] xs:text-xs sm:text-sm md:text-base font-semibold text-[#c6d4e2]">+$10</button>
          <button type="button" onClick={() => setFinAmount((Number(finAmount || "0") + 100).toString())} className="hidden sm:block rounded-xl bg-[#1c2a39] py-1.5 sm:py-2 text-xs sm:text-sm md:text-base font-semibold text-[#c6d4e2]">+$100</button>
          <button type="button" onClick={() => setFinAmount("1")} className="hidden md:block rounded-xl bg-[#1c2a39] py-1.5 sm:py-2 text-xs sm:text-sm md:text-base font-semibold text-[#c6d4e2]">$1</button>
          <button type="button" onClick={() => setFinAmount("10")} className="hidden md:block rounded-xl bg-[#2a3948] py-1.5 sm:py-2 text-xs sm:text-sm md:text-base font-semibold text-white">Max</button>
        </div>
      </div>

      {viewMode === "live" && tradePreview && roundDetail?.kind === "round" && (
        <div className="bg-[#1a2636] rounded-xl px-3 py-3 mb-4 text-[11px] xs:text-xs">
          <div className="text-[10px] font-semibold text-[#6f8296] mb-2">Preview</div>
          <div className="space-y-1.5 text-[#8fa4b7]">
            <div className="flex justify-between">
              <span>Odds</span>
              <span className="font-mono text-white">
                {(tradePreview.sidePoolShareAfter * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Win ×</span>
              <span className="font-mono text-white">×{tradePreview.netMult.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shares</span>
              <span className="font-mono text-[#8fa4b7]">
                {finBaseToShortHuman(tradePreview.sharesOut)}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#1e2a36] pt-1.5">
              <span className="text-[#39d27d]">If wins</span>
              <span className="font-mono text-[#39d27d]">
                ~{finBaseToShortHuman(tradePreview.expectedClaimFinIfWin)} FIN
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 border-t border-[#1f2f3f] pt-3 sm:pt-4">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm xs:text-base sm:text-lg md:text-xl font-semibold text-[#d8e2ec]">To win</div>
            <div className="mt-0.5 sm:mt-1 text-[10px] xs:text-[11px] sm:text-xs md:text-sm text-[#93a5b7]">
              Avg. Price {side === "up" ? `${poolOdds?.upPct ?? "--"}%` : `${poolOdds?.downPct ?? "--"}%`}
            </div>
          </div>
          <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-right font-mono text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-[#3bc777]">
            {toWinByOdds ? `${toWinByOdds} FIN` : "--"}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={buyDisabled}
        onClick={onBuy}
        className="w-full rounded-xl bg-[#1a8de2] px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-sm xs:text-base sm:text-lg font-semibold text-white transition hover:bg-[#2a9aea] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {txPending
          ? "Signing..."
          : !account
          ? "Connect Wallet"
          : viewMode === "history"
          ? "Viewing History"
          : awaitingSettlement
          ? "Round Ended"
          : canTrade
          ? `Buy ${side === "up" ? "UP" : "DOWN"}`
          : "Trading Closed"}
      </button>

      {txError && <div className="mt-2 text-xs text-[#f87171]">{txError}</div>}
      {txOk && (
        <div className="mt-2 text-xs text-[#39d27d] bg-[#1a2a1e] px-3 py-2 rounded-lg">
          {txOk}
        </div>
      )}
    </div>
  );
}