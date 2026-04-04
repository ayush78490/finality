/**
 * Read FIN balance on the FIN token for:
 *   - market program id = "treasury" (from config/oracle.config.json)
 *   - optional: your wallet SS58 (argv[2]) to compare
 *
 * Usage:
 *   npx tsx scripts/check-market-treasury.ts
 *   npx tsx scripts/check-market-treasury.ts 5GbG6x...
 *
 * No secrets required (read-only RPC).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi, ReplyCode } from "@gear-js/api";
import { compactAddLength, hexToU8a, stringToU8a, u8aConcat } from "@polkadot/util";
import { cryptoWaitReady, decodeAddress, encodeAddress } from "@polkadot/util-crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const FIN_DECIMALS = 12;

function stringToU8aWithPrefix(value: string): Uint8Array {
  return compactAddLength(stringToU8a(value));
}

function encodeVftBalanceOf(api: GearApi, accountSs58: string): {
  bytes: Uint8Array;
  replyPrefixLen: number;
} {
  const encodedService = stringToU8aWithPrefix("Vft");
  const encodedMethod = stringToU8aWithPrefix("BalanceOf");
  const data = api.registry
    .createType("[u8;32]", decodeAddress(accountSs58))
    .toU8a();
  const bytes = u8aConcat(encodedService, encodedMethod, data);
  return {
    bytes,
    replyPrefixLen: encodedService.length + encodedMethod.length
  };
}

function toU8(payload: unknown): Uint8Array {
  const raw = payload as { length: number; [i: number]: number };
  return Uint8Array.from(
    Array.from({ length: raw.length }, (_, i) => raw[i] as number)
  );
}

function decodeScaleBalance(api: GearApi, buf: Uint8Array): bigint {
  if (buf.length === 0) return 0n;
  if (buf.length >= 32) {
    const pad = new Uint8Array(32);
    pad.set(buf.subarray(0, 32));
    try {
      return BigInt(api.registry.createType("U256", pad).toString());
    } catch {
      /* fall through */
    }
  }
  if (buf.length >= 16) {
    const pad = new Uint8Array(16);
    pad.set(buf.subarray(0, 16));
    try {
      return BigInt(api.registry.createType("u128", pad).toString());
    } catch {
      /* fall through */
    }
  }
  try {
    return BigInt(api.registry.createType("Compact<u128>", buf).toString());
  } catch {
    return 0n;
  }
}

/** 0x + 64 hex → SS58 (same bytes as program ActorId). */
function programIdToSs58(programIdHex: string): string {
  const h = programIdHex.startsWith("0x") ? programIdHex : `0x${programIdHex}`;
  const u8 = hexToU8a(h as `0x${string}`);
  if (u8.length !== 32) {
    throw new Error(`Invalid 32-byte program id (got ${u8.length} bytes)`);
  }
  return encodeAddress(u8);
}

/** FIN balance of the market program actor on the FIN token (treasury for the faucet). */
export async function readMarketTreasuryFin(
  api: GearApi,
  marketProgramIdHex: string,
  finProgramIdHex: string
): Promise<{ raw: bigint; formatted: string }> {
  const marketSs58 = programIdToSs58(marketProgramIdHex);
  const raw = await readFinBalance(api, finProgramIdHex, marketSs58);
  return { raw, formatted: formatFin(raw, FIN_DECIMALS) };
}

async function readFinBalance(
  api: GearApi,
  finProgramId: string,
  accountSs58: string
): Promise<bigint> {
  const { bytes, replyPrefixLen } = encodeVftBalanceOf(api, accountSs58);
  const reply = await api.message.calculateReply(
    {
      origin: accountSs58,
      destination: finProgramId,
      payload: bytes,
      value: 0
    },
    undefined,
    undefined
  );
  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  if (!code.isSuccess) {
    throw new Error(`BalanceOf failed: ${code.asString}`);
  }
  const full = toU8(reply.payload);
  const afterPrefix = full.slice(replyPrefixLen);
  if (afterPrefix.length > 0) {
    return decodeScaleBalance(api, afterPrefix);
  }
  if (full.length === 16 || full.length === 32) {
    return decodeScaleBalance(api, full);
  }
  return 0n;
}

function formatFin(base: bigint, decimals: number): string {
  const d = 10n ** BigInt(decimals);
  const whole = base / d;
  const frac = base % d;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

async function main() {
  const oracle = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "config", "oracle.config.json"), "utf8")
  ) as { marketProgramId: string };
  const deployed = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "config", "deployed.token.json"), "utf8")
  ) as { varaTestnet: { finTokenProgramId: string } };

  const marketHex = oracle.marketProgramId;
  const finHex = deployed.varaTestnet.finTokenProgramId;
  const marketSs58 = programIdToSs58(marketHex);

  const walletArg = process.argv[2]?.trim();

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";

  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });

  const { raw: treasuryRaw, formatted: treasuryFmt } = await readMarketTreasuryFin(
    api,
    marketHex,
    finHex
  );

  console.log("=== On-chain FIN balances (read-only) ===\n");
  console.log(`FIN program:     ${finHex}`);
  console.log(`Market program:  ${marketHex}`);
  console.log(`Market (SS58):   ${marketSs58}`);
  console.log(
    `\nTreasury (FIN on market program ActorId): ${treasuryFmt} FIN`
  );
  console.log(`  (raw base units: ${treasuryRaw.toString()})\n`);

  if (treasuryRaw === 0n) {
    console.log(
      "Treasury is 0 — Fin.FaucetClaim cannot pay users. Fund with Vft.Transfer or VftAdmin.Mint TO this market program id on the FIN token.\n"
    );
  }

  if (walletArg) {
    try {
      const userRaw = await readFinBalance(api, finHex, walletArg);
      console.log(`Your wallet (${walletArg.slice(0, 10)}…): ${formatFin(userRaw, FIN_DECIMALS)} FIN`);
      console.log(`  (raw base units: ${userRaw.toString()})\n`);
    } catch (e) {
      console.error("Could not read wallet balance:", e);
    }
  }

  await api.disconnect();
}

const runTreasuryCli =
  process.env.npm_lifecycle_event === "treasury:check" ||
  process.argv.some((a) => a.replace(/\\/g, "/").includes("check-market-treasury"));

if (runTreasuryCli) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
