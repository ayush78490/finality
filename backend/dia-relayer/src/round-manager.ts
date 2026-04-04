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
 *   SETTLE_TO_START_DELAY_MS – ms to wait after a successful settle before start_round (default 180000).
 *                               Claim only works while the round is still Resolved; this widens the window.
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
import {
  encodeFinSettleRound,
  encodeFinStartRound,
  encodeOracleSubmitRound,
  encodeVftApprove,
} from "./sails-scale.js";
import { sendGearMessage } from "./send-gear-message.js";
import { pingOracleKeeperHealth, postOracleKeeperResolve } from "./oracle-keeper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIN_DECIMALS = 12;

type FeedEntry = RelayerFileConfig["feeds"][number];

async function pushBinanceOracle(
  api: GearApi,
  marketId: string,
  feed: FeedEntry,
  oracle: any
): Promise<void> {
  const sym = binanceSymbolForFeed(feed);
  const tick = await fetchBinanceSpotTick(sym);
  const payload = encodeOracleSubmitRound(api, feed.assetId, tick.price);
  await sendGearMessage(api, marketId, payload, oracle);
}

/** Gas simulation for settle: avoids submit_round when the round is still active or there is nothing to settle. */
async function classifySettleSim(
  api: GearApi,
  marketId: string,
  assetKey: string,
  adminHex: string
): Promise<"too_early" | "can_settle" | "no_round"> {
  const payload = encodeFinSettleRound(api, assetKey);
  try {
    await api.program.calculateGas.handle(
      adminHex as `0x${string}`,
      marketId as `0x${string}`,
      payload,
      0,
      true
    );
    return "can_settle";
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes("too early")) return "too_early";
    if (msg.includes("no round") || msg.includes("not open")) return "no_round";
    return "can_settle";
  }
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
  const sim = await classifySettleSim(api, marketId, assetKey, adminHex);

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

  await pushBinanceOracle(api, marketId, feed, oracle);
  try {
    await sendGearMessage(api, marketId, encodeFinSettleRound(api, assetKey), admin);
    console.log(JSON.stringify({ level: "info", msg: "settle_ok", symbol: assetKey }));
    settledAtMs.set(assetKey, Date.now());
    return "settled";
  } catch (e: any) {
    const msg: string = e?.message ?? String(e);
    if (msg.includes("too early")) {
      console.log(
        JSON.stringify({ level: "info", msg: "round_active_too_early", symbol: assetKey })
      );
      return "active";
    }
    if (msg.includes("no round") || msg.includes("not open")) {
      console.log(
        JSON.stringify({ level: "info", msg: "settle_skip", symbol: assetKey, reason: msg })
      );
      return "no_round";
    }
    console.log(
      JSON.stringify({ level: "warn", msg: "settle_unexpected", symbol: assetKey, error: msg })
    );
    return "no_round";
  }
}

/** After settlement, winners must claim while the round is still `Resolved`. `start_round` replaces that state — delay gives users time to claim. */
function settleToStartDelayMs(): number {
  const raw = process.env.SETTLE_TO_START_DELAY_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return 60_000; // default 1 minute (testnet-friendly; override with SETTLE_TO_START_DELAY_MS)
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

  await pushBinanceOracle(api, marketId, feed, oracle);

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

  console.log(
    JSON.stringify({
      level: "info",
      msg: "starting_round",
      symbol: assetKey,
      seedFin: seedFin.toString(),
      feeBps,
    })
  );
  await sendGearMessage(api, marketId, encodeFinStartRound(api, assetKey, seedFin, feeBps), admin);
  console.log(JSON.stringify({ level: "info", msg: "round_started", symbol: assetKey }));
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

    if (result === "active") return;

    // Determine how long to wait before starting the next round.
    // "settled" = we just settled this iteration → start the full claim window.
    // "no_round" = round was already Resolved (or genuinely no round) when this loop ran.
    //   • If settledAtMs has a timestamp from a previous iteration, honour the remaining window.
    //   • If settledAtMs is empty (process just restarted, round was Resolved on arrival),
    //     skip the claim window — assume the previous settle happened long before restart.
    const claimWindowMs = settleToStartDelayMs();

    if (result === "settled") {
      // Fresh settle this iteration — wait the full claim window.
      console.log(
        JSON.stringify({
          level: "info",
          msg: "settle_to_start_delay",
          symbol: feed.symbol,
          delayMs: claimWindowMs,
        })
      );
      await new Promise((r) => setTimeout(r, claimWindowMs));
    } else {
      // Round is already Resolved (no_round).
      const prev = settledAtMs.get(feed.symbol);
      if (prev !== undefined) {
        const elapsed = Date.now() - prev;
        const remaining = claimWindowMs - elapsed;
        if (remaining > 0) {
          // Still within the original claim window — keep waiting.
          console.log(
            JSON.stringify({
              level: "info",
              msg: "claim_window_remaining",
              symbol: feed.symbol,
              remainingMs: remaining,
            })
          );
          await new Promise((r) => setTimeout(r, remaining));
        }
        // else: claim window already elapsed — proceed to start_round immediately.
      }
      // else: process just started, round was already Resolved — start immediately.
    }

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
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
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
