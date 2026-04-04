import { DIA_API } from "./config";

export type DiaParsed = {
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
};

export function humanPrice(major: string, expo: number): number {
  const n = Number(major);
  return n * Math.pow(10, expo);
}

/**
 * Fetch DIA quotation and normalize to the same shape as the on-chain oracle tick.
 * https://api.diadata.org/v1/quotation/{SYMBOL}
 */
export async function fetchLatestDia(diaSymbol: string): Promise<DiaParsed> {
  const base = DIA_API.replace(/\/$/, "");
  const url = new URL(`/v1/quotation/${encodeURIComponent(diaSymbol)}`, base);
  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`DIA ${res.status}`);
  const row = (await res.json()) as {
    Price: number;
    Time: string;
  };
  const publishMs = Date.parse(row.Time);
  if (Number.isNaN(publishMs)) throw new Error("DIA bad Time");
  const publish_time = Math.floor(publishMs / 1000);
  const expo = -8;
  const scaled = BigInt(Math.round(row.Price * 1e8));
  const conf = BigInt(Math.max(1, Math.round(row.Price * 1e8 * 0.001)));
  return {
    price: {
      price: scaled.toString(),
      conf: conf.toString(),
      expo,
      publish_time
    }
  };
}
