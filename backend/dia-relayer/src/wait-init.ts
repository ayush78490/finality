import type { GearApi } from "@gear-js/api";
import { encodeFinSetPaused } from "./sails-scale.js";

/**
 * After `Fin.init` is included in a block, async message processing may lag.
 * Poll until we can gas-simulate admin `SetPaused(false)` (needs init + admin),
 * or a second `Fin.init` fails with `already initialized`.
 */
export async function waitUntilMarketInitialized(
  api: GearApi,
  marketId: string,
  adminActorHex: string,
  initPayload: Uint8Array,
  opts?: { maxAttempts?: number; intervalMs?: number; initialDelayMs?: number }
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? 180;
  const intervalMs = opts?.intervalMs ?? 1000;
  const initialDelayMs = opts?.initialDelayMs ?? 4000;
  const admin = adminActorHex as `0x${string}`;
  const dest = marketId as `0x${string}`;
  const setPausedPayload = encodeFinSetPaused(api, false);

  if (initialDelayMs > 0) {
    await new Promise((r) => setTimeout(r, initialDelayMs));
  }

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await api.program.calculateGas.handle(admin, dest, setPausedPayload, 0, true);
      return;
    } catch {
      /* not initialized or not admin — try Init probe */
    }
    try {
      await api.program.calculateGas.handle(admin, dest, initPayload, 0, true);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes("already initialized")) {
        return;
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Market program did not become initialized within ${maxAttempts * intervalMs}ms — ` +
      "verify Fin.init on-chain (message may have failed or program id / WASM mismatch)."
  );
}
