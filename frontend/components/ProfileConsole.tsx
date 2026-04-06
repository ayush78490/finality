"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MARKET_PROGRAM_ID } from "@/lib/config";
import { fetchProfileMarketSummaries, fetchCreatedMarkets, type ProfileMarketSummary, type CreatedMarketInfo } from "@/lib/profile-data";
import { useWallet } from "@/lib/wallet";
import { submitClaim } from "@/lib/trade-submit";
import { getTradedAssetKeys } from "@/lib/traded-markets";

const FIN_DEC = 1_000_000_000_000n;

function finHuman(base: bigint): string {
  const w = base / FIN_DEC;
  const f = base % FIN_DEC;
  if (f === 0n) return w.toString();
  return `${w}.${f.toString().padStart(12, "0").replace(/0+$/, "")}`;
}

function phaseLabel(row: ProfileMarketSummary): string {
  const d = row.detail;
  if (d.kind === "none") return "No round";
  if (d.phase === "Resolved") {
    return d.outcomeUp === true ? "Resolved · UP won"
      : d.outcomeUp === false ? "Resolved · DOWN won"
      : "Resolved";
  }
  if (d.phase === "Open" && Date.now() >= d.endTs) return "Awaiting settlement";
  return d.phase;
}

export function ProfileConsole() {
  const { account, api, refreshFinBalance, isAdmin } = useWallet();
  const [rows, setRows] = useState<ProfileMarketSummary[] | null>(null);
  const [createdMarkets, setCreatedMarkets] = useState<CreatedMarketInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState<Record<string, string>>({});
  const [hasTradedKeys, setHasTradedKeys] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"trades" | "created">("trades");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!api || !account || !MARKET_PROGRAM_ID) { setRows(null); return; }
    if (!silent) setLoading(true);
    setErr(null);
    try {
      const data = await fetchProfileMarketSummaries(api, account);
      setRows(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, account]);

  const loadCreatedMarkets = useCallback(async (silent = false) => {
    if (!api || !isAdmin) { setCreatedMarkets(null); return; }
    if (!silent) setLoading(true);
    try {
      const data = await fetchCreatedMarkets(api);
      setCreatedMarkets(data);
    } catch (e: unknown) {
      // Silent fail for created markets
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, isAdmin]);

  // Check localStorage immediately (synchronous) so we know if user has traded.
  useEffect(() => {
    if (!account || !MARKET_PROGRAM_ID) return;
    const keys = getTradedAssetKeys(MARKET_PROGRAM_ID, account);
    setHasTradedKeys(keys.length > 0);
  }, [account]);

  // Initial load + auto-refresh every 8s to catch claim windows.
  useEffect(() => {
    void load();
    pollRef.current = setInterval(() => void load(true), 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  // Load created markets for admin
  useEffect(() => {
    if (isAdmin) {
      void loadCreatedMarkets();
    }
  }, [isAdmin, loadCreatedMarkets]);

  const onClaim = async (row: ProfileMarketSummary) => {
    if (!api || !account) return;
    const key = row.market.slug;
    setClaimMsg((m) => ({ ...m, [key]: "" }));
    setClaimingKey(key);
    try {
      await submitClaim({ api, account, assetKey: row.market.assetKey });
      setClaimMsg((m) => ({ ...m, [key]: "✓ Claimed! Check your FIN balance." }));
      await refreshFinBalance();
      await load();
    } catch (e: unknown) {
      setClaimMsg((m) => ({ ...m, [key]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setClaimingKey(null);
    }
  };

  if (!account) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-white">Profile</h1>
        <p className="mt-4 text-mist">Connect your wallet to see your positions and claims.</p>
      </div>
    );
  }

  const shortAddr = `${account.slice(0, 10)}…${account.slice(-8)}`;

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 pb-14 sm:pb-20 pt-5 sm:pt-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-white md:text-4xl">Your profile</h1>
          <p className="mt-2 text-xs sm:text-sm text-mist">
            {isAdmin
              ? "View your trades and markets you've created. Round updates every 8 seconds."
              : "All markets you've traded. Round updates every 8 seconds — claim winnings while the resolved round is still active on-chain."}
          </p>
          <p className="mt-1 font-mono text-xs text-mist/50">{shortAddr}</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => { void load(); if (isAdmin) void loadCreatedMarkets(); }}
          className="w-full sm:w-auto rounded-full border border-line bg-panel px-4 py-2 text-sm text-white hover:border-ember/40 disabled:opacity-40"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Admin Tabs */}
      {isAdmin && (
        <div className="mt-6 flex gap-2 border-b border-line">
          <button
            type="button"
            onClick={() => setActiveTab("trades")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "trades"
                ? "border-b-2 border-ember text-ember"
                : "text-mist hover:text-white"
            }`}
          >
            My Trades
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("created")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "created"
                ? "border-b-2 border-ember text-ember"
                : "text-mist hover:text-white"
            }`}
          >
            Created Markets
          </button>
        </div>
      )}

      {err ? <p className="mt-6 text-sm text-risk">{err}</p> : null}

      {/* Loading state */}
      {loading && !rows ? (
        <div className="mt-10 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-line bg-panel/50" />
          ))}
        </div>
      ) : null}

      {/* No traded markets */}
      {!loading && hasTradedKeys === false ? (
        <div className="mt-10 rounded-2xl border border-line bg-panel/40 p-6 sm:p-10 text-center">
          <p className="text-lg text-white">No trades yet</p>
          <p className="mt-2 text-sm text-mist">
            Open a market below, pick UP or DOWN, and your position will appear here instantly.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full border border-ember/40 bg-ember/10 px-4 py-2 text-sm text-ember hover:bg-ember/20"
          >
            Browse markets
          </Link>
        </div>
      ) : null}

      {/* Market cards */}
      {rows && rows.length > 0 ? (
        <div className="mt-8 space-y-4">
          {rows.map((row) => {
            const m = row.market;
            const claiming = claimingKey === m.slug;
            const msg = claimMsg[m.slug];
            const hasShares = row.sharesUp > 0n || row.sharesDown > 0n;
            const past = row.pastRoundPosition;
            const hasPastOnly =
              !hasShares &&
              past &&
              (past.sharesUp > 0n || past.sharesDown > 0n);
            const isResolved = row.detail.kind === "round" && row.detail.phase === "Resolved";
            const isOpen = row.detail.kind === "round" && row.detail.phase === "Open";
            const roundId = row.detail.kind === "round" ? row.detail.id : null;
            const endTs = row.detail.kind === "round" ? row.detail.endTs : null;

            return (
              <div
                key={m.slug}
                className={`glass rounded-2xl border p-4 sm:p-5 transition-all ${
                  row.canTryClaim
                    ? "border-shore/60 shadow-[0_0_24px_rgba(0,200,130,0.15)]"
                    : "border-line/70"
                }`}
              >
                {/* Top row: market name + round status */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-mist/50">{m.short}</div>
                    <Link
                      href={`/market/${m.slug}`}
                      className="font-display text-lg sm:text-xl text-white hover:text-ember"
                    >
                      {m.label}
                      <span className="ml-2 text-xs sm:text-sm text-mist/60">{m.assetKey}</span>
                    </Link>
                  </div>

                  <div className="flex w-full sm:w-auto flex-col items-start sm:items-end gap-1 text-xs">
                    {/* Phase badge */}
                    <span
                      className={`rounded-full border px-2.5 py-1 font-medium ${
                        isResolved && row.detail.kind === "round" && row.detail.outcomeUp !== null
                          ? row.outcomeLabel === "UP"
                            ? "border-shore/40 bg-shore/15 text-shore"
                            : "border-risk/40 bg-risk/15 text-risk"
                          : isOpen && endTs && Date.now() >= endTs
                            ? "border-ember/40 bg-ember/10 text-ember"
                            : "border-line bg-ink/40 text-mist"
                      }`}
                    >
                      {phaseLabel(row)}
                    </span>
                    {roundId ? (
                      <span className="text-mist/40">Round #{roundId}</span>
                    ) : null}
                    {isOpen && endTs && Date.now() < endTs ? (
                      <span className="text-mist/40">
                        ends {new Date(endTs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Position row */}
                {hasShares ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {row.sharesUp > 0n ? (
                      <div className="rounded-lg border border-shore/30 bg-shore/10 px-3 py-1.5 text-xs">
                        <span className="text-shore font-semibold">UP</span>
                        <span className="ml-2 font-mono text-mist/80">{finHuman(row.sharesUp)} shares</span>
                      </div>
                    ) : null}
                    {row.sharesDown > 0n ? (
                      <div className="rounded-lg border border-risk/30 bg-risk/10 px-3 py-1.5 text-xs">
                        <span className="text-risk font-semibold">DOWN</span>
                        <span className="ml-2 font-mono text-mist/80">{finHuman(row.sharesDown)} shares</span>
                      </div>
                    ) : null}
                  </div>
                ) : hasPastOnly && past ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-ember/25 bg-ember/5 px-3 py-2.5 text-xs text-mist/85">
                    <div className="font-medium text-ember/90">
                      Position in ended round #{past.roundId} (not the live round #{roundId ?? "—"})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {past.sharesUp > 0n ? (
                        <span className="rounded border border-shore/30 bg-shore/10 px-2 py-0.5 font-mono text-shore">
                          UP {finHuman(past.sharesUp)} sh
                        </span>
                      ) : null}
                      {past.sharesDown > 0n ? (
                        <span className="rounded border border-risk/30 bg-risk/10 px-2 py-0.5 font-mono text-risk">
                          DOWN {finHuman(past.sharesDown)} sh
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] leading-relaxed text-mist/55">
                      <strong className="text-mist/70">Claim timing:</strong> winnings can only be claimed while that
                      round is still <strong>Resolved</strong> on-chain. The relayer then opens a new round — after that,
                      the app points at the new round, so the profile shows 0 in the current round even though your shares
                      were in #{past.roundId}. The relayer now waits several minutes after settle before starting the next
                      round so you have time to claim from the market page.
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-mist/40">
                    {isResolved
                      ? "No shares in this round — you may have traded in a previous round."
                      : "No position in current round — trade below to open one."}
                  </p>
                )}

                {row.error ? (
                  <p className="mt-2 text-xs text-risk/80">{row.error}</p>
                ) : null}

                {/* ── CLAIM BANNER ── appears when round resolved + winning shares */}
                {row.canTryClaim ? (
                  <div className="mt-4 rounded-xl border-2 border-shore/60 bg-gradient-to-r from-shore/15 to-shore/5 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏆</span>
                      <div>
                        <div className="text-sm font-bold text-shore">You won! Claim your FIN now.</div>
                        <div className="text-xs text-mist/70">
                          Round resolved <strong className="text-shore">{row.outcomeLabel}</strong> — you bet on the
                          winning side. Claim before the relayer starts the next round.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={claiming || !api}
                      onClick={() => void onClaim(row)}
                      className="mt-3 w-full cursor-pointer rounded-xl bg-shore px-4 py-3 text-sm font-bold text-ink transition hover:bg-shore/90 disabled:opacity-40"
                    >
                      {claiming ? "Signing… (check wallet)" : "Claim FIN winnings →"}
                    </button>
                    {msg ? (
                      <p className={`mt-2 text-xs ${msg.startsWith("✓") ? "text-shore" : "text-risk"}`}>
                        {msg}
                      </p>
                    ) : null}
                  </div>
                ) : isResolved && hasShares ? (
                  /* Resolved, has shares, but on losing side */
                  <div className="mt-4 rounded-xl border border-line/40 bg-ink/20 px-3 py-2.5 text-xs text-mist/60">
                    Round resolved <strong className="text-white">{row.outcomeLabel}</strong>. Your{" "}
                    {row.sharesUp > 0n ? "UP" : "DOWN"} position was on the losing side.
                    {msg ? <span className="ml-1 text-risk">{msg}</span> : null}
                  </div>
                ) : isResolved && !hasShares ? (
                  <div className="mt-4 rounded-xl border border-line/40 bg-ink/20 px-3 py-2.5 text-xs text-mist/60">
                    No shares in this resolved round. Your trade may have been in a previous round
                    that already completed.
                  </div>
                ) : isOpen && hasShares ? (
                  <div className="mt-3 rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-xs text-ember/70">
                    Round is still open — claim appears automatically here when the round resolves
                    in your favour. This page refreshes every 8 seconds.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : rows && rows.length === 0 && !loading ? (
        <div className="mt-10 rounded-2xl border border-line bg-panel/40 p-10 text-center">
          <p className="text-white">No traded markets found for this wallet.</p>
          <p className="mt-2 text-sm text-mist">
            Your trades are tracked in this browser after a successful buy.
            If you traded from another device, they won&apos;t appear here.
          </p>
        </div>
      ) : null}

      {/* Created Markets (Admin only) */}
      {activeTab === "created" && createdMarkets && createdMarkets.length > 0 ? (
        <div className="mt-8 space-y-4">
          {createdMarkets.map((item) => {
            const m = item.market;
            const detail = item.detail;
            const isActive = item.status === "active";
            const isEnded = item.status === "ended";
            const roundId = detail.kind === "round" ? detail.id : null;

            return (
              <div
                key={m.slug}
                className="glass rounded-2xl border border-line/70 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-mist/50">{m.short}</div>
                    <Link
                      href={`/market/${m.slug}`}
                      className="font-display text-lg sm:text-xl text-white hover:text-ember"
                    >
                      {m.label}
                      <span className="ml-2 text-xs sm:text-sm text-mist/60">{m.assetKey}</span>
                    </Link>
                  </div>

                  <div className="flex w-full sm:w-auto flex-col items-start sm:items-end gap-1 text-xs">
                    <span
                      className={`rounded-full border px-2.5 py-1 font-medium ${
                        isActive
                          ? "border-shore/40 bg-shore/15 text-shore"
                          : isEnded
                            ? "border-risk/40 bg-risk/15 text-risk"
                            : "border-line bg-ink/40 text-mist"
                      }`}
                    >
                      {isActive ? "Active" : isEnded ? "Ended" : "No round"}
                    </span>
                    {roundId && (
                      <span className="text-mist/40">Round #{roundId}</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-mist/70">
                  <span>Total Rounds: {item.roundCount}</span>
                  {detail.kind === "round" && detail.endTs && (
                    <span>
                      {isEnded
                        ? `Ended at ${new Date(detail.endTs).toLocaleTimeString()}`
                        : `Ends ${new Date(detail.endTs).toLocaleTimeString()}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === "created" && isAdmin && !loading ? (
        <div className="mt-10 rounded-2xl border border-line bg-panel/40 p-10 text-center">
          <p className="text-white">No markets data available</p>
          <p className="mt-2 text-sm text-mist">
            Markets will appear here once the relayer starts the first round.
          </p>
        </div>
      ) : null}
    </div>
  );
}
