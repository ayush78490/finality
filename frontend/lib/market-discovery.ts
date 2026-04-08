import type { GearApi } from "@gear-js/api";
import { ReplyCode } from "@gear-js/api";
import { TypeRegistry } from "@polkadot/types/create/registry";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import {
  encodeFinListAssets,
  finListAssetsReplyPrefixLen,
} from "./sails-payload";
import { mergeMarketsWithAssetKeys, type MarketMeta } from "./markets";

async function readOrigin(preferred: string | null): Promise<string> {
  if (preferred) return preferred;
  await cryptoWaitReady();
  const { createVaraKeyring } = await import("./vara-keyring");
  return createVaraKeyring().addFromUri("//Alice").address;
}

export async function fetchOnChainAssetKeys(
  api: GearApi,
  marketProgramId: string,
  originAccount: string | null
): Promise<string[]> {
  const origin = await readOrigin(originAccount);
  const payload = encodeFinListAssets();
  const reply = await api.message.calculateReply(
    {
      origin,
      destination: marketProgramId,
      payload,
      value: 0,
    },
    undefined,
    undefined
  );

  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  if (!code.isSuccess) {
    throw new Error(code.asString ?? "Fin.ListAssets failed");
  }

  const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
  const body = raw.subarray(finListAssetsReplyPrefixLen());
  const reg = new TypeRegistry();
  const vec = reg.createType("Vec<String>", body);
  const rows = vec.toJSON() as unknown as string[];
  return Array.isArray(rows) ? rows.filter((v) => typeof v === "string") : [];
}

export async function fetchTradableMarkets(
  api: GearApi,
  marketProgramId: string,
  originAccount: string | null
): Promise<MarketMeta[]> {
  const keys = await fetchOnChainAssetKeys(api, marketProgramId, originAccount);
  return mergeMarketsWithAssetKeys(keys);
}
