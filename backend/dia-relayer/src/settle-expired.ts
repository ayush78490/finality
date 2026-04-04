/**
 * One-shot: Oracle.submit_round (Binance price) + Fin.settle_round for each feed.
 * Use when a round ended but nothing resolved (relayer was off).
 *
 * Usage: npm run settle-expired
 *
 * Env: BOOTSTRAP_MNEMONIC (signs settle), RELAYER_MNEMONIC (oracle authority — submit_round),
 *      MARKET_PROGRAM_ID, same as round-manager.
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi } from "@gear-js/api";
import { createVaraKeyring } from "./keyring-vara.js";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { loadRelayerConfig } from "./config.js";
import { binanceSymbolForFeed, fetchBinanceSpotTick } from "./binance.js";
import { encodeFinSettleRound, encodeOracleSubmitRound } from "./sails-scale.js";
import { sendGearMessage } from "./send-gear-message.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const configPath =
    process.env.ORACLE_CONFIG ??
    path.resolve(__dirname, "../../..", "config", "oracle.config.json");
  const fileCfg = loadRelayerConfig(configPath);
  const marketId = (process.env.MARKET_PROGRAM_ID?.trim() || fileCfg.marketProgramId.trim()) as string;
  if (!marketId) throw new Error("Set MARKET_PROGRAM_ID");

  const bootstrapMn = process.env.BOOTSTRAP_MNEMONIC?.trim();
  const relMn = process.env.RELAYER_MNEMONIC?.trim();
  if (!bootstrapMn) throw new Error("BOOTSTRAP_MNEMONIC is required");
  if (!relMn) throw new Error("RELAYER_MNEMONIC is required (oracle authority for submit_round)");

  const only = process.env.SETTLE_ASSET_KEY?.trim();
  const feeds = only
    ? fileCfg.feeds.filter((f) => f.symbol === only)
    : fileCfg.feeds;
  if (only && feeds.length === 0) throw new Error(`No feed matches SETTLE_ASSET_KEY=${only}`);

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const admin = keyring.addFromMnemonic(bootstrapMn);
  const oracle = keyring.addFromMnemonic(relMn);

  console.log(
    JSON.stringify({
      level: "info",
      msg: "settle_expired_begin",
      marketId,
      feeds: feeds.map((f) => f.symbol),
    })
  );

  for (const feed of feeds) {
    const sym = binanceSymbolForFeed(feed);
    const tick = await fetchBinanceSpotTick(sym);
    const pushPl = encodeOracleSubmitRound(api, feed.assetId, tick.price);
    try {
      await sendGearMessage(api, marketId, pushPl, oracle);
      console.log(JSON.stringify({ level: "info", msg: "submit_round_ok", symbol: feed.symbol }));
    } catch (e: any) {
      console.log(
        JSON.stringify({
          level: "error",
          msg: "submit_round_failed",
          symbol: feed.symbol,
          error: e?.message ?? String(e),
        })
      );
      continue;
    }
    await new Promise((r) => setTimeout(r, 1200));

    try {
      const settlePl = encodeFinSettleRound(api, feed.symbol);
      await sendGearMessage(api, marketId, settlePl, admin);
      console.log(JSON.stringify({ level: "info", msg: "settle_ok", symbol: feed.symbol }));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.log(
        JSON.stringify({
          level: "warn",
          msg: "settle_skip_or_err",
          symbol: feed.symbol,
          error: msg.slice(0, 400),
        })
      );
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  await api.disconnect();
  console.log(JSON.stringify({ level: "info", msg: "settle_expired_done" }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
