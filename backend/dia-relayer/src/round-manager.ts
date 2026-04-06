/**
 * Round manager: Binance spot price → Oracle.submit_round only when settling or starting a round.
 * Does not poll DIA or push on a short interval.
 *
 * Usage: npm run round-manager
 *
 * Env vars:
 *   BOOTSTRAP_MNEMONIC  – admin (settle, start_round, approve)
 *   RELAYER_MNEMONIC    – oracle authority (must match Fin.init oracle_authority) for submit_round
 *   VARA_WS_ENDPOINT    – default wss://testnet.vara.network
 *   MARKET_PROGRAM_ID   – from oracle.config.json or env
 *   FIN_PROGRAM_ID      – extended-VFT contract id
 *   LIQUIDITY_SEED_FIN  – u128 base-units per side (default 100 FIN)
 *   FEE_BPS             – fee in basis points (default 100 = 1%)
 *   ROUND_CHECK_MS      – how often to poll (default 15000)
 *   SETTLE_TO_START_DELAY_MS – ms to wait after a successful settle before start_round (default 0).
 *                               New flow: immediate start after end_ts - admin seed auto-claimed.
 *   ROUND_MANAGER_SEND_TXS – must be "true" or "1" to submit any extrinsic (submit_round, settle, start).
 *                            If unset, the process exits immediately — no on-chain messages.
 *
 *   Optional local oracle keeper HTTP (e.g. http://127.0.0.1:8787):
 *   ORACLE_KEEPER_URL          – base URL; each loop pings GET /health, POST /resolve before settle/start.
 *   ORACLE_KEEPER_ONLY         – if "true", a successful POST /resolve skips local submit_round+settle (keeper signs on-chain).
 *   ORACLE_KEEPER_NO_FALLBACK  – if "true" with KEEPER_ONLY, do not fall back to local txs when POST fails.
 *   ORACLE_KEEPER_NOTIFY_START – if "true", POST /resolve { action: "start" } before each start_round.
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi } from "@gear-js/api";
import { createVaraKeyring } from "./keyring-vara.js";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import type { RelayerFileConfig } from "./config.js";
import { loadRelayerConfig } from "./config.js";
import { binanceSymbolForFeed, fetchBinanceSpotTick } from "./binance.js";
import { fetchLatestDia } from "./dia.js";
import {
  encodeFinSettleRound,
  encodeFinStartRound,
  encodeOracleSubmitRound,
  encodeVftApprove,
  encodeFinClaimSeed,
} from "./sails-scale.js";
import { sendGearMessage } from "./send-gear-message.js";
import { pingOracleKeeperHealth, postOracleKeeperResolve } from "./oracle-keeper.js";
import { waitForRoundVisible, readRoundState, readRoundDetail } from "./round-read.js";

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

const nextStartAttemptAtMs = new Map<string, number>();

function markStartCooldown(symbol: string, errMsg: string): void {
  const now = Date.now();
  const cooldown = /InsufficientBalance/i.test(errMsg)
    ? insufficientBalanceCooldownMs
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

/**
 * Checks on-chain round state and end_ts to determine whether we should attempt settlement.
 *
 * Returns:
 *   "too_early"  — round exists and has NOT yet expired (endTs still in the future)
 *   "can_settle" — round is Open/Locked AND its endTs has passed → settle is due
 *   "no_round"   — no round exists, or it's already Resolved → skip to start_round
 */
