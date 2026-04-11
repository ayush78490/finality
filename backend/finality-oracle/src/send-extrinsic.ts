import type { GearApi } from "@gear-js/api";
import { initialTip, parsePoolPriority, tipToBeat } from "./tip.js";

function logGearDispatchEvents(events: any[]) {
  if (!events?.length) {
    console.log(JSON.stringify({ level: "warn", msg: "signAndSend_no_events" }));
    return;
  }
  for (const { event } of events) {
    if (event.section === "gear" && event.method === "MessagesDispatched") {
      const human = (event as any).data?.toHuman?.() ?? (event as any).data?.toString?.();
      console.log(JSON.stringify({ level: "info", msg: "gear_MessagesDispatched", data: human }));
    }
  }
}

/** Sign & send; waits for finalized; logs gear events. */
export async function sendExtrinsic(api: GearApi, tx: any, signer: any) {
  let tip = await initialTip(tx, signer.address);
  let partialFee = 0n;
  try {
    partialFee = BigInt((await tx.paymentInfo(signer.address)).partialFee.toString());
  } catch {
    /* ignore */
  }

  const maxAttempts = 4;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const nonce = await (api.rpc as any).system.accountNextIndex(signer.address);
    try {
      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(signer, { nonce, tip } as any, (result: any) => {
          const { status, dispatchError } = result;
          const events = result.events ?? [];
          if (dispatchError) {
            if (dispatchError.isModule) {
              const meta = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${meta.section}.${meta.name}: ${meta.docs.join(" ")}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
            return;
          }
          if (status?.isFinalized) {
            for (const { event } of events) {
              if (event.section === "gear") {
                console.log(
                  JSON.stringify({
                    level: "info",
                    msg: "gear_event",
                    method: event.method,
                    data: (event as any).data?.toHuman?.() ?? String((event as any).data)
                  })
                );
              }
            }
            logGearDispatchEvents(events);
            resolve();
          }
        }).catch(reject);
      });
      return;
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/1014|Priority is too low/i.test(msg) && attempt < maxAttempts - 1) {
        const pp = parsePoolPriority(msg);
        tip = pp !== null ? tipToBeat(pp, partialFee) : tip * 2n + 1_000_000n;
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
