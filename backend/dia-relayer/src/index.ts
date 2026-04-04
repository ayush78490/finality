import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi } from "@gear-js/api";
import { createVaraKeyring } from "./keyring-vara.js";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { loadRelayerConfig } from "./config.js";
import { fetchLatestDia } from "./dia.js";
import { encodeOracleSubmitRound } from "./sails-scale.js";
import { initialTip, parsePoolPriority, tipToBeat } from "./tip.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function envFlag(name: string, defaultValue: boolean) {
  const v = process.env[name];
  if (v === undefined) return defaultValue;
  return v === "1" || v.toLowerCase() === "true";
}

/** Legacy: continuous DIA polling + Oracle.submit_round. Off unless ORACLE_ENABLE_PUSH=true. */
async function runLegacyDiaRelayer() {
  const configPath =
    process.env.ORACLE_CONFIG ??
    path.resolve(__dirname, "../../..", "config", "oracle.config.json");

  const fileCfg = loadRelayerConfig(configPath);
  const marketId = process.env.MARKET_PROGRAM_ID?.trim() || fileCfg.marketProgramId.trim();
  const dryRunDefault = !marketId;
  const dryRun = envFlag("DRY_RUN", dryRunDefault);

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const mnemonic = process.env.RELAYER_MNEMONIC;

  await cryptoWaitReady();

  let api: GearApi | undefined;
  let signer: any;

  if (!dryRun) {
    if (!mnemonic) {
      throw new Error("RELAYER_MNEMONIC is required when DRY_RUN=false");
    }
    api = await GearApi.create({ providerAddress: endpoint });
    const keyring = createVaraKeyring();
    signer = keyring.addFromMnemonic(mnemonic);
  }

  const gasLimit = BigInt(process.env.ORACLE_GAS_LIMIT ?? "250000000000");
  const nowSec = () => Math.floor(Date.now() / 1000);

  console.log(
    JSON.stringify({
      level: "info",
      msg: "dia_oracle_relayer_start",
      diaBaseUrl: fileCfg.diaBaseUrl,
      endpoint,
      dryRun,
      marketProgramId: marketId || null,
      feeds: fileCfg.feeds.length,
      pollMs: fileCfg.pollIntervalMs,
    })
  );

  async function tickOnce() {
    for (const feed of fileCfg.feeds) {
      try {
        const parsed = await fetchLatestDia(fileCfg.diaBaseUrl, feed.diaSymbol);
        const age = nowSec() - parsed.price.publish_time;
        if (age > fileCfg.maxPriceAgeSeconds) {
          console.log(
            JSON.stringify({
              level: "warn",
              msg: "price_stale_skip",
              symbol: feed.symbol,
              ageSeconds: age,
              max: fileCfg.maxPriceAgeSeconds,
            })
          );
          continue;
        }

        if (dryRun || !api) {
          console.log(
            JSON.stringify({
              level: "info",
              msg: "oracle_push_dry_run",
              symbol: feed.symbol,
            })
          );
          continue;
        }

        const payload = encodeOracleSubmitRound(api, feed.assetId, BigInt(parsed.price.price));
        const tx = api.tx.gear.sendMessage(
          marketId as `0x${string}`,
          payload,
          gasLimit,
          0,
          true
        );

        let tip = await initialTip(tx, signer.address);
        let partialFee = 0n;
        try {
          partialFee = BigInt((await tx.paymentInfo(signer.address)).partialFee.toString());
        } catch {}

        const maxTipAttempts = 4;
        let pushed = false;
        for (let tipAttempt = 0; tipAttempt < maxTipAttempts; tipAttempt++) {
          const nonce = await (api.rpc as any).system.accountNextIndex(signer.address);
          try {
            await new Promise<void>((resolve, reject) => {
              tx.signAndSend(signer, { nonce, tip } as any, ({ status, dispatchError }: any) => {
                if (dispatchError) {
                  if (dispatchError.isModule) {
                    const meta = api.registry.findMetaError(dispatchError.asModule);
                    reject(new Error(`${meta.section}.${meta.name}: ${meta.docs.join(" ")}`));
                  } else {
                    reject(new Error(dispatchError.toString()));
                  }
                  return;
                }
                if (status?.isInBlock || status?.isFinalized) resolve();
              }).catch(reject);
            });
            pushed = true;
            break;
          } catch (tipErr: any) {
            const tipMsg: string = tipErr?.message ?? String(tipErr);
            if (/1014|Priority is too low/i.test(tipMsg) && tipAttempt < maxTipAttempts - 1) {
              const pp = parsePoolPriority(tipMsg);
              tip = pp !== null ? tipToBeat(pp, partialFee) : tip * 2n + 1_000_000n;
              await new Promise((r) => setTimeout(r, 400));
            } else {
              throw tipErr;
            }
          }
        }
        if (!pushed) throw new Error("Failed to push oracle tx after tip escalation");
        console.log(
          JSON.stringify({
            level: "info",
            msg: "oracle_push_ok",
            symbol: feed.symbol,
            publish_time: parsed.price.publish_time,
          })
        );
      } catch (error: any) {
        console.log(
          JSON.stringify({
            level: "error",
            msg: "oracle_push_failed",
            symbol: feed.symbol,
            error: error?.message ?? String(error),
          })
        );
      }
    }
  }

  for (;;) {
    await tickOnce();
    await new Promise((r) => setTimeout(r, fileCfg.pollIntervalMs));
  }
}

async function main() {
  if (process.env.ORACLE_ENABLE_PUSH !== "true") {
    console.log(
      JSON.stringify({
        level: "info",
        msg: "oracle_push_disabled",
        hint: "Production uses `npm run round-manager` (Binance → submit_round only at settle/start). Set ORACLE_ENABLE_PUSH=true to run the legacy DIA polling loop.",
      })
    );
    process.exit(0);
  }
  await runLegacyDiaRelayer();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
