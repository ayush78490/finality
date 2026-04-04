/**
 * Read-only `Fin.GetPosition(asset_key, round_id, user)` via `calculateReply`.
 */
import type { GearApi } from "@gear-js/api";
import { ReplyCode } from "@gear-js/api";
import { TypeRegistry } from "@polkadot/types/create/registry";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import {
  encodeFinGetPosition,
  finGetPositionReplyPrefixLen
} from "./sails-payload";

async function readOrigin(preferred: string | null): Promise<string> {
  if (preferred) return preferred;
  await cryptoWaitReady();
  const { createVaraKeyring } = await import("./vara-keyring");
  return createVaraKeyring().addFromUri("//Alice").address;
}

const posReg = new TypeRegistry();
posReg.register({
  UserPosition: {
    shares_up: "u128",
    shares_down: "u128"
  }
});

export type UserPositionSnap = {
  sharesUp: bigint;
  sharesDown: bigint;
};

export async function fetchUserPosition(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  roundId: string,
  userSs58: string,
  originAccount: string | null
): Promise<UserPositionSnap> {
  const origin = await readOrigin(originAccount);
  const rid = BigInt(roundId);
  const payload = encodeFinGetPosition(api, assetKey, rid, userSs58);
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0
    },
    undefined,
    undefined
  );

  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
  const body = raw.subarray(finGetPositionReplyPrefixLen());

  if (!code.isSuccess) {
    throw new Error(code.asString ?? "GetPosition failed");
  }

  const p = posReg.createType("UserPosition", body);
  const j = p.toJSON() as unknown as Record<string, string | number>;
  const su = j.shares_up ?? j.sharesUp;
  const sd = j.shares_down ?? j.sharesDown;
  return {
    sharesUp: BigInt(su ?? "0"),
    sharesDown: BigInt(sd ?? "0")
  };
}
