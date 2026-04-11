import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi } from "@gear-js/api";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import type { RelayerFileConfig } from "./config.js";
import { loadRelayerConfig } from "./config.js";
import { createVaraKeyring } from "./keyring-vara.js";
import { binanceSymbolForFeed, fetchBinanceSpotTick } from "./binance.js";
import { fetchLatestDia } from "./dia.js";
import {
  encodeFinClaimSeed,
  encodeFinSettleAndRoll,
  encodeFinSettleAndRollWithTick,
  encodeFinSettleRound,
  encodeFinStartRound,
  encodeOracleSubmitRound,
  encodeVftApprove,
} from "./sails-scale.js";
import { sendGearMessage } from "./send-gear-message.js";
import { readRoundState, waitForRoundVisible } from "./round-read.js";
import { SerializedTxDispatcher } from "./tx-dispatcher.js";
import { createIntentActionKey, readIntentForFeed, type RoundIntent } from "./round-reader-worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIN_DECIMALS = 12;

type FeedEntry = RelayerFileConfig["feeds"][number];

const startRetryCooldownMs = (() => {
  const raw = process.env.START_RETRY_COOLDOWN_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 180_000;
})();

const insufficientBalanceCooldownMs = (() => {
  const raw = process.env.START_RETRY_COOLDOWN_INSUFFICIENT_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 900_000;
})();

const tooEarlyCooldownMs = (() => {
  const raw = process.env.START_RETRY_COOLDOWN_TOO_EARLY_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5_000;
})();

const maxActionsPerScan = (() => {
  const raw = process.env.ORCHESTRATOR_ACTIONS_PER_SCAN?.trim();
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 12;
  return Math.floor(n);
})();

const minStartActionsPerScan = (() => {
  const raw = process.env.ORCHESTRATOR_MIN_START_ACTIONS_PER_SCAN?.trim();
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0) return 2;
  return Math.floor(n);
})();

const sharedSignerStartPriorityEveryMs = (() => {
  const raw = process.env.ORCHESTRATOR_SHARED_SIGNER_START_PRIORITY_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 20_000;
  return Math.floor(n);
})();

const nextStartAttemptAtMs = new Map<string, number>();

function markStartCooldown(symbol: string, errMsg: string): void {
  const now = Date.now();
  const cooldown = /InsufficientBalance/i.test(errMsg)
    ? insufficientBalanceCooldownMs
    : /too early|not resolved|claim window|stale oracle|no oracle tick|round_not_visible_after_start/i.test(errMsg)
      ? tooEarlyCooldownMs
      : startRetryCooldownMs;
  nextStartAttemptAtMs.set(symbol, now + cooldown);
  console.log(
    JSON.stringify({
      level: "warn",
      msg: "start_round_cooldown_set",
      symbol,
      retryAfterMs: cooldown,
      retryAtMs: now + cooldown,
      reason: errMsg,
    })
  );
}

function clearStartCooldown(symbol: string): void {
  nextStartAttemptAtMs.delete(symbol);
}

async function pushBinanceOracle(
  api: GearApi,
  marketId: string,
  feed: FeedEntry,
  oracle: any,
  diaBaseUrl: string
): Promise<void> {
  let price: bigint;
  try {
    const sym = binanceSymbolForFeed(feed);
    const tick = await fetchBinanceSpotTick(sym);
    price = tick.price;
  } catch {
    const dia = await fetchLatestDia(diaBaseUrl, feed.diaSymbol);
    price = BigInt(dia.price.price);
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "oracle_fallback_dia",
        symbol: feed.symbol,
        diaSymbol: feed.diaSymbol,
      })
    );
  }
  const payload = encodeOracleSubmitRound(api, feed.assetId, price);
  await sendGearMessage(api, marketId, payload, oracle);
}

function isStartBlocked(symbol: string): { blocked: boolean; waitMs: number } {
  const blockUntil = nextStartAttemptAtMs.get(symbol) ?? 0;
  const now = Date.now();
  if (blockUntil <= now) return { blocked: false, waitMs: 0 };
  return { blocked: true, waitMs: blockUntil - now };
}

function intentPriority(intent: RoundIntent): number {
  if (intent.action === "settle" || intent.action === "settle_roll") return 0;
  if (intent.action === "start") return 1;
  return 2;
}

