/**
 * HTTP oracle keeper (e.g. local service on 127.0.0.1:8787):
 *   GET  /health
 *   POST /resolve  — notify or delegate market resolution (settle / start).
 */

const DEFAULT_TIMEOUT_MS = 15_000;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export type KeeperResolveAction = "settle" | "start";

export type KeeperResolveBody = {
  marketProgramId: string;
  symbol: string;
  assetId: number;
  action: KeeperResolveAction;
};

export async function pingOracleKeeperHealth(
  baseUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ ok: boolean; status: number; text: string }> {
  const url = `${normalizeBaseUrl(baseUrl)}/health`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: ac.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text: text.slice(0, 500) };
  } finally {
    clearTimeout(t);
  }
}

export async function postOracleKeeperResolve(
  baseUrl: string,
  body: KeeperResolveBody,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ ok: boolean; status: number; text: string }> {
  const url = `${normalizeBaseUrl(baseUrl)}/resolve`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text: text.slice(0, 2000) };
  } finally {
    clearTimeout(t);
  }
}
