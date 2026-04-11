import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi } from "@gear-js/api";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { loadRelayerConfig, type RelayerFileConfig } from "./config.js";
import { createVaraKeyring } from "./keyring-vara.js";
import { readRoundDetail } from "./round-read.js";
import { readIntentForFeed } from "./round-reader-worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type FeedEntry = RelayerFileConfig["feeds"][number];

function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function avg(samples: number[]): number {
  if (samples.length === 0) return 0;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

async function legacyCycle(api: GearApi, marketId: string, feeds: FeedEntry[], origin: string): Promise<number> {
  const t0 = Date.now();

  const priorities = await Promise.all(
    feeds.map(async (feed) => {
      try {
        const detail = await readRoundDetail(api, marketId, feed.symbol, origin);
        const nowMs = Date.now();
        if (!detail.phase || detail.phase === "None" || detail.phase === "Resolved") {
          return { feed, priority: "no_round" as const, endTs: 0 };
        }
        if (nowMs >= detail.endTs) {
          return { feed, priority: "expired" as const, endTs: detail.endTs };
        }
        return { feed, priority: "active" as const, endTs: detail.endTs };
      } catch {
        return { feed, priority: "no_round" as const, endTs: 0 };
      }
    })
  );

  priorities.sort((a, b) => {
    const order = { expired: 0, active: 1, no_round: 2 };
    const d = order[a.priority] - order[b.priority];
    if (d !== 0) return d;
    return a.endTs - b.endTs;
  });

  // Simulate legacy per-market manage phase read pass (classifySettleSim -> readRoundDetail).
  for (const p of priorities) {
    try {
      await readRoundDetail(api, marketId, p.feed.symbol, origin);
    } catch {
      // ignore benchmark read errors to keep cycle moving
    }
  }

  return Date.now() - t0;
}

async function orchestratorCycle(
  api: GearApi,
  marketId: string,
  feeds: FeedEntry[],
  origin: string,
  roundMode: "legacy" | "rolling"
): Promise<number> {
  const t0 = Date.now();
  const nowMs = Date.now();

  const intents = await Promise.all(
    feeds.map((feed) => readIntentForFeed(api, marketId, feed, origin, nowMs, roundMode))
  );

  intents
    .filter((x) => x.action !== "none")
    .sort((a, b) => {
      const order = { settle: 0, settle_roll: 0, start: 1, none: 2 };
      const d = order[a.action] - order[b.action];
      if (d !== 0) return d;
      return a.endTs - b.endTs;
    });

  return Date.now() - t0;
}

async function main() {
  const iterationsRaw = process.env.BENCH_ITERATIONS?.trim();
  const iterations = iterationsRaw ? Math.max(3, Number(iterationsRaw)) : 20;

  const configPath =
    process.env.ORACLE_CONFIG ??
    path.resolve(__dirname, "../../..", "config", "oracle.config.json");
  const cfg = loadRelayerConfig(configPath);
  const marketId = process.env.MARKET_PROGRAM_ID?.trim() || cfg.marketProgramId.trim();
  if (!marketId) throw new Error("Set MARKET_PROGRAM_ID");
  const roundMode = cfg.roundMode;

  const bootstrapMn = process.env.BOOTSTRAP_MNEMONIC?.trim();
  if (!bootstrapMn) throw new Error("BOOTSTRAP_MNEMONIC is required for read origin");

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";

  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const admin = keyring.addFromMnemonic(bootstrapMn);

  const feeds = cfg.feeds;
  const legacySamples: number[] = [];
  const orchSamples: number[] = [];

  console.log(
    JSON.stringify({
      level: "info",
      msg: "benchmark_start",
      endpoint,
      marketId,
      feeds: feeds.length,
      iterations,
      roundMode,
      note: "read_only_no_txs",
    })
  );

  for (let i = 0; i < iterations; i++) {
    const legacyMs = await legacyCycle(api, marketId, feeds, admin.address);
    const orchMs = await orchestratorCycle(api, marketId, feeds, admin.address, roundMode);
    legacySamples.push(legacyMs);
    orchSamples.push(orchMs);

    console.log(
      JSON.stringify({
        level: "info",
        msg: "benchmark_iteration",
        iteration: i + 1,
        legacyMs,
        orchestratorMs: orchMs,
        deltaMs: legacyMs - orchMs,
      })
    );
  }

  const legacyAvg = avg(legacySamples);
  const orchAvg = avg(orchSamples);
  const speedupX = orchAvg > 0 ? legacyAvg / orchAvg : 0;
  const fasterPct = legacyAvg > 0 ? ((legacyAvg - orchAvg) / legacyAvg) * 100 : 0;

  console.log(
    JSON.stringify({
      level: "info",
      msg: "benchmark_summary",
      feeds: feeds.length,
      iterations,
      legacy: {
        minMs: Math.min(...legacySamples),
        p50Ms: percentile(legacySamples, 50),
        p95Ms: percentile(legacySamples, 95),
        avgMs: Number(legacyAvg.toFixed(2)),
      },
      orchestrator: {
        minMs: Math.min(...orchSamples),
        p50Ms: percentile(orchSamples, 50),
        p95Ms: percentile(orchSamples, 95),
        avgMs: Number(orchAvg.toFixed(2)),
      },
      speedupX: Number(speedupX.toFixed(2)),
      fasterPct: Number(fasterPct.toFixed(2)),
      legacyReadCallsPerCycle: feeds.length * 2,
      orchestratorReadCallsPerCycle: feeds.length,
    })
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
