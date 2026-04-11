/**
 * One-time (or idempotent) setup after deploy:
 * 1) Fin.init — admin + oracle_authority + round / oracle age
 * 2) Oracle.add_asset — for each feed (unless SKIP_ORACLE_ADD), then Fin.register_asset
 *
 * Requires BOOTSTRAP_MNEMONIC (admin; must sign register_asset) and RELAYER_MNEMONIC
 * (oracle_authority must match the account that runs `npm run round-orchestrator`).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { GearApi, ReplyCode } from "@gear-js/api";
import { createVaraKeyring } from "./keyring-vara.js";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { loadRelayerConfig } from "./config.js";
import {
  encodeFinFaucetClaim,
  encodeFinInit,
  encodeFinRegisterAsset,
  encodeOracleAddAsset,
  gearPayloadHex
} from "./sails-scale.js";
import { sendExtrinsic } from "./send-extrinsic.js";
import { waitUntilMarketInitialized } from "./wait-init.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** `backend/finality-oracle/.env` — works when npm is run from repo root or from this package. */
loadEnv({ path: path.join(__dirname, "..", ".env") });
/** Optional repo-root `.env` (does not override keys already set). */
loadEnv({ path: path.join(__dirname, "..", "..", "..", ".env") });

function envU64(name: string, fallback: bigint): bigint {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  return BigInt(v);
}

function accountToActorHex(api: GearApi, ss58: string): string {
  return api.registry.createType("AccountId", ss58).toHex();
}

/** Min gas from RPC, with headroom; falls back if simulation errors. */
async function resolveHandleGasLimit(
  api: GearApi,
  sourceHex: string,
  dest: string,
  payload: Uint8Array,
  fallback: bigint
): Promise<bigint> {
  try {
    const info = await api.program.calculateGas.handle(
      sourceHex as `0x${string}`,
      dest as `0x${string}`,
      payload,
      0,
      true
    );
    return (info.min_limit.toBigInt() * 11n) / 10n;
  } catch {
    return fallback;
  }
}

/**
 * RPC `min_limit` for some handles (notably `Fin.init`) can be orders of magnitude below
 * gas actually required on-chain; messages then fail while the extrinsic still lands.
 * Floor matches the same ballpark as `ORACLE_GAS_LIMIT` for reliable execution.
 */
