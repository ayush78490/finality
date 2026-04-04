/**
 * Sails handle message encoding: SCALE-encoded service name + method name + args.
 * Must match `sails-rs` dispatch (not `api.message.send` with plain JS objects).
 */
import type { GearApi } from "@gear-js/api";
import { compactAddLength, stringToU8a, u8aConcat, hexToU8a, u8aToHex } from "@polkadot/util";

export function scaleStr(v: string): Uint8Array {
  return compactAddLength(stringToU8a(v));
}

/**
 * Pass this to `api.tx.gear.sendMessage` as the payload argument.
 * Using a `0x…` hex string avoids rare `Uint8Array` → `Vec<u8>` encoding bugs (truncated payloads on-chain).
 */
export function gearPayloadHex(payload: Uint8Array): `0x${string}` {
  return u8aToHex(payload, -1, true) as `0x${string}`;
}

/** `Oracle.SubmitRound` — operator pushes price (i128 answer, feed decimals set at `AddAsset`). */
export function encodeOracleSubmitRound(
  api: GearApi,
  assetId: number,
  answer: bigint | string | number
): Uint8Array {
  return u8aConcat(
    scaleStr("Oracle"),
    scaleStr("SubmitRound"),
    api.registry.createType("u32", assetId).toU8a(),
    api.registry.createType("i128", answer).toU8a()
  );
}

/** `Oracle.AddAsset` — admin registers a feed symbol (e.g. `BTC`). */
export function encodeOracleAddAsset(
  api: GearApi,
  symbol: string,
  decimals: number,
  description: string
): Uint8Array {
  return u8aConcat(
    scaleStr("Oracle"),
    scaleStr("AddAsset"),
    api.registry.createType("String", symbol).toU8a(),
    api.registry.createType("u8", decimals).toU8a(),
    api.registry.createType("String", description).toU8a()
  );
}

/** `ActorId` in Sails matches 32-byte `AccountId` SCALE encoding. */
function actorIdU8a(api: GearApi, ss58OrHex: string): Uint8Array {
  const u8 = ss58OrHex.startsWith("0x")
    ? hexToU8a(ss58OrHex as `0x${string}`)
    : api.registry.createType("AccountId", ss58OrHex).toU8a();
  if (u8.length !== 32) {
    throw new Error(`encodeFinInit: expected 32-byte ActorId, got length ${u8.length}`);
  }
  return u8;
}

export function encodeFinInit(
  api: GearApi,
  adminSs58OrHex: string,
  roundSeconds: bigint,
  oracleSs58OrHex: string,
  maxOracleAgeSecs: bigint
): Uint8Array {
  return u8aConcat(
    scaleStr("Fin"),
    scaleStr("Init"),
    actorIdU8a(api, adminSs58OrHex),
    api.registry.createType("u64", roundSeconds).toU8a(),
    actorIdU8a(api, oracleSs58OrHex),
    api.registry.createType("u64", maxOracleAgeSecs).toU8a()
  );
}

/** `Fin.FaucetClaim()` — no args; program uses `msg::source()`. */
export function encodeFinFaucetClaim(): Uint8Array {
  return u8aConcat(scaleStr("Fin"), scaleStr("FaucetClaim"));
}

export function encodeFinRegisterAsset(
  api: GearApi,
  assetSymbol: string,
  assetId: number
): Uint8Array {
  return u8aConcat(
    scaleStr("Fin"),
    scaleStr("RegisterAsset"),
    api.registry.createType("String", assetSymbol).toU8a(),
    api.registry.createType("u32", assetId).toU8a()
  );
}

export function encodeVftApprove(
  api: GearApi,
  spenderProgramHex: string,
  amount: bigint
): Uint8Array {
  return u8aConcat(
    scaleStr("Vft"),
    scaleStr("Approve"),
    api.registry.createType("AccountId", spenderProgramHex).toU8a(),
    api.registry.createType("U256", amount).toU8a()
  );
}

export function encodeFinStartRound(
  api: GearApi,
  assetKey: string,
  seed: bigint,
  feeBps: number
): Uint8Array {
  return u8aConcat(
    scaleStr("Fin"),
    scaleStr("StartRound"),
    api.registry.createType("String", assetKey).toU8a(),
    api.registry.createType("u128", seed).toU8a(),
    api.registry.createType("u16", feeBps).toU8a()
  );
}

export function encodeFinSettleRound(api: GearApi, assetKey: string): Uint8Array {
  return u8aConcat(
    scaleStr("Fin"),
    scaleStr("SettleRound"),
    api.registry.createType("String", assetKey).toU8a()
  );
}

/** Payload that only succeeds gas simulation once `Fin.init` has committed on-chain. */
export function encodeFinSetPaused(api: GearApi, paused: boolean): Uint8Array {
  return u8aConcat(scaleStr("Fin"), scaleStr("SetPaused"), api.registry.createType("bool", paused).toU8a());
}

/** `Fin.GetFaucetInfo(user)` — Sails query payload (same SCALE prefix as handles). */
export function encodeFinGetFaucetInfo(api: GearApi, userSs58: string): Uint8Array {
  return u8aConcat(
    scaleStr("Fin"),
    scaleStr("GetFaucetInfo"),
    api.registry.createType("AccountId", userSs58).toU8a()
  );
}

/** Bytes to strip from `calculateReply` payload before decoding `FaucetInfo` body. */
export function finGetFaucetInfoReplyPrefixLen(): number {
  return scaleStr("Fin").length + scaleStr("GetFaucetInfo").length;
}

