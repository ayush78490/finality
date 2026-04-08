import type { GearApi } from "@gear-js/api";
import { ReplyCode } from "@gear-js/api";
import { hexToU8a } from "@polkadot/util";
import { TypeRegistry } from "@polkadot/types";
import { FIN_DECIMALS, FIN_PROGRAM_ID, MARKET_PROGRAM_ID } from "./config";
import {
  encodeFinBuySide,
  encodeFinClaim,
  encodeFinClaimSeed,
  encodeFinSettleRound,
  encodeVftApprove,
  stringToU8aWithPrefix
} from "./sails-payload";
import { recordTradedMarket } from "./traded-markets";

/** SS58 → `0x` + 32-byte AccountId. RPC `gear.calculateGasForHandle` expects `source: H256`, not SS58. */
function accountToActorHex(api: GearApi, ss58: string): `0x${string}` {
  return api.registry.createType("AccountId", ss58).toHex() as `0x${string}`;
}

export function finHumanToBaseUnits(human: string): bigint {
  const cleaned = human.trim().replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Enter a positive FIN amount.");
  }
  const scaled = BigInt(Math.floor(n * 10 ** FIN_DECIMALS));
  if (scaled <= 0n) throw new Error("Amount too small.");
  return scaled;
}

/** Cached injector for the current session to avoid repeated wallet lookups. */
let cachedInjector: { address: string; signer: any } | null = null;

async function getInjector(accountSs58: string) {
  if (cachedInjector?.address === accountSs58) {
    return cachedInjector;
  }
  // Dynamic import keeps @polkadot/extension-dapp out of the SSR bundle
  // (it accesses `window` at module evaluation time).
  const { web3Enable, web3Accounts, web3FromSource } = await import(
    "@polkadot/extension-dapp"
  );
  await web3Enable("Finality");
  const all = await web3Accounts();
  const acc = all.find((a) => a.address === accountSs58);
  if (!acc) {
    throw new Error("Connected account not found in the extension. Reconnect your wallet.");
  }
  const injector = await web3FromSource(acc.meta.source);
  if (!injector?.signer) {
    throw new Error("Extension signer not available.");
  }
  cachedInjector = { address: acc.address, signer: injector.signer };
  return cachedInjector;
}

/** Rust `Result::Err(String)` / panic message bytes are often SCALE `String`. */
function decodeErrPayload(payloadHex: string): string {
  const raw = hexToU8a(payloadHex);
  const reg = new TypeRegistry();
  try {
    return reg.createType("String", raw).toString();
  } catch {
    return raw.length ? new TextDecoder().decode(raw) : "Unknown program error";
  }
}

/** Maps runtime dispatch errors to short, actionable UI text. */
function friendlyDispatchError(label: string, fullMessage: string): string {
  const m = fullMessage;
  if (
    m.includes("gearBank.InsufficientBalance") ||
    (m.includes("gearBank") && m.includes("InsufficientBalance"))
  ) {
    return `${label}: Not enough native VARA (TVARA on testnet) to pay fees for this transaction. Top up the same wallet in SubWallet — FIN balance and VARA balance are different. Use an official Vara testnet VARA faucet (e.g. from Gear IDEA or the Vara docs); the in-app “FIN faucet” only mints FIN, not VARA.`;
  }
  return fullMessage;
}

