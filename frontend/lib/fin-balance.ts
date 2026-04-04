import type { GearApi } from "@gear-js/api";
import { ReplyCode, decodeAddress } from "@gear-js/api";
import { compactAddLength, stringToU8a, u8aConcat } from "@polkadot/util";
import { FIN_DECIMALS, FIN_PROGRAM_ID } from "./config";

/** Same as `sails-js` `stringToU8aWithPrefix` — SCALE `String` (compact length + UTF-8). */
function stringToU8aWithPrefix(value: string): Uint8Array {
  return compactAddLength(stringToU8a(value));
}

function encodeVftBalanceOfPayload(api: GearApi, accountSs58: string): {
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

/** Decode Sails reply body: try `u128`, `U256`, then `Compact<u128>`. */
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

/**
 * Reply is usually `Vft` + `BalanceOf` + balance bytes. If prefix stripping leaves nothing
 * (wrong `replyPrefixLen` for this runtime), fall back when the buffer is only balance.
 */
function decodeBalanceFromReplyPayload(
  api: GearApi,
  fullPayload: Uint8Array,
  replyPrefixLen: number
): bigint {
  const afterPrefix = fullPayload.slice(replyPrefixLen);
  if (afterPrefix.length > 0) {
    return decodeScaleBalance(api, afterPrefix);
  }
  if (fullPayload.length === 16 || fullPayload.length === 32) {
    return decodeScaleBalance(api, fullPayload);
  }
  return 0n;
}

/**
 * Read FIN balance via `Vft.BalanceOf` using `calculateReply`.
 *
 * **Important:** `payload` must be a `Uint8Array`. If you pass `Array.from(bytes)` (a plain array),
 * `encodePayload` mis-encodes and the program panics with an unexpected service error.
 */
export async function fetchFinBalance(
  api: GearApi,
  accountSs58: string,
  finProgramId: string = FIN_PROGRAM_ID
): Promise<{ formatted: string; raw: bigint }> {
  const { bytes, replyPrefixLen } = encodeVftBalanceOfPayload(api, accountSs58);

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
    throw new Error(code.asString);
  }

  const fullPayload = toU8(reply.payload);
  const raw = decodeBalanceFromReplyPayload(api, fullPayload, replyPrefixLen);

  return { raw, formatted: formatFin(raw, FIN_DECIMALS) };
}

function formatFin(base: bigint, decimals: number): string {
  const d = 10n ** BigInt(decimals);
  const whole = base / d;
  const frac = base % d;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
