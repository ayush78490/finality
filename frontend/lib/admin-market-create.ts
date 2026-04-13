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

type OutboundMessage = {
  destination: `0x${string}`;
  payload: Uint8Array;
  label: string;
  gasLimit?: bigint;
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

async function sendBatchMessages(
  api: GearApi,
  messages: OutboundMessage[],
  batchLabel: string,
  defaultGasLimit: bigint = 150_000_000_000n
): Promise<void> {
  await api.isReady;
  const injector = await getInjector();

  let nonce = injector.nonce.clone();
  if (nonce.toNumber() < 0) {
    nonce = await (api.rpc as any).system.accountNextIndex(injector.address);
  }
  injector.nonce = nonce.addn(1);

  const utility = (api.tx as any).utility;
  if (!utility?.batchAll) {
    for (const m of messages) {
      await sendMessage(api, m.destination, m.payload, m.label, m.gasLimit ?? defaultGasLimit);
    }
    return;
  }

  const calls = messages.map((m) =>
    api.message.send(
      {
        destination: m.destination,
        payload: m.payload,
        gasLimit: m.gasLimit ?? defaultGasLimit,
        value: 0,
      },
      undefined,
      undefined
    )
  );

  const tx = utility.batchAll(calls);
  await new Promise<void>((resolve, reject) => {
    (tx as any)
      .signAndSend(
        injector.address,
        { signer: injector.signer, nonce },
        (result: any) => {
          const { status, dispatchError, events } = result;

          if (dispatchError) {
            reject(new Error(`${batchLabel}: ${dispatchError.toString()}`));
            return;
          }

          // batchAll should fail atomically, but this event check provides explicit diagnostics.
          for (const record of events ?? []) {
            const evt = record?.event;
            if (evt?.section === "utility" && evt?.method === "BatchInterrupted") {
              const idx = evt.data?.[0]?.toString?.() ?? "?";
              reject(new Error(`${batchLabel}: batch interrupted at call #${idx}`));
              return;
            }
          }

          if (status?.isInBlock || status?.isFinalized) {
            resolve();
          }
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

  await sendBatchMessages(
    api,
    [
      {
        destination: MARKET_PROGRAM_ID as `0x${string}`,
        payload: encodeOracleAddAsset(api, diaSymbol, 8, assetKey),
        label: `Oracle.AddAsset(${diaSymbol})`,
      },
      {
        destination: MARKET_PROGRAM_ID as `0x${string}`,
        payload: encodeOracleSubmitRound(api, assetId, initialAnswer),
        label: `Oracle.SubmitRound(${assetId})`,
      },
      {
        destination: MARKET_PROGRAM_ID as `0x${string}`,
        payload: encodeFinRegisterAsset(api, assetKey, assetId),
        label: `Fin.RegisterAsset(${assetKey})`,
      },
      {
        destination: FIN_PROGRAM_ID as `0x${string}`,
        payload: encodeVftApprove(api, MARKET_PROGRAM_ID, approveAmount),
        label: "Vft.Approve(seed)",
      },
      {
        destination: MARKET_PROGRAM_ID as `0x${string}`,
        payload: encodeFinStartRound(api, assetKey, seed, feeBps),
        label: `Fin.StartRound(${assetKey})`,
      },
    ],
    `CreateMarket(${assetKey})`
  );
}
