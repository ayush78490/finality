/**
 * Simulate Fin.FaucetClaim + read Fin.GetFaucetInfo via calculateReply (no wallet, no tx).
 * Shows the exact program error if the claim would fail (e.g. not initialized, cooldown).
 *
 * Usage:
 *   npx tsx scripts/diagnose-faucet.ts 5GbG6x...YourSS58
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi, ReplyCode } from "@gear-js/api";
import { compactAddLength, stringToU8a, u8aConcat } from "@polkadot/util";
import { cryptoWaitReady } from "@polkadot/util-crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function scaleStr(v: string): Uint8Array {
  return compactAddLength(stringToU8a(v));
}

function encodeFinFaucetClaim(): Uint8Array {
  return u8aConcat(scaleStr("Fin"), scaleStr("FaucetClaim"));
}

function encodeFinGetFaucetInfo(api: GearApi, userSs58: string): Uint8Array {
  return u8aConcat(
    scaleStr("Fin"),
    scaleStr("GetFaucetInfo"),
    api.registry.createType("AccountId", userSs58).toU8a()
  );
}

async function main() {
  const user = process.argv[2]?.trim();
  if (!user) {
    console.error("Usage: npx tsx scripts/diagnose-faucet.ts <SS58 address>");
    process.exit(1);
  }

  const oracle = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "config", "oracle.config.json"), "utf8")
  ) as { marketProgramId: string };
  const marketId = oracle.marketProgramId;

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });

  console.log("Market program:", marketId);
  console.log("User:", user, "\n");

  const claimPayload = encodeFinFaucetClaim();
  const claimReply = await api.message.calculateReply(
    {
      origin: user,
      destination: marketId,
      payload: claimPayload,
      value: 0
    },
    undefined,
    undefined
  );
  const claimCode = new ReplyCode(claimReply.code.toU8a(), api.specVersion);
  console.log("Fin.FaucetClaim (simulate):");
  console.log("  success:", claimCode.isSuccess);
  console.log("  code:   ", claimCode.asString);
  if (!claimCode.isSuccess) {
    console.log(
      "\n→ Common causes: market `Fin.init` never ran (panic: not initialized), paused, faucet cooldown, " +
        "or treasury empty. Treasury FIN is separate from VARA gas — run `npx tsx scripts/check-market-treasury.ts`."
    );
  }

  const infoPayload = encodeFinGetFaucetInfo(api, user);
  const infoReply = await api.message.calculateReply(
    {
      origin: user,
      destination: marketId,
      payload: infoPayload,
      value: 0
    },
    undefined,
    undefined
  );
  const infoCode = new ReplyCode(infoReply.code.toU8a(), api.specVersion);
  console.log("\nFin.GetFaucetInfo (simulate):");
  console.log("  success:", infoCode.isSuccess);
  console.log("  code:   ", infoCode.asString);

  await api.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