function friendlyProgramError(panic: string): string {
  const m = panic.trim();
  if (!m) return "Program rejected the message (empty error).";

  if (m.includes("unknown asset")) {
    return "This asset is not registered on the market. Run bootstrap / register_asset for this feed.";
  }
  if (m.includes("no round")) {
    return "No round exists for this market yet. An admin must call Fin.start_round (after register_asset) to seed liquidity.";
  }
  if (m.includes("not open")) {
    return "The round is not open (locked or settled).";
  }
  if (m.includes("round ended")) {
    return "This round’s trading window has ended.";
  }
  if (m.includes("no liquidity")) {
    return "No AMM liquidity (pool reserves are zero).";
  }
  if (m.includes("transfer_from failed")) {
    return "FIN did not move: ensure you have enough FIN in the wallet and the approval step succeeded.";
  }
  if (m.includes("no oracle tick")) {
    return "Oracle has no price feed yet — wait for the relayer to push prices.";
  }
  if (m.includes("slippage")) {
    return "Slippage: lower “Min. shares” to 0 for testing, or increase trade size.";
  }
  if (m.includes("fee eats input")) {
    return "Amount is too small after fees — try a larger FIN amount.";
  }
  if (m.includes("bad amount")) {
    return "Invalid FIN amount.";
  }
  if (m.includes("bad side")) {
    return "Invalid side (internal encoding).";
  }
  if (m.includes("Not initialized") || m.includes("initialized")) {
    return "Market program is not initialized.";
  }
  if (m.includes("Unexpected service")) {
    return "Wrong message encoding for this program — use the web app or relayer with Sails SCALE payloads. In Gear IDEA, add the Sails IDL (cargo sails idl) under “Add metadata/sails”.";
  }
  if (m.includes("paused")) {
    return "Market program is paused.";
  }
  if (m.includes("too early")) {
    return "Settlement: wait until the round end time has passed.";
  }
  if (m.includes("stale oracle")) {
    return "Oracle price is too old for settlement. Push a fresh Oracle.submit_round (relayer), then try again.";
  }
  if (m.includes("not resolved")) {
    return "Round is not resolved yet — settle the round first.";
  }
  if (m.includes("no winning shares")) {
    return "You have no winning shares for this round.";
  }
  if (m.includes("already claimed")) {
    return "You already claimed for this round.";
  }
  if (m.includes("nothing to claim")) {
    return "Nothing left to claim from the pool.";
  }
  if (m.includes("payout zero")) {
    return "Claim payout rounds to zero.";
  }

  return m;
}

const GAS_FALLBACK = 100_000_000_000n;
/** `Fin.Claim` awaits VFT transfer reply — needs a higher cap than `BuySide`. */
const CLAIM_GAS_FALLBACK = 250_000_000_000n;

/**
 * Dry-run `Fin.Claim` via `calculateReply` (read-only, no wallet needed).
 * Returns the error string from the program, or null if the claim would succeed.
 * Also returns the simulated gas so we can use it for the real tx.
 */
async function preflightClaim(
  api: GearApi,
  programId: string,
  account: string,
  assetKey: string
): Promise<{ errorMsg: string | null; gasLimit: bigint }> {
  await api.isReady;
  const originHex = accountToActorHex(api, account);
  const destHex = programId as `0x${string}`;
  const payload = encodeFinClaim(api, assetKey);
  const prefixLen = stringToU8aWithPrefix("Fin").length + stringToU8aWithPrefix("Claim").length;

  // 1. calculateReply — checks program logic without submitting a tx.
  try {
    const reply = await api.message.calculateReply(
      { origin: originHex, destination: destHex, payload, value: 0 },
      undefined,
      undefined
    );
    const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
    if (!code.isSuccess) {
      // Try to decode the error string from the reply body.
      const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
      const body = raw.subarray(prefixLen);
      const reg = new TypeRegistry();
      let msg = code.asString ?? "Claim simulation failed";
      try {
        // Gear Sails Result::Err encodes as: 0x01 (Err variant) + SCALE String
        if (body.length > 1 && body[0] === 1) {
          msg = reg.createType("String", body.subarray(1)).toString();
        } else {
          msg = reg.createType("String", body).toString() || msg;
        }
      } catch { /* use code.asString */ }
      return { errorMsg: friendlyProgramError(msg), gasLimit: CLAIM_GAS_FALLBACK };
    }
  } catch (e: unknown) {
    // If calculateReply itself fails (e.g. network error), fall through and let the real tx surface the error.
    console.warn("[claim preflight] calculateReply failed:", e);
  }

  // 2. calculateGas — get accurate gas for the real tx.
  let gasLimit = CLAIM_GAS_FALLBACK;
  try {
    const info = await api.program.calculateGas.handle(
      originHex,
      destHex,
      payload,
      0,
      true
    );
    // Add 20% headroom; claim transfers FIN so continuations add extra gas cost.
    gasLimit = (info.min_limit.toBigInt() * 12n) / 10n;
    if (gasLimit < CLAIM_GAS_FALLBACK) gasLimit = CLAIM_GAS_FALLBACK;
  } catch {
    /* use fallback */
  }

  return { errorMsg: null, gasLimit };
}

