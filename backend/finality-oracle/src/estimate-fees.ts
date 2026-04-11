import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi } from "@gear-js/api";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { createVaraKeyring } from "./keyring-vara.js";
import { loadRelayerConfig } from "./config.js";
import {
  encodeOracleSubmitRound,
  encodeVftApprove,
  encodeFinStartRound,
  encodeFinSettleRound,
  encodeFinClaimSeed,
  encodeFinSettleAndRoll,
  encodeFinSettleAndRollWithTick,
  gearPayloadHex,
} from "./sails-scale.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function toTvara(v: bigint): number {
  return Number(v) / 1e12;
}

function parseGasLimit(api: GearApi, simulated: bigint): bigint {
  const blockCap = api.blockGasLimit.toBigInt();
  const minFloor = BigInt(process.env.GEAR_HANDLE_MIN_GAS ?? "250000000000");
  const useBlockGas =
    process.env.GEAR_USE_BLOCK_GAS === undefined ||
    process.env.GEAR_USE_BLOCK_GAS === "1" ||
    process.env.GEAR_USE_BLOCK_GAS?.toLowerCase() === "true";

  if (useBlockGas) return blockCap;
  const floored = simulated > minFloor ? simulated : minFloor;
  return floored > blockCap ? blockCap : floored;
}

async function estimateTxCost(
  api: GearApi,
  dest: string,
  payload: Uint8Array,
  signer: any
): Promise<{ partialFee: bigint; tip: bigint; total: bigint; gasLimit: bigint }> {
  const source = api.registry.createType("AccountId", signer.address).toHex();
  let gasLimit: bigint;
  try {
    const info = await api.program.calculateGas.handle(
      source as `0x${string}`,
      dest as `0x${string}`,
      payload,
      0,
      true
    );
    gasLimit = parseGasLimit(api, (info.min_limit.toBigInt() * 11n) / 10n);
  } catch {
    gasLimit = parseGasLimit(api, 500_000_000_000n);
  }

  const tx = api.tx.gear.sendMessage(dest as `0x${string}`, gearPayloadHex(payload), gasLimit, 0, true);
  const info = await tx.paymentInfo(signer.address);
  const partialFee = BigInt(info.partialFee.toString());
  const tip = partialFee + 1_000_000n;
  const total = partialFee + tip;
  return { partialFee, tip, total, gasLimit };
}

async function main() {
  const configPath =
    process.env.ORACLE_CONFIG ?? path.resolve(__dirname, "../../..", "config", "oracle.config.json");
  const cfg = loadRelayerConfig(configPath);

  const marketId = process.env.MARKET_PROGRAM_ID?.trim() || cfg.marketProgramId.trim();
  if (!marketId) throw new Error("Set MARKET_PROGRAM_ID");

  const finId =
    process.env.FIN_PROGRAM_ID?.trim() ||
    "0x5e5e6163bc512f3f552fad1382517695e2413c2a9583d85cf719dcd3807c103a";

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const bootstrapMn = process.env.BOOTSTRAP_MNEMONIC?.trim();
  const relMn = process.env.RELAYER_MNEMONIC?.trim();
  if (!bootstrapMn || !relMn) {
    throw new Error("Missing BOOTSTRAP_MNEMONIC or RELAYER_MNEMONIC");
  }

  const seedFin = BigInt(process.env.LIQUIDITY_SEED_FIN ?? String(100n * 10n ** 12n));
  const feeBps = Number(process.env.FEE_BPS ?? "100");
  const feed = cfg.feeds.find((f) => f.symbol === "BTC/USD") ?? cfg.feeds[0];

  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const admin = keyring.addFromMnemonic(bootstrapMn);
  const oracle = keyring.addFromMnemonic(relMn);

  const submitPreSettle = await estimateTxCost(
    api,
    marketId,
    encodeOracleSubmitRound(api, feed.assetId, 100_000_000n),
    oracle
  );
  const settle = await estimateTxCost(api, marketId, encodeFinSettleRound(api, feed.symbol), admin);
  const submitPreStart = await estimateTxCost(
    api,
    marketId,
    encodeOracleSubmitRound(api, feed.assetId, 100_000_000n),
    oracle
  );
  const approve = await estimateTxCost(api, finId, encodeVftApprove(api, marketId, seedFin * 2n), admin);
  const start = await estimateTxCost(
    api,
    marketId,
    encodeFinStartRound(api, feed.symbol, seedFin, feeBps),
    admin
  );
  const claim = await estimateTxCost(api, marketId, encodeFinClaimSeed(api, feed.symbol), admin);

  const settleAndRoll = await estimateTxCost(
    api,
    marketId,
    encodeFinSettleAndRoll(api, feed.symbol),
    admin
  );
  const settleAndRollWithTick = await estimateTxCost(
    api,
    marketId,
    encodeFinSettleAndRollWithTick(api, feed.symbol, 100_000_000n),
    admin
  );

  const legacyAdminTotal = settle.total + approve.total + start.total + claim.total;
  const legacyOracleTotal = submitPreSettle.total + submitPreStart.total;
  const rollingTwoTxTotal = submitPreSettle.total + settleAndRoll.total;
  const rollingOneTxTotal = settleAndRollWithTick.total;

  console.log(
    JSON.stringify(
      {
        endpoint,
        symbol: feed.symbol,
        modeFromConfig: cfg.roundMode,
        perTxTvara: {
          legacy: {
            submitPreSettleOracle: toTvara(submitPreSettle.total),
            settleAdmin: toTvara(settle.total),
            submitPreStartOracle: toTvara(submitPreStart.total),
            approveAdmin: toTvara(approve.total),
            startAdmin: toTvara(start.total),
            claimAdmin: toTvara(claim.total),
          },
          rolling: {
            settleAndRollAdmin: toTvara(settleAndRoll.total),
            settleAndRollWithTickAdmin: toTvara(settleAndRollWithTick.total),
            submitPreSettleOracle: toTvara(submitPreSettle.total),
          },
        },
        cycleTotalsTvara: {
          legacy: {
            admin: toTvara(legacyAdminTotal),
            oracle: toTvara(legacyOracleTotal),
            combined: toTvara(legacyAdminTotal + legacyOracleTotal),
          },
          rollingTwoTx: {
            combined: toTvara(rollingTwoTxTotal),
          },
          rollingOneTx: {
            combined: toTvara(rollingOneTxTotal),
          },
        },
        reductionPct: {
          rollingTwoTxVsLegacy:
            Number(legacyAdminTotal + legacyOracleTotal) > 0
              ? Number(
                  (
                    ((Number(legacyAdminTotal + legacyOracleTotal) - Number(rollingTwoTxTotal)) /
                      Number(legacyAdminTotal + legacyOracleTotal)) *
                    100
                  ).toFixed(2)
                )
              : 0,
          rollingOneTxVsLegacy:
            Number(legacyAdminTotal + legacyOracleTotal) > 0
              ? Number(
                  (
                    ((Number(legacyAdminTotal + legacyOracleTotal) - Number(rollingOneTxTotal)) /
                      Number(legacyAdminTotal + legacyOracleTotal)) *
                    100
                  ).toFixed(2)
                )
              : 0,
        },
        note:
          "Estimates use paymentInfo + initial tip. Final paid fee may be higher when replacement tip escalation occurs.",
      },
      null,
      2
    )
  );

  await api.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
