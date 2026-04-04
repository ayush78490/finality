import { readFileSync } from "node:fs";
import { z } from "zod";

const feedSchema = z.object({
  symbol: z.string(),
  diaSymbol: z.string(),
  /** On-chain `Oracle.add_asset` id; must match `Fin.register_asset` for this market symbol. */
  assetId: z.number().int().nonnegative(),
  /** e.g. BTCUSDT — defaults to {diaSymbol}USDT if omitted */
  binanceSymbol: z.string().optional()
});

const fileSchema = z.object({
  /** Legacy DIA base URL (only used if ORACLE_ENABLE_PUSH=true). */
  diaBaseUrl: z.string().min(1).optional().default("https://api.diadata.org"),
  marketProgramId: z.string(),
  pollIntervalMs: z.number().int().positive(),
  maxPriceAgeSeconds: z.number().int().positive(),
  feeds: z.array(feedSchema),
  notes: z.array(z.string()).optional()
});

export type RelayerFileConfig = z.infer<typeof fileSchema>;

export function loadRelayerConfig(path: string): RelayerFileConfig {
  const raw = readFileSync(path, "utf8");
  return fileSchema.parse(JSON.parse(raw));
}
