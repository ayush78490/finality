/**
 * One-shot Fin.init with hex-encoded payload (fixes truncated Vec<u8> on-chain).
 * Run from repo root: npm run emergency:init
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { GearApi, ReplyCode } from "@gear-js/api";
import { createVaraKeyring } from "./keyring-vara.js";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { loadRelayerConfig } from "./config.js";
import { encodeFinFaucetClaim, encodeFinInit, gearPayloadHex } from "./sails-scale.js";
import { sendExtrinsic } from "./send-extrinsic.js";
import { waitUntilMarketInitialized } from "./wait-init.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, "..", ".env") });
loadEnv({ path: path.join(__dirname, "..", "..", "..", ".env") });

function envU64(name: string, fallback: bigint): bigint {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  return BigInt(v);
}

function accountToActorHex(api: GearApi, ss58: string): string {
  return api.registry.createType("AccountId", ss58).toHex();
}

async function main() {
  const configPath =
    process.env.ORACLE_CONFIG ??
    path.resolve(__dirname, "../../..", "config", "oracle.config.json");

  const fileCfg = loadRelayerConfig(configPath);
  const marketId =
    process.env.MARKET_PROGRAM_ID?.trim() || fileCfg.marketProgramId.trim();
  if (!marketId) {
    throw new Error("Set MARKET_PROGRAM_ID or marketProgramId in oracle.config.json");
  }

  const bootstrapMn = process.env.BOOTSTRAP_MNEMONIC?.trim();
  const relayerMn = process.env.RELAYER_MNEMONIC?.trim();
  if (!bootstrapMn) throw new Error("BOOTSTRAP_MNEMONIC is required");
  if (!relayerMn) throw new Error("RELAYER_MNEMONIC is required");

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const roundSeconds = envU64("ROUND_SECONDS", 300n);
  const maxOracleAgeSecs = envU64("MAX_ORACLE_AGE_SECS", 120n);

  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const admin = keyring.addFromMnemonic(bootstrapMn);
  const relayer = keyring.addFromMnemonic(relayerMn);
  const adminHex = accountToActorHex(api, admin.address);

  const initPayload = encodeFinInit(
    api,
    admin.address,
    roundSeconds,
    relayer.address,
    maxOracleAgeSecs
  );
  const hex = gearPayloadHex(initPayload);
  console.log(
    JSON.stringify({
      msg: "fin_init_payload",
      byteLength: initPayload.length,
      hexPreview: `${hex.slice(0, 46)}…`,
      fix:
        "If Gear IDEA showed ~0x46696e only, the old extrinsic truncated the payload; use full hex below for manual send."
    })
  );
  console.log("\n--- FULL Fin.init payload hex (paste in Polkadot.js / Gear if needed) ---\n" + hex + "\n");

  const sim = await api.message.calculateReply(
    {
      origin: admin.address,
      destination: marketId,
      payload: initPayload,
      value: 0
    },
    undefined,
    undefined
  );
  const simCode = new ReplyCode(sim.code.toU8a(), api.specVersion);
  console.log(
    JSON.stringify({
      msg: "simulate_fin_init",
      success: simCode.isSuccess,
      reply: simCode.asString
    })
  );

  if (!simCode.isSuccess) {
    const r = simCode.asString.toLowerCase();
    if (r.includes("already initialized")) {
      console.log(JSON.stringify({ msg: "already_initialized_skip_send" }));
      await api.disconnect();
      process.exit(0);
      return;
    }
    throw new Error(`Fin.init simulation failed: ${simCode.asString}`);
  }

  const gasLimit = api.blockGasLimit.toBigInt();
  const tx = api.tx.gear.sendMessage(
    marketId as `0x${string}`,
    gearPayloadHex(initPayload),
    gasLimit,
    0,
    true
  );
  await sendExtrinsic(api, tx, admin);
  console.log(JSON.stringify({ msg: "fin_init_tx_finalized" }));

  await waitUntilMarketInitialized(api, marketId, adminHex, initPayload, {
    initialDelayMs: 5000,
    maxAttempts: 200,
    intervalMs: 1500
  });

  const probe = keyring.addFromUri("//finality-emergency-init-probe");
  const claimPayload = encodeFinFaucetClaim();
  const claimReply = await api.message.calculateReply(
    {
      origin: probe.address,
      destination: marketId,
      payload: claimPayload,
      value: 0
    },
    undefined,
    undefined
  );
  const claimCode = new ReplyCode(claimReply.code.toU8a(), api.specVersion);
  console.log(
    JSON.stringify({
      msg: "faucet_claim_simulate",
      success: claimCode.isSuccess,
      reply: claimCode.asString
    })
  );

  await api.disconnect();
  process.exit(claimCode.isSuccess ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
