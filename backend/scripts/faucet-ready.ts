/**
 * Read-only: market FIN treasury + simulate Fin.FaucetClaim (probe account).
 *
 * Exit 0 — claim simulation succeeds (init + handle path OK for a fresh wallet).
 * Exit 2 — simulation fails (usually need Fin.init: npm run bootstrap:market).
 *
 * Usage: npx tsx scripts/faucet-ready.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi, ReplyCode } from "@gear-js/api";
import { createVaraKeyring } from "./vara-keyring.js";
import { compactAddLength, stringToU8a, u8aConcat } from "@polkadot/util";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { readMarketTreasuryFin } from "./check-market-treasury.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function scaleStr(v: string): Uint8Array {
  return compactAddLength(stringToU8a(v));
}

function encodeFinFaucetClaim(): Uint8Array {
  return u8aConcat(scaleStr("Fin"), scaleStr("FaucetClaim"));
}

async function main() {
  const oracle = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "config", "oracle.config.json"), "utf8")
  ) as { marketProgramId: string };
  const deployed = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "config", "deployed.token.json"), "utf8")
  ) as { varaTestnet: { finTokenProgramId: string } };

  const marketId = oracle.marketProgramId;
  const finId = deployed.varaTestnet.finTokenProgramId;

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });

  const { raw: treasuryRaw, formatted: treasuryFmt } = await readMarketTreasuryFin(
    api,
    marketId,
    finId
  );

  console.log("=== Faucet readiness (read-only) ===\n");
  console.log("Market program:", marketId);
  console.log("FIN program:   ", finId);
  console.log("Treasury:      ", treasuryFmt, "FIN");
  console.log("Treasury raw:  ", treasuryRaw.toString(), "\n");

  if (treasuryRaw === 0n) {
    console.log(
      "Treasury is 0 — fund the market program on the FIN token before the faucet can pay.\n"
    );
  }

  const keyring = createVaraKeyring();
  const probeAddr = keyring.addFromUri("//finality-faucet-ready-probe").address;

  const claimPayload = encodeFinFaucetClaim();
  const claimReply = await api.message.calculateReply(
    {
      origin: probeAddr,
      destination: marketId,
      payload: claimPayload,
      value: 0
    },
    undefined,
    undefined
  );
  const claimCode = new ReplyCode(claimReply.code.toU8a(), api.specVersion);
  console.log("Fin.FaucetClaim (simulate, probe wallet):");
  console.log("  success:", claimCode.isSuccess);
  console.log("  code:   ", claimCode.asString);

  await api.disconnect();

  if (!claimCode.isSuccess) {
    console.log(
      "\n→ Run from repo root:  npm run bootstrap:market  " +
        "(set BOOTSTRAP_MNEMONIC + RELAYER_MNEMONIC in backend/dia-relayer/.env or export env vars). " +
        "See docs/TESTNET.md."
    );
    process.exit(2);
  }

  if (treasuryRaw === 0n) {
    console.log("\n→ Simulation passed but treasury is empty — fund treasury before users can claim.");
    process.exit(2);
  }

  console.log("\n→ On-chain faucet path looks OK.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
