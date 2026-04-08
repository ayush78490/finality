import { readFileSync } from "node:fs";
import path from "node:path";

const BASE_URL = "https://api.sportmonks.com/v3/football";

function readTokenFromDotEnv(filePath: string): string {
  try {
    const raw = readFileSync(filePath, "utf8");
    const match = raw.match(/^SPORTMONKS_TOKEN\s*=\s*(.+)$/m);
    if (!match) return "";
    return match[1].trim().replace(/^['\"]|['\"]$/g, "");
  } catch {
    return "";
  }
}

function resolveSportMonksToken(): string {
  const envToken = process.env.SPORTMONKS_TOKEN?.trim();
  if (envToken) return envToken;

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
  ];

  for (const candidate of candidates) {
    const token = readTokenFromDotEnv(candidate);
    if (token) return token;
  }

  throw new Error("SPORTMONKS_TOKEN is not configured");
}

const TOKEN = resolveSportMonksToken();

async function sportmonksFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("api_token", TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message ?? `SportMonks error: ${res.status}`);
  }

  return res.json();
}

export default sportmonksFetch;
