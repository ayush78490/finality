import { z } from "zod";

/**
 * DIA public REST API — see https://www.diadata.org/docs/reference/apis/token-prices/api-endpoints
 * Example: GET https://api.diadata.org/v1/quotation/BTC
 */
const diaQuotationSchema = z.object({
  Symbol: z.string(),
  Price: z.number(),
  Time: z.string(),
  Source: z.string().optional()
});

function diaHttpTimeoutMs(): number {
  const raw = process.env.DIA_HTTP_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 8000;
}

/** Normalized tick for legacy DIA loop → `Oracle.submit_round` (price as decimal strings, expo, unix sec). */
export type DiaNormalizedTick = {
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
};

/**
 * Fetch latest quotation and map to i128-scaled price (8 decimals) for `Oracle.submit_round`:
 * - price/conf as base units with expo -8 (USD-style) for the market program.
 */
export async function fetchLatestDia(
  diaBaseUrl: string,
  diaSymbol: string
): Promise<DiaNormalizedTick> {
  const base = diaBaseUrl.replace(/\/$/, "");
  const url = new URL(`/v1/quotation/${encodeURIComponent(diaSymbol)}`, base);
  const controller = new AbortController();
  const timeoutMs = diaHttpTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`DIA request failed for ${diaSymbol}: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`DIA HTTP ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const row = diaQuotationSchema.parse(json);
  const publishMs = Date.parse(row.Time);
  if (Number.isNaN(publishMs)) {
    throw new Error(`DIA bad Time: ${row.Time}`);
  }
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