async function classifySettleSim(
  api: GearApi,
  marketId: string,
  assetKey: string,
  adminHex: string,
  admin: any
): Promise<"too_early" | "can_settle" | "no_round"> {
  // Use the full round detail so we can inspect endTs alongside the phase.
  let detail: Awaited<ReturnType<typeof readRoundDetail>>;
  try {
    detail = await readRoundDetail(api, marketId, assetKey, admin.address);
  } catch (e: any) {
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "settle_state_read_error",
        symbol: assetKey,
        error: e?.message ?? String(e),
      })
    );
    // Fall back to a basic state read so we don't lose the "no_round" / "Resolved" path.
    const state = await readRoundState(api, marketId, assetKey, admin.address);
    if (state === "None" || state === "Resolved") return "no_round";
    return "too_early";
  }

  console.log(
    JSON.stringify({
      level: "debug",
      msg: "settle_state_check",
      symbol: assetKey,
      phase: detail.phase,
      endTs: detail.endTs,
      nowMs: Date.now(),
    })
  );

  if (!detail.phase || detail.phase === "None") {
    return "no_round";
  }

  if (detail.phase === "Resolved") {
    console.log(
      JSON.stringify({
        level: "debug",
        msg: "settle_state_already_resolved_skip_settle",
        symbol: assetKey,
      })
    );
    // Round is already resolved — skip settle, go straight to start new round.
    return "no_round";
  }

  // Open or Locked — check whether endTs has passed.
  const nowMs = Date.now();
  const endMs = detail.endTs; // ms (the relayer reads endTs as seconds × 1000 or raw ms — see readRoundDetail)
  if (nowMs < endMs) {
    console.log(
      JSON.stringify({
        level: "debug",
        msg: "settle_state_not_expired_yet",
        symbol: assetKey,
        phase: detail.phase,
        msUntilEnd: endMs - nowMs,
      })
    );
    return "too_early";
  }

  // Round has expired — ready to settle.
  console.log(
    JSON.stringify({
      level: "debug",
      msg: "settle_state_expired_can_settle",
      symbol: assetKey,
      phase: detail.phase,
      expiredAgoMs: nowMs - endMs,
    })
  );
  return "can_settle";
}

/**
 * Returns:
 *   "active"  — round is Open and not yet expired (do nothing)
 *   "settled" — we just settled it this iteration (start claim window)
 *   "no_round" — round is already Resolved / no round exists (proceed to start_round)
 */
async function trySettleWithPush(
  api: GearApi,
  marketId: string,
  assetKey: string,
  feed: FeedEntry,
  admin: any,
  oracle: any,
  keeper: {
    baseUrl: string;
    keeperOnly: boolean;
    noFallback: boolean;
  } | null
): Promise<"active" | "settled" | "no_round"> {
  const adminHex = api.registry.createType("AccountId", admin.address).toHex();
  const sim = await classifySettleSim(api, marketId, assetKey, adminHex, admin);

  console.log(
    JSON.stringify({
      level: "debug",
      msg: "settle_classify_result",
      symbol: assetKey,
      classification: sim,
    })
  );

  if (sim === "too_early") {
    console.log(
      JSON.stringify({ level: "info", msg: "round_active_too_early", symbol: assetKey })
    );
    return "active";
  }

  if (sim === "no_round") {
    console.log(JSON.stringify({ level: "info", msg: "settle_skip_no_round", symbol: assetKey }));
    return "no_round";
  }

  console.log(
    JSON.stringify({
      level: "debug",
      msg: "settle_attempting",
      symbol: assetKey,
      simResult: sim,
    })
  );

  if (keeper?.baseUrl) {
    try {
      const res = await postOracleKeeperResolve(keeper.baseUrl, {
        marketProgramId: marketId,
        symbol: assetKey,
        assetId: feed.assetId,
        action: "settle",
      });
      console.log(
        JSON.stringify({
          level: res.ok ? "info" : "warn",
          msg: "oracle_keeper_resolve",
          symbol: assetKey,
          httpStatus: res.status,
          keeperOnly: keeper.keeperOnly,
          body: res.text.slice(0, 200),
        })
      );
      if (keeper.keeperOnly && res.ok) {
        console.log(
          JSON.stringify({
            level: "info",
            msg: "settle_delegated_keeper",
            symbol: assetKey,
          })
        );
        settledAtMs.set(assetKey, Date.now());
        return "settled";
      }
      if (keeper.keeperOnly && !res.ok && keeper.noFallback) {
        console.log(
          JSON.stringify({
            level: "error",
            msg: "keeper_resolve_failed_no_fallback",
            symbol: assetKey,
          })
        );
        return "no_round";
      }
    } catch (e: any) {
      const err = e?.message ?? String(e);
      console.log(
        JSON.stringify({
          level: "warn",
          msg: "oracle_keeper_resolve_err",
          symbol: assetKey,
          error: err,
        })
      );
      if (keeper.keeperOnly && keeper.noFallback) {
        return "no_round";
      }
    }
  }

  const cfgPath =
    process.env.ORACLE_CONFIG ?? path.resolve(__dirname, "../../..", "config", "oracle.config.json");
  const cfg = loadRelayerConfig(cfgPath);
  
  console.log(JSON.stringify({ level: "debug", msg: "push_oracle_before_settle", symbol: assetKey }));
  await pushBinanceOracle(api, marketId, feed, oracle, cfg.diaBaseUrl);
  console.log(JSON.stringify({ level: "debug", msg: "oracle_pushed_attempting_settle", symbol: assetKey }));
  
  try {
    await sendGearMessage(api, marketId, encodeFinSettleRound(api, assetKey), admin);
    console.log(JSON.stringify({ level: "info", msg: "settle_ok", symbol: assetKey }));
    settledAtMs.set(assetKey, Date.now());
    
    // Auto-claim seed after settlement (new flow - return liquidity to admin immediately)
    try {
      await sendGearMessage(api, marketId, encodeFinClaimSeed(api, assetKey), admin);
      console.log(JSON.stringify({ level: "info", msg: "admin_seed_claimed", symbol: assetKey }));
    } catch (claimErr: any) {
      const claimMsg = claimErr?.message ?? String(claimErr);
      // Not critical if it fails - might be no seed or already claimed
      console.log(JSON.stringify({ level: "debug", msg: "claim_seed_skipped", symbol: assetKey, reason: claimMsg }));
    }
    
    return "settled";
  } catch (e: any) {
    const msg: string = e?.message ?? String(e);
    console.log(JSON.stringify({ level: "warn", msg: "settle_error", symbol: assetKey, error: msg }));
    if (msg.includes("too early")) {
      console.log(
        JSON.stringify({ level: "info", msg: "round_active_too_early", symbol: assetKey })
      );
      return "active";
    }
    if (msg.includes("no round") || msg.includes("not open")) {
      console.log(
        JSON.stringify({ level: "info", msg: "settle_skip_already_resolved", symbol: assetKey, reason: msg })
      );
      return "no_round";
    }
    // For any other error, also return no_round so we proceed to start
    console.log(
      JSON.stringify({ level: "warn", msg: "settle_other_error_proceed_to_start", symbol: assetKey, error: msg })
    );
    return "no_round";
  }
}

