import type { GearApi } from "@gear-js/api";
import { MARKET_PROGRAM_ID } from "./config";
import { encodeFinFaucetClaim } from "./sails-payload";

/**
 * Fin.FaucetClaim is async (market → VFT Transfer + wait for reply). A fixed 100e9 gas is often too low:
 * the extrinsic can land in a block while the program runs out of gas, so the UI looks “success”
 * but no FIN moves. Use calculateGas.handle when possible, cap at block gas limit (Gear validates this).
 */
async function resolveFaucetGasLimit(
  api: GearApi,
  account: string,
  destination: string,
  payload: Uint8Array
): Promise<bigint> {
  const cap = api.blockGasLimit.toBigInt();
  const source = api.registry.createType("AccountId", account).toHex();
  try {
    const info = await api.program.calculateGas.handle(
      source as `0x${string}`,
      destination as `0x${string}`,
      payload,
      0,
      true
    );
    const min = info.min_limit.toBigInt();
    const withHeadroom = (min * 115n) / 100n;
    return withHeadroom > cap ? cap : withHeadroom;
  } catch {
    return cap;
  }
}

let _tipCounter = 0n;

async function getInjector(accountSs58: string) {
  const { web3Enable, web3Accounts, web3FromSource } = await import(
    "@polkadot/extension-dapp"
  );
  await web3Enable("Finality");
  const all = await web3Accounts();
  const acc = all.find((a) => a.address === accountSs58);
  if (!acc) throw new Error("Account not found in wallet extension.");
  const injector = await web3FromSource(acc.meta.source);
  if (!injector?.signer) throw new Error("Extension signer not available.");
  return { address: acc.address, signer: injector.signer };
}

async function sendMessage(
  api: GearApi,
  programId: `0x${string}`,
  account: string,
  payload: Uint8Array,
  label: string
): Promise<void> {
  await api.isReady;
  const { address, signer } = await getInjector(account);

  const gasLimit = await resolveFaucetGasLimit(api, address, programId, payload);

  const tx = api.message.send(
    { destination: programId, payload, gasLimit, value: 0 },
    undefined,
    undefined
  ) as any;

  const nonce = await (api.rpc as any).system.accountNextIndex(address);
  _tipCounter += 1n;

  const genesisHash = await api.rpc.chain.getBlockHash(0);
  const era = api.registry.createType("ExtrinsicEra", "0x00");

  const signerPayload = api.registry.createType("SignerPayload", {
    address,
    blockHash: genesisHash,
    blockNumber: api.registry.createType("BlockNumber", 0),
    era,
    genesisHash,
    method: tx.method,
    nonce,
    runtimeVersion: api.runtimeVersion,
    signedExtensions: api.registry.signedExtensions,
    tip: api.registry.createType("Compact<Balance>", _tipCounter),
    version: tx.version,
  });

  const { id: signerId, signature } = await (signer as any).signPayload(
    signerPayload.toPayload()
  );
  tx.addSignature(address, signature, signerPayload.toPayload());

  await new Promise<void>((resolve, reject) => {
    tx.send((result: any) => {
      const { status, dispatchError } = result;
      if (signerId !== undefined && typeof (signer as any).update === "function") {
        try { (signer as any).update(signerId, status); } catch { /* ignore */ }
      }
      if (dispatchError) {
        if (dispatchError.isModule) {
          try {
            const meta = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${label}: ${meta.section}.${meta.name} — ${meta.docs.join(" ")}`));
          } catch {
            reject(new Error(`${label}: ${dispatchError.toString()}`));
          }
        } else {
          reject(new Error(`${label}: ${dispatchError.toString()}`));
        }
        return;
      }
      if (status?.isInBlock || status?.isFinalized) resolve();
    }).catch(reject);
  });
}

export async function submitFaucetClaim(params: {
  api: GearApi;
  account: string;
}): Promise<void> {
  const { api, account } = params;
  if (!MARKET_PROGRAM_ID) {
    throw new Error("NEXT_PUBLIC_MARKET_PROGRAM_ID is not set.");
  }

  const payload = encodeFinFaucetClaim();

  const attempt = async () => {
    await sendMessage(
      api,
      MARKET_PROGRAM_ID as `0x${string}`,
      account,
      payload,
      "Faucet claim"
    );
  };

  try {
    await attempt();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("1010")) {
      await new Promise((r) => setTimeout(r, 2000));
      await attempt();
      return;
    }
    throw err;
  }
}
