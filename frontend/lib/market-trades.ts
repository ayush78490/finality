import type { GearApi } from "@gear-js/api";
import type { SignedBlock } from "@polkadot/types/interfaces";
import { compactStripLength, hexToU8a, u8aEq } from "@polkadot/util";
import { FIN_DECIMALS } from "./config";

export type MarketTrade = {
  blockNumber: number;
  blockHash: string;
  extrinsicIndex: number;
  extrinsicHash: string;
  account: string;
  accountShort: string;
  side: "up" | "down";
  finHuman: string;
};

function shortSs58(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function finBaseToHuman(base: bigint): string {
  const d = 10n ** BigInt(FIN_DECIMALS);
  const whole = base / d;
  const frac = base % d;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(FIN_DECIMALS, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/**
 * Decode Sails `Fin.BuySide` handle payload (matches `encodeFinBuySide` in sails-payload.ts).
 */
export function tryDecodeFinBuySide(
  payload: Uint8Array,
  assetKey: string
): { side: "up" | "down"; finIn: bigint } | null {
  try {
    let rest = payload;
    const takeStr = (): string => {
      const [consumed, val] = compactStripLength(rest);
      const s = new TextDecoder().decode(val);
      rest = rest.subarray(consumed);
      return s;
    };

    if (takeStr() !== "Fin") return null;
    if (takeStr() !== "BuySide") return null;
    if (takeStr() !== assetKey) return null;

    const sideByte = rest[0];
    rest = rest.subarray(1);
    if (sideByte !== 0 && sideByte !== 1) return null;

    if (rest.length < 32) return null;
    const finIn = u128LeToBigInt(rest.subarray(0, 16));
    return {
      side: sideByte === 1 ? "up" : "down",
      finIn,
    };
  } catch {
    return null;
  }
}

function u128LeToBigInt(b: Uint8Array): bigint {
  let x = 0n;
  for (let i = 0; i < 16; i++) {
    x |= BigInt(b[i] ?? 0) << (8n * BigInt(i));
  }
  return x;
}

function payloadToU8a(arg: unknown): Uint8Array | null {
  if (arg instanceof Uint8Array) return arg;
  const a = arg as { toU8a?: () => Uint8Array };
  if (a && typeof a.toU8a === "function") return a.toU8a();
  return null;
}

/** Polkadot `Call.args` is often a Tuple / Vec codec, not a plain array. */
function callArgs(method: unknown): unknown[] | null {
  const m = method as { args?: unknown };
  const raw = m.args;
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  const t = raw as {
    toArray?: () => unknown[];
    map?: (cb: (x: unknown, i: number) => unknown) => unknown[];
    length?: number;
    [i: number]: unknown;
  };
  if (typeof t.toArray === "function") return t.toArray();
  if (typeof t.map === "function") return [...t.map((x) => x)];
  const len = t.length;
  if (typeof len === "number" && len > 0) {
    const out: unknown[] = [];
    for (let i = 0; i < len; i++) out.push(t[i]);
    return out;
  }
  return null;
}

function programIdU8a(programHex: string): Uint8Array {
  return hexToU8a(programHex);
}

function destProgramBytes(dest: unknown): Uint8Array | null {
  if (dest instanceof Uint8Array) return dest;
  const a = dest as { toU8a?: () => Uint8Array };
  if (a && typeof a.toU8a === "function") return a.toU8a();
  return null;
}

/** Destination may be raw `ActorId` (32 B) or prefixed `MultiAddress::Id`. */
function destMatchesProgram(raw: Uint8Array, want: Uint8Array): boolean {
  if (raw.length === 32) return u8aEq(raw, want);
  if (raw.length > 32) return u8aEq(raw.subarray(raw.length - 32), want);
  return false;
}

const RPC = "wss%3A%2F%2Ftestnet.vara.network";

/** Public RPC nodes prune state; older block hashes cannot be fetched (4003 / "discarded"). */
function isPrunedOrUnknownBlockError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/4003|discarded|unknown block|state already discarded/i.test(msg)) return true;
  if (typeof err === "object" && err !== null && "code" in err) {
    const c = (err as { code: unknown }).code;
    return c === 4003 || c === -32003;
  }
  return false;
}

export function polkadotAppsBlockUrl(blockHash: string) {
  return `https://polkadot.js.org/apps/?rpc=${RPC}#/explorer/query/${blockHash}`;
}

/**
 * Scan recent chain blocks for `gear.sendMessage` extrinsics to `marketProgramId`
 * whose payload decodes as `Fin.BuySide` for this `assetKey`.
 */
export async function fetchRecentMarketTrades(
  api: GearApi,
  marketProgramId: string,
  assetKey: string,
  opts?: {
    maxBlocks?: number;
    maxTrades?: number;
    /** If set, only include extrinsics signed by this SS58 address. */
    signerAddress?: string;
  }
): Promise<MarketTrade[]> {
  await api.isReady;
  const maxBlocks = opts?.maxBlocks ?? 128;
  const maxTrades = opts?.maxTrades ?? 15;
  const signerFilter = opts?.signerAddress?.trim() || null;

  let wantBytes: Uint8Array;
  try {
    wantBytes = programIdU8a(marketProgramId);
  } catch {
    return [];
  }
  if (wantBytes.length !== 32) return [];

  const header = await api.rpc.chain.getHeader();
  const current = header.number.toNumber();
  const out: MarketTrade[] = [];

  scan: for (let offset = 0; offset < maxBlocks && out.length < maxTrades; offset++) {
    const blockNum = current - offset;
    if (blockNum < 0) break;

    let hashHex: string;
    try {
      const h = await api.rpc.chain.getBlockHash(blockNum);
      hashHex = typeof h === "string" ? h : h.toHex();
    } catch (e) {
      if (isPrunedOrUnknownBlockError(e)) break scan;
      continue;
    }

    let signedBlock: SignedBlock;
    try {
      signedBlock = (await (
        api.rpc.chain.getBlock as (h: string) => Promise<SignedBlock>
      )(hashHex)) as SignedBlock;
    } catch (e) {
      if (isPrunedOrUnknownBlockError(e)) break scan;
      continue;
    }

    const exs = signedBlock.block.extrinsics;

    for (let idx = 0; idx < exs.length; idx++) {
      if (out.length >= maxTrades) break scan;
      const ex = exs[idx]!;
      let method: { section: string; method: string; args: unknown[] };
      try {
        method = ex.method as unknown as {
          section: string;
          method: string;
          args: unknown[];
        };
      } catch {
        continue;
      }
      if (method.section !== "gear" || method.method !== "sendMessage") continue;
      const args = callArgs(ex.method);
      if (!args || args.length < 2) continue;

      const db = destProgramBytes(args[0]);
      if (!db || !destMatchesProgram(db, wantBytes)) continue;

      const raw = payloadToU8a(args[1]);
      if (!raw || raw.length === 0) continue;

      const decoded = tryDecodeFinBuySide(raw, assetKey);
      if (!decoded) continue;

      if (!ex.isSigned) continue;
      let account: string;
      try {
        account = ex.signer.toString();
      } catch {
        continue;
      }

      if (signerFilter && account !== signerFilter) continue;

      let extrinsicHash: string;
      try {
        extrinsicHash = ex.hash.toHex();
      } catch {
        extrinsicHash = "";
      }

      out.push({
        blockNumber: blockNum,
        blockHash: hashHex,
        extrinsicIndex: idx,
        extrinsicHash,
        account,
        accountShort: shortSs58(account),
        side: decoded.side,
        finHuman: finBaseToHuman(decoded.finIn),
      });
    }
  }

  out.sort(
    (a, b) =>
      b.blockNumber - a.blockNumber ||
      b.extrinsicIndex - a.extrinsicIndex
  );
  return out.slice(0, maxTrades);
}
