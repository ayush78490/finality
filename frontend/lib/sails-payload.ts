import type { GearApi } from "@gear-js/api";
import { compactAddLength, stringToU8a, u8aConcat } from "@polkadot/util";

/** SCALE `String` prefix: compact length + UTF-8 (matches `sails-js` `stringToU8aWithPrefix`). */
export function stringToU8aWithPrefix(value: string): Uint8Array {
  return compactAddLength(stringToU8a(value));
}

/** `Vft.Approve(spender, value)` for extended VFT (handle message). */
export function encodeVftApprove(
  api: GearApi,
  marketProgramIdHex: string,
  amount: bigint
): Uint8Array {
  const a = stringToU8aWithPrefix("Vft");
  const b = stringToU8aWithPrefix("Approve");
  const spender = api.registry
    .createType("AccountId", marketProgramIdHex)
    .toU8a();
  const value = api.registry.createType("U256", amount).toU8a();
  return u8aConcat(a, b, spender, value);
}

/** `Fin.FaucetClaim()` — no arguments, the program uses msg::source(). */
export function encodeFinFaucetClaim(): Uint8Array {
  const a = stringToU8aWithPrefix("Fin");
  const b = stringToU8aWithPrefix("FaucetClaim");
  return u8aConcat(a, b);
}

/**
 * `Fin.BuySide(asset_key, side, fin_in, min_shares_out)` — handle message.
 * On-chain Rust uses `u128` for amounts (IDL may say u256).
 * `side`: 1 = UP, 0 = DOWN (see `programs/finality-market/app/src/lib.rs`).
 */
export function encodeFinBuySide(
  api: GearApi,
  assetKey: string,
  side: 0 | 1,
  finIn: bigint,
  minSharesOut: bigint
): Uint8Array {
  const a = stringToU8aWithPrefix("Fin");
  const b = stringToU8aWithPrefix("BuySide");
  const keyEnc = api.registry.createType("String", assetKey).toU8a();
  const sideEnc = api.registry.createType("u8", side).toU8a();
  const finEnc = api.registry.createType("u128", finIn).toU8a();
  const minEnc = api.registry.createType("u128", minSharesOut).toU8a();
  return u8aConcat(a, b, keyEnc, sideEnc, finEnc, minEnc);
}

/** `Fin.SettleRound(asset_key)` — anyone may call when round open and `now >= end_ts` (oracle must be fresh). */
export function encodeFinSettleRound(api: GearApi, assetKey: string): Uint8Array {
  return u8aConcat(
    stringToU8aWithPrefix("Fin"),
    stringToU8aWithPrefix("SettleRound"),
    api.registry.createType("String", assetKey).toU8a()
  );
}

/** `Fin.Claim(asset_key)` — winners redeem FIN after resolution. */
export function encodeFinClaim(api: GearApi, assetKey: string): Uint8Array {
  return u8aConcat(
    stringToU8aWithPrefix("Fin"),
    stringToU8aWithPrefix("Claim"),
    api.registry.createType("String", assetKey).toU8a()
  );
}

/** `Fin.SetPaused(paused)` — check if market is initialized by testing admin function */
export function encodeFinSetPaused(api: GearApi, paused: boolean): Uint8Array {
  return u8aConcat(
    stringToU8aWithPrefix("Fin"),
    stringToU8aWithPrefix("SetPaused"),
    api.registry.createType("bool", paused).toU8a()
  );
}

/** `Fin.ClaimSeed(asset_key)` — admin claims back their seed liquidity after settlement. */
export function encodeFinClaimSeed(api: GearApi, assetKey: string): Uint8Array {
  return u8aConcat(
    stringToU8aWithPrefix("Fin"),
    stringToU8aWithPrefix("ClaimSeed"),
    api.registry.createType("String", assetKey).toU8a()
  );
}

/** `Fin.GetPosition` query — same SCALE prefix as handles. */
export function encodeFinGetPosition(
  api: GearApi,
  assetKey: string,
  roundId: bigint,
  userSs58: string
): Uint8Array {
  return u8aConcat(
    stringToU8aWithPrefix("Fin"),
    stringToU8aWithPrefix("GetPosition"),
    api.registry.createType("String", assetKey).toU8a(),
    api.registry.createType("u64", roundId).toU8a(),
    api.registry.createType("AccountId", userSs58).toU8a()
  );
}

export function finGetPositionReplyPrefixLen(): number {
  return stringToU8aWithPrefix("Fin").length + stringToU8aWithPrefix("GetPosition").length;
}