type RuntimeCtx = {
  api: GearApi;
  marketId: string;
  finId: string;
  diaBaseUrl: string;
  admin: any;
  oracle: any;
  seedFin: bigint;
  feeBps: number;
  oracleQueue: SerializedTxDispatcher;
  adminQueue: SerializedTxDispatcher;
  /** "legacy" = original settle+approve+start cycle. "rolling" = single SettleAndRoll per epoch. */
  roundMode: "legacy" | "rolling";
  /** When true and roundMode is "rolling", use SettleAndRollWithTick (oracle+settle+roll in 1 tx). */
  combinedSettleRoll: boolean;
  /** True when admin and oracle resolve to same signer; requires conservative scheduling. */
  sharedSignerMode: boolean;
};

async function queueStartPlan(
  ctx: RuntimeCtx,
  feed: FeedEntry,
  opts?: { skipStatePrecheck?: boolean }
): Promise<void> {
  const blocked = isStartBlocked(feed.symbol);
  if (blocked.blocked) {
    console.log(
      JSON.stringify({
        level: "info",
        msg: "start_round_skipped_cooldown",
        symbol: feed.symbol,
        waitMs: blocked.waitMs,
      })
    );
    return;
  }

  if (!opts?.skipStatePrecheck) {
    const stateBeforeStart = await readRoundState(
      ctx.api,
      ctx.marketId,
      feed.symbol,
      ctx.admin.address
    );
    if (stateBeforeStart === "Open" || stateBeforeStart === "Locked") {
      console.log(
        JSON.stringify({
          level: "info",
          msg: "start_round_skip_existing_active",
          symbol: feed.symbol,
          state: stateBeforeStart,
        })
      );
      clearStartCooldown(feed.symbol);
      return;
    }
  }

  const approveAmount = ctx.seedFin * 2n;
  await ctx.oracleQueue.enqueue(`submit_round_pre_start:${feed.symbol}`, async () => {
    await pushBinanceOracle(ctx.api, ctx.marketId, feed, ctx.oracle, ctx.diaBaseUrl);
  });

  await ctx.adminQueue.enqueue(`approve_seed:${feed.symbol}`, async () => {
    await sendGearMessage(
      ctx.api,
      ctx.finId,
      encodeVftApprove(ctx.api, ctx.marketId, approveAmount),
      ctx.admin
    );
  });

  const maxStartAttempts = 3;
  for (let attempt = 1; attempt <= maxStartAttempts; attempt++) {
    if (attempt > 1) {
      await ctx.oracleQueue.enqueue(`submit_round_retry_start:${feed.symbol}:${attempt}`, async () => {
        await pushBinanceOracle(ctx.api, ctx.marketId, feed, ctx.oracle, ctx.diaBaseUrl);
      });
    }

    await ctx.adminQueue.enqueue(`start_round:${feed.symbol}:${attempt}`, async () => {
      await sendGearMessage(
        ctx.api,
        ctx.marketId,
        encodeFinStartRound(ctx.api, feed.symbol, ctx.seedFin, ctx.feeBps),
        ctx.admin
      );
    });

    const visible = await waitForRoundVisible(ctx.api, ctx.marketId, feed.symbol, ctx.admin.address, {
      attempts: 12,
      intervalMs: 1500,
    });
    if (visible) {
      clearStartCooldown(feed.symbol);
      console.log(JSON.stringify({ level: "info", msg: "round_started", symbol: feed.symbol }));
      return;
    }

    console.log(
      JSON.stringify({
        level: attempt === maxStartAttempts ? "error" : "warn",
        msg: "round_not_visible_after_start",
        symbol: feed.symbol,
        attempt,
      })
    );
  }

  // Final defensive check: visibility polling can miss a late state update.
  const finalState = await readRoundState(
    ctx.api,
    ctx.marketId,
    feed.symbol,
    ctx.admin.address
  );
  if (finalState === "Open" || finalState === "Locked") {
    clearStartCooldown(feed.symbol);
    console.log(
      JSON.stringify({
        level: "info",
        msg: "round_started_after_visibility_timeout",
        symbol: feed.symbol,
        state: finalState,
      })
    );
    return;
  }

  throw new Error("round_not_visible_after_start");
}

/**
 * Rolling mode dispatch: settle + roll to next epoch in 1–2 extrinsics.
 * - combinedSettleRoll=false: oracle submit → SettleAndRoll  (2 tx, default)
 * - combinedSettleRoll=true:  SettleAndRollWithTick           (1 tx, requires contract support)
 * No VFT Approve, no StartRound, no ClaimSeed needed in rolling mode.
 */
