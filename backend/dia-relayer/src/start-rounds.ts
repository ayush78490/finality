/**
 * For every registered feed: Oracle.submit_round (Binance) → settle if needed →
 * submit_round again → approve FIN → Fin.start_round.
 *
 * submit_round must run before settle and before start_round (fresh oracle tick).
 *
 * Usage: npm run start-rounds
 *
 * Env vars:
 *   BOOTSTRAP_MNEMONIC  – admin that deployed the market (settle, approve, start_round)
 *   RELAYER_MNEMONIC    – oracle authority (must match Fin.init oracle_authority) for submit_round
 *   VARA_WS_ENDPOINT    – default wss://testnet.vara.network
 *   MARKET_PROGRAM_ID   – from oracle.config.json or env
 *   FIN_PROGRAM_ID      – extended-VFT contract id
 *   LIQUIDITY_SEED_FIN  – FIN per side (default 100 FIN = 100_000_000_000_000 base units)
 *   FEE_BPS             – fee in basis points (default 100 = 1%)
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi } from "@gear-js/api";
import type { KeyringPair } from "@polkadot/keyring/types";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { loadRelayerConfig } from "./config.js";
import { binanceSymbolForFeed, fetchBinanceSpotTick } from "./binance.js";
import { fetchLatestDia } from "./dia.js";
import {
  encodeFinSettleRound,
  encodeFinStartRound,
  encodeOracleSubmitRound,
  encodeVftApprove,
} from "./sails-scale.js";
import { sendGearMessage } from "./send-gear-message.js";
import { createVaraKeyring } from "./keyring-vara.js";
import { waitForRoundVisible } from "./round-read.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIN_DECIMALS = 12;

async function pushOracle(
  api: GearApi,
  marketId: string,
  feed: { assetId: number; symbol: string; diaSymbol: string; binanceSymbol?: string },
  oracle: KeyringPair,
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
  const pl = encodeOracleSubmitRound(api, feed.assetId, price);
  await sendGearMessage(api, marketId, pl, oracle);
}

async function main() {
  const configPath =
    process.env.ORACLE_CONFIG ??
    path.resolve(__dirname, "../../..", "config", "oracle.config.json");
  const fileCfg = loadRelayerConfig(configPath);

  const marketId = (process.env.MARKET_PROGRAM_ID?.trim() || fileCfg.marketProgramId.trim()) as string;
  const finId = (process.env.FIN_PROGRAM_ID?.trim() ||
    "0x5e5e6163bc512f3f552fad1382517695e2413c2a9583d85cf719dcd3807c103a") as string;

  if (!marketId) throw new Error("Set MARKET_PROGRAM_ID");

  const bootstrapMn = process.env.BOOTSTRAP_MNEMONIC?.trim();
  const relMn = process.env.RELAYER_MNEMONIC?.trim();
  if (!bootstrapMn) throw new Error("BOOTSTRAP_MNEMONIC is required");
  if (!relMn) throw new Error("RELAYER_MNEMONIC is required (oracle authority for submit_round)");

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";

  const seedFin = BigInt(process.env.LIQUIDITY_SEED_FIN ?? String(100n * 10n ** BigInt(FIN_DECIMALS)));
  const feeBps = Number(process.env.FEE_BPS ?? "100");

  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const admin = keyring.addFromMnemonic(bootstrapMn);
  const oracle = keyring.addFromMnemonic(relMn);

  console.log(
    JSON.stringify({
      level: "info",
      msg: "start_rounds_begin",
      marketId,
      finId,
      seedFin: seedFin.toString(),
      feeBps,
      feeds: fileCfg.feeds.length,
    })
  );

  for (const feed of fileCfg.feeds) {
    const assetKey = feed.symbol;

    // 1. Fresh oracle tick before settle (Fin.settle_round needs a recent submit_round)
    console.log(JSON.stringify({ level: "info", msg: "oracle_push_before_settle", symbol: assetKey }));
    try {
      await pushOracle(api, marketId, feed, oracle, fileCfg.diaBaseUrl);
      await new Promise((r) => setTimeout(r, 1200));
    } catch (e: any) {
      console.log(
        JSON.stringify({
          level: "error",
          msg: "submit_round_failed_before_settle",
          symbol: assetKey,
          error: e?.message ?? String(e),
        })
      );
      continue;
    }

    // 2. Settle expired / open round (ignore benign errors)
    console.log(JSON.stringify({ level: "info", msg: "trying_settle", symbol: assetKey }));
    try {
      const settlePl = encodeFinSettleRound(api, assetKey);
      await sendGearMessage(api, marketId, settlePl, admin);
      console.log(JSON.stringify({ level: "info", msg: "settle_ok", symbol: assetKey }));
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes("too early") || msg.includes("not open") || msg.includes("no round")) {
        console.log(JSON.stringify({ level: "info", msg: "settle_skip", symbol: assetKey, reason: msg }));
      } else {
        console.log(JSON.stringify({ level: "warn", msg: "settle_err", symbol: assetKey, error: msg }));
      }
    }

    // 3. Fresh tick before start_round (same stale-oracle guard as settle)
    console.log(JSON.stringify({ level: "info", msg: "oracle_push_before_start", symbol: assetKey }));
    try {
      await pushOracle(api, marketId, feed, oracle, fileCfg.diaBaseUrl);
      await new Promise((r) => setTimeout(r, 1200));
    } catch (e: any) {
      console.log(
        JSON.stringify({
          level: "error",
          msg: "submit_round_failed_before_start",
          symbol: assetKey,
          error: e?.message ?? String(e),
        })
      );
      continue;
    }

    const approveAmount = seedFin * 2n;
    console.log(
      JSON.stringify({
        level: "info",
        msg: "approving_fin",
        symbol: assetKey,
        amount: approveAmount.toString(),
      })
    );
    try {
      const approvePl = encodeVftApprove(api, marketId, approveAmount);
      await sendGearMessage(api, finId, approvePl, admin);
      console.log(JSON.stringify({ level: "info", msg: "approve_ok", symbol: assetKey }));
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e: any) {
      console.log(
        JSON.stringify({
          level: "error",
          msg: "approve_failed",
          symbol: assetKey,
          error: e?.message ?? String(e),
        })
      );
      continue;
    }

    const maxStartAttempts = 3;
    let started = false;
    for (let startAttempt = 1; startAttempt <= maxStartAttempts; startAttempt++) {
      if (startAttempt > 1) {
        console.log(
          JSON.stringify({
            level: "warn",
            msg: "start_round_retry",
            symbol: assetKey,
            attempt: startAttempt,
          })
        );
        try {
          await pushOracle(api, marketId, feed, oracle, fileCfg.diaBaseUrl);
        } catch (e: any) {
          console.log(
            JSON.stringify({
              level: "error",
              msg: "submit_round_failed_before_retry_start",
              symbol: assetKey,
              error: e?.message ?? String(e),
            })
          );
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }

      console.log(
        JSON.stringify({
          level: "info",
          msg: "starting_round",
          symbol: assetKey,
          attempt: startAttempt,
        })
      );
      try {
        const startPl = encodeFinStartRound(api, assetKey, seedFin, feeBps);
        await sendGearMessage(api, marketId, startPl, admin);
        const visible = await waitForRoundVisible(api, marketId, assetKey, admin.address, {
          attempts: 12,
          intervalMs: 1500,
        });
        if (!visible) {
          throw new Error("round_not_visible_after_start");
        }
        console.log(JSON.stringify({ level: "info", msg: "start_round_ok", symbol: assetKey }));
        started = true;
        break;
      } catch (e: any) {
        const err = e?.message ?? String(e);
        console.log(
          JSON.stringify({
            level: startAttempt === maxStartAttempts ? "error" : "warn",
            msg: "start_round_failed",
            symbol: assetKey,
            attempt: startAttempt,
            error: err,
          })
        );
      }
    }

    if (!started) {
      console.log(
        JSON.stringify({
          level: "error",
          msg: "start_round_gave_up",
          symbol: assetKey,
        })
      );
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(JSON.stringify({ level: "info", msg: "start_rounds_done" }));
  await api.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