function applyBootstrapHandleGasFloor(simulated: bigint, floor: bigint): bigint {
  return simulated > floor ? simulated : floor;
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
  if (!bootstrapMn) throw new Error("BOOTSTRAP_MNEMONIC is required (admin wallet)");
  if (!relayerMn) throw new Error("RELAYER_MNEMONIC is required (oracle = relayer account)");

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const gasFallback = BigInt(process.env.BOOTSTRAP_GAS_LIMIT ?? "500000000000");
  const handleGasFloor = BigInt(process.env.BOOTSTRAP_HANDLE_MIN_GAS ?? "250000000000");

  const roundSeconds = envU64("ROUND_SECONDS", 300n);
  const maxOracleAgeSecs = envU64("MAX_ORACLE_AGE_SECS", 120n);

  const skipInit = process.env.SKIP_INIT === "1" || process.env.SKIP_INIT === "true";
  const skipRegister = process.env.SKIP_REGISTER === "1" || process.env.SKIP_REGISTER === "true";
  const skipOracleAdd =
    process.env.SKIP_ORACLE_ADD === "1" || process.env.SKIP_ORACLE_ADD === "true";

  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const admin = keyring.addFromMnemonic(bootstrapMn);
  const relayer = keyring.addFromMnemonic(relayerMn);

  const adminHex = accountToActorHex(api, admin.address);
  const oracleHex = accountToActorHex(api, relayer.address);

  console.log(
    JSON.stringify({
      level: "info",
      msg: "bootstrap_start",
      marketProgramId: marketId,
      admin: adminHex,
      oracle_authority: oracleHex,
      roundSeconds: roundSeconds.toString(),
      maxOracleAgeSecs: maxOracleAgeSecs.toString(),
      feeds: fileCfg.feeds.length,
      skipInit,
      skipRegister,
      skipOracleAdd,
      bootstrap_handle_min_gas: handleGasFloor.toString()
    })
  );

  if (!skipInit) {
    const initPayload = encodeFinInit(api, admin.address, roundSeconds, relayer.address, maxOracleAgeSecs);
    const simulatedInitGas = await resolveHandleGasLimit(api, adminHex, marketId, initPayload, gasFallback);
    const floored = applyBootstrapHandleGasFloor(simulatedInitGas, handleGasFloor);
    const blockCap = api.blockGasLimit.toBigInt();
    const useBlockGas =
      process.env.BOOTSTRAP_INIT_USE_BLOCK_GAS === "1" ||
      process.env.BOOTSTRAP_INIT_USE_BLOCK_GAS === "true" ||
      process.env.BOOTSTRAP_INIT_USE_BLOCK_GAS === undefined;
    const gasLimit = useBlockGas ? blockCap : floored > blockCap ? blockCap : floored;
    console.log(
      JSON.stringify({
        level: "info",
        msg: "fin_init_gas_limit",
        simulated: simulatedInitGas.toString(),
        after_floor: floored.toString(),
        block_gas_cap: blockCap.toString(),
        send_gas: gasLimit.toString(),
        init_use_block_gas: useBlockGas
      })
    );
    const tx = api.tx.gear.sendMessage(
      marketId as `0x${string}`,
      gearPayloadHex(initPayload),
      gasLimit,
      0,
      true
    );
    try {
      await sendExtrinsic(api, tx, admin);
      console.log(JSON.stringify({ level: "info", msg: "fin_init_tx_in_block" }));
      console.log(
        JSON.stringify({
          level: "info",
          msg: "fin_init_waiting_chain",
          note: "Waiting until Fin.init is processed before register_asset"
        })
      );
      await waitUntilMarketInitialized(api, marketId, adminHex, initPayload, {
        initialDelayMs: 5000,
        maxAttempts: 200,
        intervalMs: 1500
      });
      console.log(JSON.stringify({ level: "info", msg: "fin_init_ok" }));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes("already") || msg.includes("Initialized")) {
        console.log(JSON.stringify({ level: "warn", msg: "fin_init_skipped", reason: msg }));
      } else {
        throw e;
      }
    }
  }

  if (!skipRegister) {
    if (!skipOracleAdd) {
      for (const feed of fileCfg.feeds) {
        const addPayload = encodeOracleAddAsset(api, feed.diaSymbol, 8, feed.symbol);
        const simulatedAddGas = await resolveHandleGasLimit(api, adminHex, marketId, addPayload, gasFallback);
        const addGas = applyBootstrapHandleGasFloor(simulatedAddGas, handleGasFloor);
        const txAdd = api.tx.gear.sendMessage(
          marketId as `0x${string}`,
          gearPayloadHex(addPayload),
          addGas,
          0,
          true
        );
        try {
          await sendExtrinsic(api, txAdd, admin);
          console.log(
            JSON.stringify({ level: "info", msg: "oracle_add_asset_ok", symbol: feed.diaSymbol })
          );
        } catch (e: any) {
          console.log(
            JSON.stringify({
              level: "warn",
              msg: "oracle_add_asset_skip",
              symbol: feed.diaSymbol,
              error: e?.message ?? String(e)
            })
          );
        }
        await new Promise((r) => setTimeout(r, 6000));
      }
    }

    for (const feed of fileCfg.feeds) {
      const regPayload = encodeFinRegisterAsset(api, feed.symbol, feed.assetId);
      const simulatedRegGas = await resolveHandleGasLimit(api, adminHex, marketId, regPayload, gasFallback);
      const regGas = applyBootstrapHandleGasFloor(simulatedRegGas, handleGasFloor);
      const tx = api.tx.gear.sendMessage(
        marketId as `0x${string}`,
        gearPayloadHex(regPayload),
        regGas,
        0,
        true
      );
      try {
        await sendExtrinsic(api, tx, admin);
        console.log(
          JSON.stringify({ level: "info", msg: "register_asset_ok", symbol: feed.symbol })
        );
      } catch (e: any) {
        console.log(
          JSON.stringify({
            level: "error",
            msg: "register_asset_failed",
            symbol: feed.symbol,
            error: e?.message ?? String(e)
          })
        );
      }
      await new Promise((r) => setTimeout(r, 6000));
    }
  }

  console.log(JSON.stringify({ level: "info", msg: "bootstrap_done" }));

  // Post-check: simulate Fin.FaucetClaim from a throwaway origin (no prior cooldown).
  try {
    const probe = keyring.addFromUri("//finality-bootstrap-faucet-probe");
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
        level: claimCode.isSuccess ? "info" : "warn",
        msg: "faucet_claim_simulate_after_bootstrap",
        success: claimCode.isSuccess,
        reply: claimCode.asString
      })
    );
    if (!claimCode.isSuccess) {
      console.log(
        JSON.stringify({
          level: "warn",
          msg: "faucet_still_fails_simulation",
          hint: "Check Fin.init message in Gear IDEA (execution vs inclusion), treasury FIN on market actor, and WASM vs program id."
        })
      );
    }
  } catch (e: any) {
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "faucet_claim_simulate_skipped",
        error: e?.message ?? String(e)
      })
    );
  }

  await api.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
