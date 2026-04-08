import type { GearApi } from "@gear-js/api";
import BN from "bn.js";
import { FIN_PROGRAM_ID, MARKET_PROGRAM_ID } from "./config";
import {
  encodeFinRegisterAsset,
  encodeFinStartRound,
  encodeOracleAddAsset,
  encodeOracleSubmitRound,
  encodeVftApprove,
} from "./sails-payload";
import { finHumanToBaseUnits } from "./trade-submit";

type AdminMarketParams = {
  api: GearApi;
  account: string;
  diaSymbol: string;
  assetKey: string;
  assetId: number;
  seedFinHuman: string;
  feeBps: number;
  initialAnswer?: bigint;
};

let cachedInjector: { address: string; signer: any; nonce: BN } | null = null;

async function getInjector() {
  if (cachedInjector) {
    return cachedInjector;
  }
  const { web3Enable, web3Accounts, web3FromSource } = await import("@polkadot/extension-dapp");
  await web3Enable("Finality");
  const all = await web3Accounts();
  
  if (all.length === 0) {
    throw new Error("No accounts found in extension. Please connect your wallet.");
  }
  
  const acc = all[0];
  const injector = await web3FromSource(acc.meta.source);
  if (!injector?.signer) {
    throw new Error("Extension signer not available.");
  }
  cachedInjector = { address: acc.address, signer: injector.signer, nonce: new BN(-1) };
  return cachedInjector;
}

async function sendMessage(
  api: GearApi,
  destination: `0x${string}`,
  payload: Uint8Array,
  label: string,
  gasLimit: bigint = 150_000_000_000n
): Promise<void> {
  await api.isReady;
  const injector = await getInjector();
  
  let nonce = injector.nonce.clone();
  if (nonce.toNumber() < 0) {
    nonce = await (api.rpc as any).system.accountNextIndex(injector.address);
  }
  injector.nonce = nonce.addn(1);
  
  const tx = api.message.send(
    { destination, payload, gasLimit, value: 0 },
    undefined,
    undefined
  ) as any;

  await new Promise<void>((resolve, reject) => {
    (tx as any)
      .signAndSend(
        injector.address,
        { signer: injector.signer, nonce },
        (result: any) => {
          const { status, dispatchError } = result;
          if (dispatchError) {
            reject(new Error(`${label}: ${dispatchError.toString()}`));
            return;
          }
          if (status?.isInBlock || status?.isFinalized) resolve();
        }
      )
      .catch((e: unknown) => reject(e));
  });
}

export async function createOnChainMarket(params: AdminMarketParams): Promise<void> {
  const { api, account, diaSymbol, assetKey, assetId, seedFinHuman, feeBps, initialAnswer = 100_000_000n } = params;

  if (!MARKET_PROGRAM_ID) throw new Error("Market program id is not configured.");
  if (!FIN_PROGRAM_ID) throw new Error("FIN program id is not configured.");

  const seed = finHumanToBaseUnits(seedFinHuman);
  const approveAmount = seed * 2n;

  await sendMessage(api, MARKET_PROGRAM_ID as `0x${string}`, encodeOracleAddAsset(api, diaSymbol, 8, assetKey), `Oracle.AddAsset(${diaSymbol})`);
  await sendMessage(api, MARKET_PROGRAM_ID as `0x${string}`, encodeOracleSubmitRound(api, assetId, initialAnswer), `Oracle.SubmitRound(${assetId})`);
  await sendMessage(api, MARKET_PROGRAM_ID as `0x${string}`, encodeFinRegisterAsset(api, assetKey, assetId), `Fin.RegisterAsset(${assetKey})`);
  await sendMessage(api, FIN_PROGRAM_ID as `0x${string}`, encodeVftApprove(api, MARKET_PROGRAM_ID, approveAmount), "Vft.Approve(seed)");
  await sendMessage(api, MARKET_PROGRAM_ID as `0x${string}`, encodeFinStartRound(api, assetKey, seed, feeBps), `Fin.StartRound(${assetKey})`);
}
