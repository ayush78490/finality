/**
 * Read-only checks: initialized?, registered assets vs config, sample round.
 *
 * Usage: npm run verify-market
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi } from "@gear-js/api";
import { createVaraKeyring } from "./keyring-vara.js";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { loadRelayerConfig } from "./config.js";
import {
  encodeFinSetPaused,
  encodeFinStartRound
} from "./sails-scale.js";

const FIN_DECIMALS = 12;
const PROBE_SEED = 100n * 10n ** BigInt(FIN_DECIMALS);
const PROBE_FEE_BPS = 100;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await cryptoWaitReady();
  const configPath =
    process.env.ORACLE_CONFIG ??
    path.resolve(__dirname, "../../..", "config", "oracle.config.json");
  const fileCfg = loadRelayerConfig(configPath);
  const marketId = (process.env.MARKET_PROGRAM_ID?.trim() ||
    fileCfg.marketProgramId.trim()) as string;
  if (!marketId) throw new Error("MARKET_PROGRAM_ID missing");

  const bootstrapMn = process.env.BOOTSTRAP_MNEMONIC?.trim();
  if (!bootstrapMn) throw new Error("BOOTSTRAP_MNEMONIC required for verify");

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const admin = keyring.addFromMnemonic(bootstrapMn);
  const adminHex = api.registry.createType("AccountId", admin.address).toHex();

  console.log(JSON.stringify({ step: 1, msg: "connect", endpoint, marketProgramId: marketId }));

  // 2) Initialized? (SetPaused gas sim requires init + admin)
  let initialized = false;
  try {
    await api.program.calculateGas.handle(
      adminHex as `0x${string}`,
      marketId as `0x${string}`,
      encodeFinSetPaused(api, false),
      0,
      true
    );
    initialized = true;
  } catch {
    initialized = false;
  }
  console.log(JSON.stringify({ step: 2, msg: "initialized", value: initialized }));

  // 3) Per-asset registration: gas-simulate Fin.start_round (fails with "unknown asset" if not registered).
  const expected = fileCfg.feeds.map((f) => f.symbol);
  const perAsset: { symbol: string; registered: boolean; note?: string }[] = [];

  for (const sym of expected) {
    const p = encodeFinStartRound(api, sym, PROBE_SEED, PROBE_FEE_BPS);
    try {
      await api.program.calculateGas.handle(
        adminHex as `0x${string}`,
        marketId as `0x${string}`,
        p,
        0,
        true
      );
      perAsset.push({ symbol: sym, registered: true, note: "start_round gas ok" });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes("unknown asset")) {
        perAsset.push({ symbol: sym, registered: false });
      } else {
        // Typical: "no oracle tick", "stale oracle", "transfer_from" — means asset exists.
        perAsset.push({ symbol: sym, registered: true, note: msg.substring(0, 120) });
      }
    }
  }

  const missing = perAsset.filter((x) => !x.registered).map((x) => x.symbol);

  console.log(JSON.stringify({ step: 3, msg: "assets_registration_probe", perAsset }));

  console.log(
    JSON.stringify({
      step: 4,
      msg: "summary",
      expected_from_oracle_config: expected,
      missing_register_asset: missing,
      all_registered: missing.length === 0 && initialized
    })
  );

  await api.disconnect();
  process.exit(missing.length === 0 && initialized ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