/** After settlement, winners must claim while the round is still `Resolved`. New flow: immediate start after end_ts - claim window handled by smart contract. */
function settleToStartDelayMs(): number {
  const raw = process.env.SETTLE_TO_START_DELAY_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return 0; // default: immediate start (new flow - auto-distribute on end_ts)
}

/**
 * Per-feed timestamp (ms) of the most recent successful settle in this process run.
 * Used to enforce the claim window only once after a fresh settle, not on every retry.
 * When undefined the relayer just started and the round was already Resolved — skip the
 * claim window entirely (assume enough time has passed).
 */
const settledAtMs = new Map<string, number>();

async function startRound(
  api: GearApi,
  marketId: string,
  finId: string,
  assetKey: string,
  feed: FeedEntry,
  admin: any,
  oracle: any,
  seedFin: bigint,
  feeBps: number,
  keeper: {
    baseUrl: string;
    notifyStart: boolean;
  } | null
): Promise<void> {
  const cfgPath =
    process.env.ORACLE_CONFIG ?? path.resolve(__dirname, "../../..", "config", "oracle.config.json");
  const cfg = loadRelayerConfig(cfgPath);
  if (keeper?.notifyStart && keeper.baseUrl) {
    try {
      const res = await postOracleKeeperResolve(keeper.baseUrl, {
        marketProgramId: marketId,
        symbol: assetKey,
        assetId: feed.assetId,
        action: "start",
      });
      console.log(
        JSON.stringify({
          level: res.ok ? "info" : "warn",
          msg: "oracle_keeper_resolve_start",
          symbol: assetKey,
          httpStatus: res.status,
        })
      );
    } catch (e: any) {
      console.log(
        JSON.stringify({
          level: "warn",
          msg: "oracle_keeper_resolve_start_err",
          symbol: assetKey,
          error: e?.message ?? String(e),
        })
      );
    }
  }

  await pushBinanceOracle(api, marketId, feed, oracle, cfg.diaBaseUrl);

  const approveAmount = seedFin * 2n;
  console.log(
    JSON.stringify({
      level: "info",
      msg: "approving_fin",
      symbol: assetKey,
      amount: approveAmount.toString(),
    })
  );
  await sendGearMessage(api, finId, encodeVftApprove(api, marketId, approveAmount), admin);
  await new Promise((r) => setTimeout(r, 1000));

  const maxStartAttempts = 3;
  for (let startAttempt = 1; startAttempt <= maxStartAttempts; startAttempt++) {
    if (startAttempt > 1) {
      await pushBinanceOracle(api, marketId, feed, oracle, cfg.diaBaseUrl);
      await new Promise((r) => setTimeout(r, 1500));
    }

    console.log(
      JSON.stringify({
        level: "info",
        msg: "starting_round",
        symbol: assetKey,
        seedFin: seedFin.toString(),
        feeBps,
        attempt: startAttempt,
      })
    );
    await sendGearMessage(api, marketId, encodeFinStartRound(api, assetKey, seedFin, feeBps), admin);
    const visible = await waitForRoundVisible(api, marketId, assetKey, admin.address, {
      attempts: 12,
      intervalMs: 1500,
    });
    if (visible) {
      console.log(JSON.stringify({ level: "info", msg: "round_started", symbol: assetKey }));
      return;
    }

    console.log(
      JSON.stringify({
        level: startAttempt === maxStartAttempts ? "error" : "warn",
        msg: "round_not_visible_after_start",
        symbol: assetKey,
        attempt: startAttempt,
      })
    );
  }

  throw new Error("round_not_visible_after_start");
}

