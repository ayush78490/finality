import type { GearApi } from "@gear-js/api";
import { gearPayloadHex } from "./sails-scale.js";
import { initialTip, parsePoolPriority, tipToBeat } from "./tip.js";

/** Send a `gear.sendMessage` extrinsic, retrying on 1014 with an escalating tip. */
export async function sendGearMessage(
  api: GearApi,
  dest: string,
  payload: Uint8Array,
  signer: any
): Promise<void> {
  const source = api.registry.createType("AccountId", signer.address).toHex();
  let gasLimit: bigint;
  try {
    const info = await api.program.calculateGas.handle(
      source as `0x${string}`,
      dest as `0x${string}`,
      payload,
      0,
      true
    );
    gasLimit = (info.min_limit.toBigInt() * 11n) / 10n;
  } catch {
    gasLimit = 500_000_000_000n;
  }

  // Compute partialFee once for tip calculations.
  const sampleTx = api.tx.gear.sendMessage(dest as `0x${string}`, gearPayloadHex(payload), gasLimit, 0, true);
  let partialFee = 0n;
  try {
    const info = await sampleTx.paymentInfo(signer.address);
    partialFee = BigInt(info.partialFee.toString());
  } catch { /* use 0 fallback */ }

  let tip = await initialTip(sampleTx, signer.address);

  const maxAttempts = 4;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tx = api.tx.gear.sendMessage(dest as `0x${string}`, gearPayloadHex(payload), gasLimit, 0, true);
    const nonce = await (api.rpc as any).system.accountNextIndex(signer.address);

    try {
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
      return; // success
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/1014|Priority is too low/i.test(msg) && attempt < maxAttempts - 1) {
        const poolPriority = parsePoolPriority(msg);
        tip = poolPriority !== null
          ? tipToBeat(poolPriority, partialFee)
          : tip * 2n + 1_000_000n;
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