/**
 * Parse the pool's existing priority from a 1014 error message.
 * Format from Substrate: "Priority is too low: (POOL_PRIORITY vs OUR_PRIORITY)"
 * The FIRST number is the stuck tx's priority we must exceed.
 */
function parsePoolPriority(msg: string): bigint | null {
  const m = msg.match(/\((\d+)\s+vs\s+(\d+)\)/);
  if (!m) return null;
  const a = BigInt(m[1]);
  const b = BigInt(m[2]);
  return a > b ? a : b; // larger of the two is the pool's priority
}

/**
 * Compute the tip that beats `poolPriority`.
 * On Substrate: priority = partialFee + tip, so tip = poolPriority - partialFee + buffer.
 * If poolPriority ≤ partialFee (shouldn't happen) fall back to a fixed bump.
 */
function tipToBeat(poolPriority: bigint, partialFee: bigint): bigint {
  const BUFFER = 1_000_000n; // 1 000 000 planck safety margin
  return poolPriority > partialFee
    ? poolPriority - partialFee + BUFFER
    : partialFee + BUFFER;
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

/**
 * Submits `gear.sendMessage` via polkadot.js `signAndSend` (not manual signer.signPayload).
 * Manual SignerPayload + addSignature often diverges from what the node validates → 1010.
 * Immortal era + explicit genesis blockHash (required when `era` is set).
 *
 * Retries are limited (max 3) so SubWallet does not open dozens of popups.
 */
async function sendMessageWithReply(
  api: GearApi,
  programId: `0x${string}`,
  account: string,
  payload: Uint8Array,
  label: string,
  gasLimit: bigint = GAS_FALLBACK
): Promise<{ txHash: string; inBlockHash: string; finalizedHash: string }> {
  await api.isReady;
  const { address, signer } = await getInjector(account);

  let tipBn = 1_000_000n;
  const maxAttempts = 3;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tx = api.message.send(
      { destination: programId, payload, gasLimit, value: 0 },
      undefined,
      undefined
    ) as any;

    // Always fetch a fresh nonce before each attempt so retries don't re-use a stale one.
    const nonce = await (api.rpc as any).system.accountNextIndex(address);

    try {
      const receipt = await new Promise<{ txHash: string; inBlockHash: string; finalizedHash: string }>((resolve, reject) => {
        let seenInBlockHash = "";
        // Use default mortal era (no era/blockHash override).
        // Immortal era (0x00) + genesisHash caused 1010 "outdated" rejections from the node
        // because the extension signer and the node disagreed on the expected block reference.
        (tx as any).signAndSend(
          address,
          {
            signer,
            nonce,
            tip: tipBn,
          },
          (result: any) => {
            const { status, dispatchError, events } = result;
            if (dispatchError) {
              if (dispatchError.isModule) {
                try {
                  const meta = api.registry.findMetaError(dispatchError.asModule);
                  const raw = `${label}: ${meta.section}.${meta.name} — ${meta.docs.join(" ")}`;
                  reject(new Error(friendlyDispatchError(label, raw)));
                } catch {
                  const raw = `${label}: ${dispatchError.toString()}`;
                  reject(new Error(friendlyDispatchError(label, raw)));
                }
              } else {
                const raw = `${label}: ${dispatchError.toString()}`;
                reject(new Error(friendlyDispatchError(label, raw)));
              }
              return;
            }
            if (status?.isInBlock) {
              seenInBlockHash = status.asInBlock?.toHex?.() ?? seenInBlockHash;
            }
            if (status?.isFinalized) {
              const messageFailure = hasGearDispatchFailure(events ?? []);
              if (messageFailure) {
                reject(new Error(friendlyProgramError(messageFailure)));
                return;
              }
              const txHash = (tx as any)?.hash?.toHex?.() ?? "";
              const finalizedHash = status?.asFinalized?.toHex?.() ?? "";
              const inBlockHash = seenInBlockHash || finalizedHash;
              resolve({ txHash, inBlockHash, finalizedHash });
            }
          }
        ).catch(reject);
      });
      return receipt;
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);

      if (attempt >= maxAttempts - 1) throw err;

      if (/1014|Priority is too low/i.test(msg)) {
        tipBn = tipBn * 2n + 1_000_000n;
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      if (/1010|outdated/i.test(msg)) {
        // Wait one block (~2s on Vara) before re-fetching nonce and retrying.
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      throw err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Approve FIN for the market program, then `Fin.BuySide` — two txs, each reply-checked. */
export async function submitBuySide(params: {
  api: GearApi;
  account: string;
  assetKey: string;
  side: "up" | "down";
  finHuman: string;
  minSharesOut: bigint;
  /** Current `Fin.GetRound` id when the buy is submitted — stored for profile position lookup. */
  roundId?: string;
}): Promise<{
  approveTxHash: string;
  approveInBlockHash: string;
  buyTxHash: string;
  buyInBlockHash: string;
}> {
  const { api, account, assetKey, side, finHuman, minSharesOut, roundId } = params;
  if (!MARKET_PROGRAM_ID) {
    throw new Error("NEXT_PUBLIC_MARKET_PROGRAM_ID is not set.");
  }

  const finIn = finHumanToBaseUnits(finHuman);
  const sideU8: 0 | 1 = side === "up" ? 1 : 0;

  const approvePayload = encodeVftApprove(api, MARKET_PROGRAM_ID, finIn);
  const buyPayload = encodeFinBuySide(api, assetKey, sideU8, finIn, minSharesOut);

  // Helper that runs both steps (Approve FIN → Buy side) as one atomic attempt.
  const attempt = async () => {
    const approve = await sendMessageWithReply(
      api,
      FIN_PROGRAM_ID as `0x${string}`,
      account,
      approvePayload,
      "Approve FIN"
    );

    await new Promise((r) => setTimeout(r, 750));

    const buy = await sendMessageWithReply(
      api,
      MARKET_PROGRAM_ID as `0x${string}`,
      account,
      buyPayload,
      "Buy side"
    );

    return { approve, buy };
  };

  const { approve, buy } = await attempt();

  // Record in localStorage so the profile page can list this market without block scanning.
  if (MARKET_PROGRAM_ID) {
    recordTradedMarket(MARKET_PROGRAM_ID, account, assetKey, roundId);
  }

  return {
    approveTxHash: approve.txHash,
    approveInBlockHash: approve.inBlockHash,
    buyTxHash: buy.txHash,
    buyInBlockHash: buy.inBlockHash,
  };
}

/** Anyone can call when round is Open and chain time ≥ `end_ts` and oracle tick is fresh. */
export async function submitSettleRound(params: {
  api: GearApi;
  account: string;
  assetKey: string;
}): Promise<void> {
  const { api, account, assetKey } = params;
  if (!MARKET_PROGRAM_ID) {
    throw new Error("Market program id is not configured.");
  }
  const payload = encodeFinSettleRound(api, assetKey);
  await sendMessageWithReply(
    api,
    MARKET_PROGRAM_ID as `0x${string}`,
    account,
    payload,
    "Settle round",
    GAS_FALLBACK
  );
}

/** After resolution, winning-side shareholders redeem FIN pro-rata. */
export async function submitClaim(params: {
  api: GearApi;
  account: string;
  assetKey: string;
}): Promise<void> {
  const { api, account, assetKey } = params;
  if (!MARKET_PROGRAM_ID) {
    throw new Error("Market program id is not configured.");
  }

  // Pre-flight: simulate claim on-chain (read-only). Shows exact program errors
  // before opening the wallet popup so the user isn't charged VARA gas for a doomed tx.
  const { errorMsg, gasLimit } = await preflightClaim(api, MARKET_PROGRAM_ID, account, assetKey);
  if (errorMsg) {
    throw new Error(errorMsg);
  }

  const payload = encodeFinClaim(api, assetKey);
  await sendMessageWithReply(
    api,
    MARKET_PROGRAM_ID as `0x${string}`,
    account,
    payload,
    "Claim",
    gasLimit
  );
}

/** After resolution, admin claims back their seed liquidity. */
export async function submitClaimSeed(params: {
  api: GearApi;
  account: string;
  assetKey: string;
}): Promise<void> {
  const { api, account, assetKey } = params;
  if (!MARKET_PROGRAM_ID) {
    throw new Error("Market program id is not configured.");
  }

  const payload = encodeFinClaimSeed(api, assetKey);
  await sendMessageWithReply(
    api,
    MARKET_PROGRAM_ID as `0x${string}`,
    account,
    payload,
    "Claim seed",
    CLAIM_GAS_FALLBACK
  );
}
