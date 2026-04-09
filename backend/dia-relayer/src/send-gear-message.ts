import type { GearApi } from "@gear-js/api";
import { gearPayloadHex } from "./sails-scale.js";
import { initialTip, parsePoolPriority, tipToBeat } from "./tip.js";

function parseGasLimit(api: GearApi, simulated: bigint): bigint {
  const blockCap = api.blockGasLimit.toBigInt();
  const minFloor = BigInt(process.env.GEAR_HANDLE_MIN_GAS ?? "250000000000");
  const useBlockGas =
    process.env.GEAR_USE_BLOCK_GAS === undefined ||
    process.env.GEAR_USE_BLOCK_GAS === "1" ||
    process.env.GEAR_USE_BLOCK_GAS?.toLowerCase() === "true";

  if (useBlockGas) return blockCap;
  const floored = simulated > minFloor ? simulated : minFloor;
  return floored > blockCap ? blockCap : floored;
}

function hasGearDispatchFailure(events: any[]): string | null {
  for (const { event } of events ?? []) {
    if (event.section !== "gear" || event.method !== "MessagesDispatched") continue;
    const text = JSON.stringify(
      (event as any).data?.toHuman?.() ?? (event as any).data?.toString?.() ?? ""
    );
    if (/Failed|Failure|NotExecuted|Trap|panic|OutOfGas|ExecutionError/i.test(text)) {
      return text;
    }
  }
  return null;
}

function txTimeoutMs(): number {
  const raw = process.env.GEAR_TX_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 90_000;
}

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
    const withHeadroom = (info.min_limit.toBigInt() * 11n) / 10n;
    gasLimit = parseGasLimit(api, withHeadroom);
  } catch {
    gasLimit = parseGasLimit(api, 500_000_000_000n);
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
        let done = false;
        let unsubscribe: (() => void) | null = null;
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          try { unsubscribe?.(); } catch { /* noop */ }
          reject(new Error(`gear_send_timeout_${txTimeoutMs()}ms`));
        }, txTimeoutMs());

        const finishResolve = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { unsubscribe?.(); } catch { /* noop */ }
          resolve();
        };

        const finishReject = (err: unknown) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { unsubscribe?.(); } catch { /* noop */ }
          reject(err instanceof Error ? err : new Error(String(err)));
        };

        tx.signAndSend(signer, { nonce, tip } as any, ({ status, dispatchError, events }: any) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const meta = api.registry.findMetaError(dispatchError.asModule);
              finishReject(new Error(`${meta.section}.${meta.name}: ${meta.docs.join(" ")}`));
            } else {
              finishReject(new Error(dispatchError.toString()));
            }
            return;
          }
          if (status?.isFinalized) {
            const messageFailure = hasGearDispatchFailure(events ?? []);
            if (messageFailure) {
              finishReject(new Error(`Gear message dispatch failed: ${messageFailure}`));
              return;
            }
            finishResolve();
          }
        })
          .then((unsub: unknown) => {
            if (typeof unsub === "function") unsubscribe = unsub as () => void;
          })
          .catch(finishReject);
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
