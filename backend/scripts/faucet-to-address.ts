/**
 * Mint FIN to a wallet via `VftAdmin.Mint` on the extended-VFT program (same as
 * `services/testnet-faucet`). Then verify balance with `Vft.BalanceOf` (read-only RPC).
 *
 * Requires `FAUCET_MINTER_MNEMONIC` (account that can call VftAdmin.Mint on the FIN program).
 * Loads env from repo root `.env`, then `services/testnet-faucet/.env`.
 *
 * Usage:
 *   npx tsx scripts/faucet-to-address.ts
 *   npx tsx scripts/faucet-to-address.ts kGk4YeRpjVAXczzNNq9gbwf2t5m2sr22MX6Bc1S2GMHsmsr6d
 *
 * Env:
 *   FAUCET_MINTER_MNEMONIC  (required)
 *   FAUCET_TARGET_ADDRESS   (optional if you pass address as argv[2])
 *   VARA_WS_ENDPOINT        (default wss://testnet.vara.network)
 *   FAUCET_AMOUNT_BASE_UNITS (default 1000 * 10^12 like testnet-faucet)
 */
import dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi, ReplyCode } from "@gear-js/api";
import { createVaraKeyring } from "./vara-keyring.js";
import { compactAddLength, hexToU8a, stringToU8a, u8aConcat, u8aToHex } from "@polkadot/util";
import { cryptoWaitReady, decodeAddress, encodeAddress } from "@polkadot/util-crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

for (const p of [
  path.join(REPO_ROOT, ".env"),
  path.join(REPO_ROOT, "services", "testnet-faucet", ".env")
]) {
  if (existsSync(p)) dotenv.config({ path: p });
}

const DEFAULT_RECIPIENT =
  "kGk4YeRpjVAXczzNNq9gbwf2t5m2sr22MX6Bc1S2GMHsmsr6d";

const FIN_DECIMALS = 12;

function loadFinProgramId(): string {
  const fromEnv = process.env.FIN_TOKEN_PROGRAM_ID?.trim();
  if (fromEnv) return fromEnv;
  const j = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "config", "deployed.token.json"), "utf8")
  ) as { varaTestnet: { finTokenProgramId: string } };
  return j.varaTestnet.finTokenProgramId;
}

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

const TIP_STEP = 1_000_000n;
let _tipSeq = 0n;

async function sendMint(
  api: GearApi,
  signer: any,
  programId: string,
  recipientHex: string,
  amount: bigint,
  gasLimit: bigint
): Promise<void> {
  const payload = {
    VftAdmin: {
      Mint: [recipientHex, amount.toString()]
    }
  };
  const tx = api.message.send(
    {
      destination: programId as `0x${string}`,
      payload,
      gasLimit,
      value: 0
    },
    undefined,
    undefined
  ) as any;

  const nonce = await (api.rpc as any).system.accountNextIndex(signer.address);
  _tipSeq += 1n;
  let tip: bigint;
  try {
    const pf = BigInt((await tx.paymentInfo(signer.address)).partialFee.toString());
    tip = pf + _tipSeq * TIP_STEP;
  } catch {
    tip = _tipSeq * TIP_STEP;
  }

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
}

async function main() {
  const recipientInput =
    process.argv[2]?.trim() ||
    process.env.FAUCET_TARGET_ADDRESS?.trim() ||
    DEFAULT_RECIPIENT;

  const mnemonic = process.env.FAUCET_MINTER_MNEMONIC?.trim();
  if (!mnemonic) {
    console.error(
      "Set FAUCET_MINTER_MNEMONIC in .env or services/testnet-faucet/.env (VftAdmin minter)."
    );
    process.exit(1);
  }

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const amount = BigInt(
    process.env.FAUCET_AMOUNT_BASE_UNITS ?? String(1_000n * 10n ** 12n)
  );
  const gasLimit = BigInt(process.env.FAUCET_GAS_LIMIT ?? "150000000000");

  let recipientHex: string;
  let recipientSs58: string;
  try {
    if (recipientInput.startsWith("0x") && recipientInput.length === 66) {
      recipientHex = recipientInput;
      recipientSs58 = encodeAddress(hexToU8a(recipientInput as `0x${string}`));
    } else {
      recipientSs58 = recipientInput;
      recipientHex = u8aToHex(decodeAddress(recipientInput));
    }
  } catch (e) {
    console.error("Invalid recipient address:", e);
    process.exit(1);
  }

  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const signer = keyring.addFromMnemonic(mnemonic);
  const programId = loadFinProgramId();

  console.log(JSON.stringify({
    msg: "faucet_to_address_start",
    endpoint,
    finProgramId: programId,
    recipientSs58,
    recipientHex,
    amountBaseUnits: amount.toString(),
    minter: signer.address
  }));

  let before: bigint;
  try {
    before = await readFinBalance(api, programId, recipientSs58);
  } catch (e) {
    console.error("Could not read balance before mint:", e);
    before = 0n;
  }
  console.log(
    `Balance before: ${formatFin(before, FIN_DECIMALS)} FIN (raw ${before})`
  );

  try {
    await sendMint(api, signer, programId, recipientHex, amount, gasLimit);
    console.log("Mint extrinsic completed (in block or finalized).");
  } catch (e) {
    console.error(JSON.stringify({ ok: false, step: "mint", error: String(e) }));
    await api.disconnect();
    process.exit(1);
  }

  let after = before;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      after = await readFinBalance(api, programId, recipientSs58);
      if (after > before) break;
    } catch (e) {
      console.warn("Balance read retry:", String(e));
    }
  }

  const delta = after - before;
  /** Mint is successful on-chain if recipient balance increased (polls RPC after tx). */
  const ok = after > before;

  console.log(
    `Balance after:  ${formatFin(after, FIN_DECIMALS)} FIN (raw ${after})`
  );
  console.log(`Delta: ${formatFin(delta, FIN_DECIMALS)} FIN (expected mint ${formatFin(amount, FIN_DECIMALS)} FIN)`);

  console.log(
    JSON.stringify({
      ok,
      success: ok,
      recipientSs58,
      before: before.toString(),
      after: after.toString(),
      delta: delta.toString(),
      mintAmount: amount.toString()
    })
  );

  await api.disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
