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
  /** DIA fallback base URL used when Binance quote fetch fails. */
  diaBaseUrl: z.string().min(1).optional().default("https://api.diadata.org"),
  marketProgramId: z.string(),
  pollIntervalMs: z.number().int().positive(),
  maxPriceAgeSeconds: z.number().int().positive(),
  feeds: z.array(feedSchema),
  notes: z.array(z.string()).optional(),
  /**
   * Round mode: "legacy" = original settle+approve+start cycle (default).
   * "rolling" = single SettleAndRoll extrinsic per epoch, no per-round seed movement.
   */
  roundMode: z.enum(["legacy", "rolling"]).default("legacy"),
  /** Epoch duration in seconds. Must match the on-chain `round_seconds` value. Default: 300. */
  roundSeconds: z.number().int().positive().default(300),
  /**
   * When true and roundMode is "rolling", uses SettleAndRollWithTick (oracle price + settle+roll
   * in one extrinsic). Requires the contract to support the combined entrypoint.
   */
  combinedSettleRoll: z.boolean().default(false),
});

export type RelayerFileConfig = z.infer<typeof fileSchema>;

export function loadRelayerConfig(path: string): RelayerFileConfig {
  const raw = readFileSync(path, "utf8");
  return fileSchema.parse(JSON.parse(raw));
}