async function queueSettleRollPlan(ctx: RuntimeCtx, feed: FeedEntry): Promise<void> {
  if (ctx.combinedSettleRoll) {
    // Single combined extrinsic: oracle tick + settle + roll.
    // Admin signer submits the price inline — no separate oracle queue step.
    await ctx.adminQueue.enqueue(`settle_and_roll_with_tick:${feed.symbol}`, async () => {
      const sym = binanceSymbolForFeed(feed);
      let price: bigint;
      try {
        const tick = await fetchBinanceSpotTick(sym);
        price = tick.price;
      } catch {
        const dia = await fetchLatestDia(ctx.diaBaseUrl, feed.diaSymbol);
        price = BigInt(dia.price.price);
        console.log(JSON.stringify({ level: "warn", msg: "oracle_fallback_dia", symbol: feed.symbol, diaSymbol: feed.diaSymbol }));
      }
      await sendGearMessage(
        ctx.api,
        ctx.marketId,
        encodeFinSettleAndRollWithTick(ctx.api, feed.symbol, price),
        ctx.admin
      );
      console.log(JSON.stringify({ level: "info", msg: "settle_and_roll_with_tick_ok", symbol: feed.symbol }));
    });
  } else {
    // Two-extrinsic path: fresh oracle price first, then SettleAndRoll.
    await ctx.oracleQueue.enqueue(`submit_round_pre_settle_roll:${feed.symbol}`, async () => {
      await pushBinanceOracle(ctx.api, ctx.marketId, feed, ctx.oracle, ctx.diaBaseUrl);
    });
    await ctx.adminQueue.enqueue(`settle_and_roll:${feed.symbol}`, async () => {
      await sendGearMessage(
        ctx.api,
        ctx.marketId,
        encodeFinSettleAndRoll(ctx.api, feed.symbol),
        ctx.admin
      );
      console.log(JSON.stringify({ level: "info", msg: "settle_and_roll_ok", symbol: feed.symbol }));
    });
  }
}