async function main() {
  const sendTxsFlag = process.env.ROUND_MANAGER_SEND_TXS?.trim().toLowerCase();
  const sendTxs = sendTxsFlag === "true" || sendTxsFlag === "1";
  if (!sendTxs) {
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "round_manager_tx_send_disabled",
        hint: "Set ROUND_MANAGER_SEND_TXS=true when you intentionally want submit_round / settle / start extrinsics. Exiting with no chain messages.",
      })
    );
    process.exit(0);
  }

  const configPath =
    process.env.ORACLE_CONFIG ??
    path.resolve(__dirname, "../../..", "config", "oracle.config.json");
  const fileCfg = loadRelayerConfig(configPath);

  const marketId = (process.env.MARKET_PROGRAM_ID?.trim() || fileCfg.marketProgramId.trim()) as string;
  const finId = (process.env.FIN_PROGRAM_ID?.trim() ||
    "0x5e5e6163bc512f3f552fad1382517695e2413c2a9583d85cf719dcd3807c103a") as string;

  if (!marketId) throw new Error("Set MARKET_PROGRAM_ID");

  const bootstrapMn = process.env.BOOTSTRAP_MNEMONIC?.trim();
  if (!bootstrapMn) throw new Error("BOOTSTRAP_MNEMONIC is required");

  const relMn = process.env.RELAYER_MNEMONIC?.trim();
  if (!relMn) throw new Error("RELAYER_MNEMONIC is required (oracle authority for submit_round)");

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const seedFin = BigInt(process.env.LIQUIDITY_SEED_FIN ?? String(100n * 10n ** BigInt(FIN_DECIMALS)));
  const feeBps = Number(process.env.FEE_BPS ?? "100");
  const checkMs = Number(process.env.ROUND_CHECK_MS ?? "15000");

  const keeperUrl = process.env.ORACLE_KEEPER_URL?.trim();
  const keeperBase = keeperUrl ? keeperUrl.replace(/\/+$/, "") : "";
  const keeperOnly =
    process.env.ORACLE_KEEPER_ONLY?.trim().toLowerCase() === "true" ||
    process.env.ORACLE_KEEPER_ONLY?.trim() === "1";
  const keeperNoFallback =
    process.env.ORACLE_KEEPER_NO_FALLBACK?.trim().toLowerCase() === "true" ||
    process.env.ORACLE_KEEPER_NO_FALLBACK?.trim() === "1";
  const keeperNotifyStart =
    process.env.ORACLE_KEEPER_NOTIFY_START?.trim().toLowerCase() === "true" ||
    process.env.ORACLE_KEEPER_NOTIFY_START?.trim() === "1";

  const keeperOpts =
    keeperBase.length > 0
      ? { baseUrl: keeperBase, keeperOnly, noFallback: keeperNoFallback }
      : null;
  const keeperStartOpts =
    keeperBase.length > 0
      ? { baseUrl: keeperBase, notifyStart: keeperNotifyStart }
      : null;

  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const admin = keyring.addFromMnemonic(bootstrapMn);
  const oracle = keyring.addFromMnemonic(relMn);

  console.log(
    JSON.stringify({
      level: "info",
      msg: "round_manager_start",
      priceSource: "binance",
      marketId,
      finId,
      seedFin: seedFin.toString(),
      feeBps,
      checkMs,
      feeds: fileCfg.feeds.length,
      oracleKeeperUrl: keeperBase || null,
      oracleKeeperOnly: keeperOnly,
      oracleKeeperNotifyStart: keeperNotifyStart,
      startRetryCooldownMs,
      insufficientBalanceCooldownMs,
    })
  );

  async function manageRound(feed: FeedEntry) {
    const result = await trySettleWithPush(
      api,
      marketId,
      feed.symbol,
      feed,
      admin,
      oracle,
      keeperOpts
    );

    console.log(
      JSON.stringify({
        level: "debug",
        msg: "manage_round_result",
        symbol: feed.symbol,
        result,
      })
    );

    if (result === "active") return;

    const blockUntil = nextStartAttemptAtMs.get(feed.symbol) ?? 0;
    const now = Date.now();
    if (blockUntil > now) {
      console.log(
        JSON.stringify({
          level: "info",
          msg: "start_round_skipped_cooldown",
          symbol: feed.symbol,
          waitMs: blockUntil - now,
          reason: "recent_start_failure",
        })
      );
      return;
    }

    // Re-check state right before start to avoid racing a newly opened round.
    const stateBeforeStart = await readRoundState(api, marketId, feed.symbol, admin.address);
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

    // After resolve, immediately start a new round (no delay).
    // Claim/settle can happen anytime - but new market should start ASAP.
    console.log(
      JSON.stringify({
        level: "info",
        msg: "starting_new_round",
        symbol: feed.symbol,
        reason: result,
      })
    );
    try {
      await startRound(
        api,
        marketId,
        finId,
        feed.symbol,
        feed,
        admin,
        oracle,
        seedFin,
        feeBps,
        keeperStartOpts
      );
      clearStartCooldown(feed.symbol);
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
      markStartCooldown(feed.symbol, msg);
      if (msg.includes("no oracle tick") || msg.includes("stale oracle")) {
        console.log(
          JSON.stringify({
            level: "warn",
            msg: "start_deferred_no_oracle",
            symbol: feed.symbol,
            error: msg,
          })
        );
      } else {
        console.log(
          JSON.stringify({
            level: "error",
            msg: "start_round_failed",
            symbol: feed.symbol,
            error: msg,
          })
        );
      }
    }
  }

  for (;;) {
    if (keeperBase) {
      try {
        const h = await pingOracleKeeperHealth(keeperBase);
        console.log(
          JSON.stringify({
            level: h.ok ? "info" : "warn",
            msg: "oracle_keeper_health",
            httpStatus: h.status,
            body: h.text.slice(0, 200),
          })
        );
      } catch (e: any) {
        console.log(
          JSON.stringify({
            level: "warn",
            msg: "oracle_keeper_health_err",
            error: e?.message ?? String(e),
          })
        );
      }
    }

    // One feed at a time: all txs use the same `admin` key. Parallel `Promise.all` caused
    // nonce / priority (1014) races where e.g. BTC `start_round` logged `starting_round` but
    // never reached `round_started` while another feed’s extrinsic won the pool slot.
    for (const feed of fileCfg.feeds) {
      try {
        await manageRound(feed);
      } catch (e: any) {
        console.log(
          JSON.stringify({
            level: "error",
            msg: "manage_round_err",
            symbol: feed.symbol,
            error: e?.message ?? String(e),
          })
        );
      }
    }
    await new Promise((r) => setTimeout(r, checkMs));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
