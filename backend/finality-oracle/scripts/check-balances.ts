/**
 * One-off: VARA balance for BOOTSTRAP_MNEMONIC + RELAYER_MNEMONIC (relayer .env).
 * Usage: npx tsx scripts/check-balances.ts
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env") });

import { GearApi } from "@gear-js/api";
import { cryptoWaitReady } from "@polkadot/util-crypto";

import { createVaraKeyring } from "../src/keyring-vara";

async function main() {
  await cryptoWaitReady();
  const ws = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const api = await GearApi.create({ providerAddress: ws });
  const kr = createVaraKeyring();

  const bootMn = process.env.BOOTSTRAP_MNEMONIC?.trim();
  const relMn = process.env.RELAYER_MNEMONIC?.trim();
  if (!bootMn || !relMn) {
    console.error("Missing BOOTSTRAP_MNEMONIC or RELAYER_MNEMONIC in backend/finality-oracle/.env");
    process.exit(1);
  }

  const admin = kr.addFromMnemonic(bootMn);
  const oracle = kr.addFromMnemonic(relMn);

  async function show(label: string, addr: string) {
    const info = await api.query.system.account(addr);
    const data = (info as { data?: { free?: unknown; reserved?: unknown; frozen?: unknown } }).data;
    const free = data?.free != null ? BigInt(String(data.free)) : 0n;
    const reserved = data?.reserved != null ? BigInt(String(data.reserved)) : 0n;
    const frozen = data?.frozen != null ? BigInt(String(data.frozen)) : 0n;
    const dec = 1e12;
    console.log(label);
    console.log("  SS58:", addr);
    console.log("  Free VARA (≈):", (Number(free) / dec).toFixed(6));
    console.log("  Reserved (≈):", (Number(reserved) / dec).toFixed(6));
    if (frozen > 0n) console.log("  Frozen (≈):", (Number(frozen) / dec).toFixed(6));
    console.log("  Free raw:", free.toString());
  }

  console.log("Endpoint:", ws);
  await show("BOOTSTRAP (admin — start_round, settle, approve)", admin.address);
  await show("RELAYER (oracle — submit_round)", oracle.address);
  if (admin.address === oracle.address) {
    console.log("\nNote: both mnemonics derive the SAME account (only one balance matters).");
  }

  await api.provider.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