async function queueSettlePlan(ctx: RuntimeCtx, feed: FeedEntry): Promise<void> {
  await ctx.oracleQueue.enqueue(`submit_round_pre_settle:${feed.symbol}`, async () => {
    await pushBinanceOracle(ctx.api, ctx.marketId, feed, ctx.oracle, ctx.diaBaseUrl);
  });

  const settleState: { outcome: "settled" | "skip" | "proceed_start" } = {
    outcome: "settled",
  };
  await ctx.adminQueue.enqueue(`settle_round:${feed.symbol}`, async () => {
    try {
      await sendGearMessage(ctx.api, ctx.marketId, encodeFinSettleRound(ctx.api, feed.symbol), ctx.admin);
      console.log(JSON.stringify({ level: "info", msg: "settle_ok", symbol: feed.symbol }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("too early")) {
        settleState.outcome = "skip";
      } else if (msg.includes("no round") || msg.includes("not open")) {
        settleState.outcome = "proceed_start";
      } else {
        settleState.outcome = "proceed_start";
      }
      console.log(
        JSON.stringify({
          level: "warn",
          msg: "settle_error",
          symbol: feed.symbol,
          error: msg,
          settleOutcome: settleState.outcome,
        })
      );
    }
  });

  if (settleState.outcome === "skip") return;

  // Skip the immediate pre-check after a fresh settle to avoid stale-state false positives.
  await queueStartPlan(ctx, feed, { skipStatePrecheck: true });

  if (settleState.outcome === "settled") {
    await ctx.adminQueue.enqueue(`claim_seed:${feed.symbol}`, async () => {
      try {
        await sendGearMessage(ctx.api, ctx.marketId, encodeFinClaimSeed(ctx.api, feed.symbol), ctx.admin);
        console.log(JSON.stringify({ level: "info", msg: "admin_seed_claimed", symbol: feed.symbol }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(
          JSON.stringify({
            level: "debug",
            msg: "claim_seed_skipped",
            symbol: feed.symbol,
            reason: msg,
          })
        );
      }
    });
  }
}

async function main() {
  const sendTxsFlag =
    process.env.FINALITY_ORACLE_SEND_TXS?.trim().toLowerCase() ??
    process.env.ROUND_MANAGER_SEND_TXS?.trim().toLowerCase();
  const sendTxs = sendTxsFlag === "true" || sendTxsFlag === "1";
  if (!sendTxs) {
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "round_orchestrator_tx_send_disabled",
        hint: "Set FINALITY_ORACLE_SEND_TXS=true (or ROUND_MANAGER_SEND_TXS=true) when you intentionally want settle/start extrinsics. Exiting with no chain messages.",
      })
    );
    process.exit(0);
  }

  const configPath =
    process.env.ORACLE_CONFIG ??
    path.resolve(__dirname, "../../..", "config", "oracle.config.json");
  const fileCfg = loadRelayerConfig(configPath);

  const marketId = process.env.MARKET_PROGRAM_ID?.trim() || fileCfg.marketProgramId.trim();
  if (!marketId) throw new Error("Set MARKET_PROGRAM_ID");

  const finId =
    process.env.FIN_PROGRAM_ID?.trim() ||
    "0x5e5e6163bc512f3f552fad1382517695e2413c2a9583d85cf719dcd3807c103a";

  const bootstrapMn = process.env.BOOTSTRAP_MNEMONIC?.trim();
  if (!bootstrapMn) throw new Error("BOOTSTRAP_MNEMONIC is required");

  const relMn = process.env.RELAYER_MNEMONIC?.trim();
  if (!relMn) throw new Error("RELAYER_MNEMONIC is required (oracle authority for submit_round)");

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const seedFin = BigInt(process.env.LIQUIDITY_SEED_FIN ?? String(100n * 10n ** BigInt(FIN_DECIMALS)));
  const feeBps = Number(process.env.FEE_BPS ?? "100");
  const checkMs = Number(process.env.ROUND_CHECK_MS ?? "2500");

  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const admin = keyring.addFromMnemonic(bootstrapMn);
  const oracle = keyring.addFromMnemonic(relMn);

  const sharedSignerMode = admin.address === oracle.address;
  const sharedQueue = new SerializedTxDispatcher("shared-signer");
  const oracleQueue = sharedSignerMode ? sharedQueue : new SerializedTxDispatcher("oracle");
  const adminQueue = sharedSignerMode ? sharedQueue : new SerializedTxDispatcher("admin");

  if (sharedSignerMode) {
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "shared_signer_mode_enabled",
        signer: admin.address,
        hint: "BOOTSTRAP_MNEMONIC and RELAYER_MNEMONIC resolve to the same account; using one queue to avoid nonce/priority contention.",
      })
    );
  }

  const ctx: RuntimeCtx = {
    api,
    marketId,
    finId,
    diaBaseUrl: fileCfg.diaBaseUrl,
    admin,
    oracle,
    seedFin,
    feeBps,
    oracleQueue,
    adminQueue,
    roundMode: fileCfg.roundMode,
    combinedSettleRoll: fileCfg.combinedSettleRoll,
    sharedSignerMode,
  };

  if (fileCfg.roundMode === "rolling") {
    console.log(JSON.stringify({
      level: "info",
      msg: "rolling_mode_enabled",
      combinedSettleRoll: fileCfg.combinedSettleRoll,
      roundSeconds: fileCfg.roundSeconds,
      hint: "SettleAndRoll will replace per-epoch Approve+StartRound+ClaimSeed",
    }));
  }

  console.log(
    JSON.stringify({
      level: "info",
      msg: "round_orchestrator_start",
      mode: "hybrid_parallel_detection_signer_serialized_dispatch",
      marketId,
      finId,
      feeds: fileCfg.feeds.length,
      checkMs,
      maxActionsPerScan,
      startRetryCooldownMs,
      tooEarlyCooldownMs,
      insufficientBalanceCooldownMs,
      sharedSignerMode,
    })
  );

  const inflightActionKeys = new Set<string>();
  let lastSharedSignerStartMs = 0;

  for (;;) {
    const nowMs = Date.now();
    const intents = await Promise.all(
      fileCfg.feeds.map((feed) =>
        readIntentForFeed(api, marketId, feed, admin.address, nowMs, fileCfg.roundMode)
      )
    );

    const actionable = intents
      .map((intent, idx) => ({ intent, feed: fileCfg.feeds[idx] }))
      .filter(({ intent }) => intent.action !== "none")
      .sort((a, b) => {
        const p = intentPriority(a.intent) - intentPriority(b.intent);
        if (p !== 0) return p;
        // Oldest expired rounds first to avoid starvation under continuous backlog.
        return a.intent.endTs - b.intent.endTs;
      });

    let scheduled: Array<{ intent: RoundIntent; feed: FeedEntry }>;
    if (ctx.roundMode === "rolling") {
      // Rolling mode has no fixed start reserve; prioritize settle_roll/settle directly.
      scheduled = actionable.slice(0, maxActionsPerScan);

      // Shared-signer fairness: if settle_roll keeps appearing, start intents can starve.
      // Periodically force one start to the front so markets with no active round recover.
      if (ctx.sharedSignerMode) {
        const settleRollActionable = actionable.filter((x) => x.intent.action === "settle_roll");
        const startActionable = actionable.filter((x) => x.intent.action === "start");
        if (startActionable.length > 0) {
          const sinceLastStartMs = nowMs - lastSharedSignerStartMs;
          const shouldForceStart =
            settleRollActionable.length === 0 ||
            sinceLastStartMs >= sharedSignerStartPriorityEveryMs;
          if (shouldForceStart) {
            const forcedStart = startActionable[0];
            scheduled = [
              forcedStart,
              ...scheduled.filter(
                (x) =>
                  !(
                    x.feed.symbol === forcedStart.feed.symbol &&
                    x.intent.action === forcedStart.intent.action &&
                    x.intent.roundId === forcedStart.intent.roundId
                  )
              ),
            ].slice(0, maxActionsPerScan);
          }
        }
      }
    } else {
      const settleActionable = actionable.filter((x) => x.intent.action === "settle");
      const startActionable = actionable.filter((x) => x.intent.action === "start");

      const startReserve = Math.max(0, Math.min(minStartActionsPerScan, maxActionsPerScan));
      const scheduledStarts = startActionable.slice(0, Math.min(startReserve, startActionable.length));
      const settleSlots = Math.max(0, maxActionsPerScan - scheduledStarts.length);
      const scheduledSettles = settleActionable.slice(0, Math.min(settleSlots, settleActionable.length));

      scheduled = [...scheduledSettles, ...scheduledStarts];
      if (scheduled.length < maxActionsPerScan) {
        const used = new Set(scheduled.map((x) => `${x.feed.symbol}:${x.intent.action}:${x.intent.roundId}`));
        for (const item of actionable) {
          const key = `${item.feed.symbol}:${item.intent.action}:${item.intent.roundId}`;
          if (used.has(key)) continue;
          scheduled.push(item);
          used.add(key);
          if (scheduled.length >= maxActionsPerScan) break;
        }
      }
    }

    if (ctx.sharedSignerMode && scheduled.length > 1) {
      // Single signer must preserve strict tx order; keep queue short so a full
      // submit->approve->start chain can complete without long starvation.
      scheduled = scheduled.slice(0, 1);
    }

    console.log(
      JSON.stringify({
        level: "info",
        msg: "round_orchestrator_scan",
        actionable: actionable.length,
        scheduled: scheduled.length,
        settleIntents: actionable.filter((x) => x.intent.action === "settle").length,
        settleRollIntents: actionable.filter((x) => x.intent.action === "settle_roll").length,
        startIntents: actionable.filter((x) => x.intent.action === "start").length,
        scheduledSettles: scheduled.filter((x) => x.intent.action === "settle").length,
        scheduledSettleRolls: scheduled.filter((x) => x.intent.action === "settle_roll").length,
        scheduledStarts: scheduled.filter((x) => x.intent.action === "start").length,
        scheduledSymbols: scheduled.map((x) => x.feed.symbol),
        oracleQueueDepth: oracleQueue.depth(),
        adminQueueDepth: adminQueue.depth(),
      })
    );

    for (const { feed, intent } of scheduled) {
      if (ctx.sharedSignerMode && ctx.roundMode === "rolling" && intent.action === "start") {
        lastSharedSignerStartMs = nowMs;
      }

      const key = createIntentActionKey(marketId, intent);
      if (!key) continue;
      if (inflightActionKeys.has(key)) {
        console.log(
          JSON.stringify({
            level: "debug",
            msg: "intent_deduped",
            symbol: feed.symbol,
            action: intent.action,
            roundId: intent.roundId,
          })
        );
        continue;
      }

      inflightActionKeys.add(key);

      void (async () => {
        try {
          if (intent.action === "settle_roll") {
            await queueSettleRollPlan(ctx, feed);
          } else if (intent.action === "settle") {
            await queueSettlePlan(ctx, feed);
          } else if (intent.action === "start") {
            await queueStartPlan(ctx, feed);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          markStartCooldown(feed.symbol, msg);
          console.log(
            JSON.stringify({
              level: "error",
              msg: "intent_processing_failed",
              symbol: feed.symbol,
              action: intent.action,
              roundId: intent.roundId,
              error: msg,
            })
          );
        } finally {
          inflightActionKeys.delete(key);
        }
      })();
    }

    await new Promise((r) => setTimeout(r, checkMs));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
