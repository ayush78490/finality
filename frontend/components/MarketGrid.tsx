"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchAllMarketRoundDetails, type MarketRoundSnapshot, type MarketRoundDetail } from "@/lib/fin-get-round";
import { MARKET_PROGRAM_ID } from "@/lib/config";
import { MARKETS, type MarketMeta } from "@/lib/markets";
import { useWallet } from "@/lib/wallet";
import { MarketCard, type PoolData, type SportsCardData } from "@/components/MarketCard";
import { binanceSymbolForMarket, fetchHistoricalKlines } from "@/lib/binance";
import { fetchTradableMarkets } from "@/lib/market-discovery";

const COIN_ICONS: Record<string, string> = {
  btc: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  sol: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  bnb: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2.png",
  avax: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  ton: "https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png",
  sui: "https://cryptologos.cc/logos/sui-sui-logo.png?v=040",
  doge: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  xrp: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-888.png",
  ada: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
  dot: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
  link: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  ltc: "https://assets.coingecko.com/coins/images/2/small/litecoin.png",
  matic: "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
  arb: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.png",
  op: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
  near: "https://assets.coingecko.com/coins/images/10365/small/near.jpg",
  fil: "https://assets.coingecko.com/coins/images/12817/small/filecoin.png",
  atom: "https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png",
  inj: "https://assets.coingecko.com/coins/images/12882/small/Secondary_Symbol.png",
  tia: "https://assets.coingecko.com/coins/images/31967/small/tia.jpg",
  sei: "https://assets.coingecko.com/coins/images/28285/small/Sei_Logo_-_Transparent.png",
  wld: "https://assets.coingecko.com/coins/images/31069/small/worldcoin.jpeg",
  pepe: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg",
  shib: "https://assets.coingecko.com/coins/images/11939/small/shiba.png",
  trx: "https://assets.coingecko.com/coins/images/1094/small/tron-logo.png",
  bch: "https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png",
  etc: "https://assets.coingecko.com/coins/images/453/small/ethereum-classic-logo.png",
  uni: "https://assets.coingecko.com/coins/images/12504/small/uni.jpg",
  aave: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png"
};

const POLL_MS = 8_000;

const CATEGORY_TOPICS = [
  "crypto",
  "sports",
  "esports",
  "politics",
  "tech",
  "finance",
  "economy",
  "culture",
] as const;

const TOPIC_LABELS: Record<(typeof CATEGORY_TOPICS)[number], string> = {
  crypto: "Crypto",
  sports: "Sports",
  esports: "Esports",
  politics: "Politics",
  tech: "Tech",
  finance: "Finance",
  economy: "Economy",
  culture: "Culture",
};

function computePoolData(detail: MarketRoundDetail | "error" | undefined): PoolData | undefined {
  if (!detail || detail === "error" || detail.kind === "none") return undefined;
  
  const { reserveUp, reserveDown } = detail;
  
  // FIN has 12 decimals
  const upDecimals = Number(reserveUp) / 1e12;
  const downDecimals = Number(reserveDown) / 1e12;
  
  // Compute odds: each side's odds = totalLiquidity / thatSideLiquidity
  const totalLiquidity = upDecimals + downDecimals;
  const oddsUp = totalLiquidity / upDecimals;
  const oddsDown = totalLiquidity / downDecimals;
  
  return {
    reserveUp: upDecimals.toFixed(0),
    reserveDown: downDecimals.toFixed(0),
    totalLiquidity: totalLiquidity.toFixed(0),
    oddsUp: oddsUp.toFixed(2),
    oddsDown: oddsDown.toFixed(2)
  };
}

type PhaseMap = Record<string, MarketRoundSnapshot | "error">;
type DetailMap = Record<string, MarketRoundDetail | "error">;
type SportsMap = Record<string, SportsCardData>;
type SparkMap = Record<string, string>;

type ApiParticipant = {
  name?: string;
  image_path?: string;
  meta?: { location?: "home" | "away" };
};

type ApiFixture = {
  id: number;
  starting_at?: string;
  league?: { name?: string };
  participants?: ApiParticipant[];
};

function sportFixtureId(assetKey: string): number | null {
  const m = assetKey.match(/^SPORT\/(\d+)\//i);
  if (!m?.[1]) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

function toSparklinePoints(closes: number[]): string | null {
  if (closes.length < 2) return null;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  return closes
    .map((price, i) => {
      const x = 10 + i * (200 / (closes.length - 1));
      const normalized = (price - min) / range;
      const y = 30 - normalized * 20;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function MarketGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { api, account } = useWallet();
  const [markets, setMarkets] = useState<MarketMeta[]>(MARKETS);
  const [phases, setPhases] = useState<PhaseMap>({});
  const [details, setDetails] = useState<DetailMap>({});
  const [sportsBySlug, setSportsBySlug] = useState<SportsMap>({});
  const [sparkBySlug, setSparkBySlug] = useState<SparkMap>({});
  const [topicsExpanded, setTopicsExpanded] = useState(true);

  const selectedTopic = (searchParams.get("topic") ?? "crypto").toLowerCase();

  const onTopicSelect = (topic: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("topic", topic);
    router.push(`${pathname}?${params.toString()}`);
  };

  const displayMarkets = useMemo(() => {
    const isSportsTopic = selectedTopic === "sports" || selectedTopic === "esports";
    if (isSportsTopic) {
      return markets.filter((m) => m.assetKey.startsWith("SPORT/"));
    }
    return markets.filter((m) => !m.assetKey.startsWith("SPORT/"));
  }, [markets, selectedTopic]);

  useEffect(() => {
    if (!api || !MARKET_PROGRAM_ID) {
      setMarkets(MARKETS);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const discovered = await fetchTradableMarkets(api, MARKET_PROGRAM_ID, account);
        if (!cancelled) setMarkets(discovered.length ? discovered : MARKETS);
      } catch {
        if (!cancelled) setMarkets(MARKETS);
      }
    };
    void run();
    const id = window.setInterval(() => void run(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [api, account]);

  useEffect(() => {
    const sportTargets = markets
      .map((m) => ({ slug: m.slug, id: sportFixtureId(m.assetKey) }))
      .filter((m): m is { slug: string; id: number } => m.id !== null);

    if (sportTargets.length === 0) {
      setSportsBySlug({});
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const ids = sportTargets.map((m) => m.id).join(",");
        const res = await fetch(`/api/fixtures?ids=${encodeURIComponent(ids)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = (await res.json()) as { fixtures?: ApiFixture[] };
        const fixtures = Array.isArray(data.fixtures) ? data.fixtures : [];
        const fixtureById = new Map<number, ApiFixture>();
        for (const f of fixtures) fixtureById.set(f.id, f);

        const next: SportsMap = {};
        for (const target of sportTargets) {
          const fx = fixtureById.get(target.id);
          if (!fx) continue;

          const home = fx.participants?.find((p) => p.meta?.location === "home");
          const away = fx.participants?.find((p) => p.meta?.location === "away");
          next[target.slug] = {
            fixtureId: fx.id,
            homeName: home?.name ?? "HOME",
            awayName: away?.name ?? "AWAY",
            homeLogo: home?.image_path,
            awayLogo: away?.image_path,
            leagueName: fx.league?.name,
            startingAt: fx.starting_at,
          };
        }

        if (!cancelled) setSportsBySlug(next);
      } catch {
        if (!cancelled) setSportsBySlug({});
      }
    };

    void run();
    const id = window.setInterval(() => void run(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [markets]);

  useEffect(() => {
    const cryptoMarkets = markets.filter((m) => !m.assetKey.startsWith("SPORT/"));
    if (cryptoMarkets.length === 0) {
      setSparkBySlug({});
      return;
    }

    let cancelled = false;
    const run = async () => {
      const settled = await Promise.all(
        cryptoMarkets.map(async (m) => {
          try {
            const symbol = binanceSymbolForMarket(m);
            const klines = await fetchHistoricalKlines(symbol, "5m", 12);
            const closes = klines.map((k) => k.close).filter((v) => Number.isFinite(v) && v > 0);
            const points = toSparklinePoints(closes);
            return [m.slug, points] as const;
          } catch {
            return [m.slug, null] as const;
          }
        })
      );

      if (cancelled) return;
      const next: SparkMap = {};
      for (const [slug, points] of settled) {
        if (points) next[slug] = points;
      }
      setSparkBySlug(next);
    };

    void run();
    const id = window.setInterval(() => void run(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [markets]);

  useEffect(() => {
    if (!api || !MARKET_PROGRAM_ID) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        // Single-pass round detail load, then derive phase map to avoid duplicate chain reads.
        const nextDetails = await fetchAllMarketRoundDetails(api, MARKET_PROGRAM_ID, markets, account);
        const nextPhases: PhaseMap = {};
        for (const m of markets) {
          const detail = nextDetails[m.slug];
          if (detail === "error") {
            nextPhases[m.slug] = "error";
            continue;
          }
          if (!detail || detail.kind === "none") {
            nextPhases[m.slug] = { kind: "none" };
            continue;
          }
          nextPhases[m.slug] = {
            kind: "round",
            phase: detail.phase,
            outcomeUp: detail.outcomeUp,
          };
        }

        if (!cancelled) {
          setPhases(nextPhases);
          setDetails(nextDetails);
        }
      } catch (e) {
        if (!cancelled) {
          setPhases({});
          setDetails({});
        }
      }
    };

    void run();
    const id = window.setInterval(() => void run(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [api, account, markets]);

  return (
    <section className="mx-auto max-w-[1300px] px-3 pb-8 pt-4 sm:px-4 sm:pb-12 sm:pt-6 md:pb-16 md:pt-8 lg:px-6">
      <div className="flex flex-col lg:flex-row items-start gap-4 lg:gap-6">
        {/* Mobile/Tablet Category Dropdown */}
        <div className="w-full lg:hidden">
          <div className="relative">
            <button
              type="button"
              onClick={() => setTopicsExpanded((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-line/70 bg-panel/70 px-4 py-3 text-left text-[14px] font-semibold text-white backdrop-blur-md"
            >
              <span>Category: {TOPIC_LABELS[selectedTopic as keyof typeof TOPIC_LABELS] || selectedTopic}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className={`transition-transform ${topicsExpanded ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {topicsExpanded && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-line/70 bg-panel/95 p-2 shadow-lg backdrop-blur-md">
                {CATEGORY_TOPICS.map((topic) => {
                  const active = selectedTopic === topic;
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => {
                        onTopicSelect(topic);
                        setTopicsExpanded(false);
                      }}
                      className={`flex w-full items-center rounded-lg px-3 py-2.5 text-[14px] font-medium transition ${
                        active
                          ? "bg-shore/15 text-shore border border-shore/30"
                          : "border border-transparent text-mist hover:bg-line/30 hover:text-white"
                      }`}
                    >
                      {TOPIC_LABELS[topic]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Sidebar */}
        <aside
          className={`hidden lg:block sticky top-24 self-start rounded-2xl border border-line/70 bg-panel/70 p-2 backdrop-blur-md transition-all duration-300 ${
            topicsExpanded ? "w-56" : "w-16"
          }`}
        >
          <button
            type="button"
            onClick={() => setTopicsExpanded((v) => !v)}
            className="mb-2 flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-[12px] font-semibold text-mist hover:bg-line/30 hover:text-white"
          >
            {topicsExpanded ? <span>Categories</span> : <span className="mx-auto">Cat</span>}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className={`transition-transform ${topicsExpanded ? "" : "rotate-180"}`}
            >
              <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="space-y-1">
            {CATEGORY_TOPICS.map((topic) => {
              const active = selectedTopic === topic;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => onTopicSelect(topic)}
                  className={`flex w-full items-center rounded-xl px-2 py-2 text-[12px] font-medium transition ${
                    active
                      ? "bg-shore/15 text-shore border border-shore/30"
                      : "border border-transparent text-mist hover:bg-line/30 hover:text-white"
                  } ${topicsExpanded ? "justify-start" : "justify-center"}`}
                  title={TOPIC_LABELS[topic]}
                >
                  {topicsExpanded ? TOPIC_LABELS[topic] : TOPIC_LABELS[topic].slice(0, 1)}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1 w-full">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 sm:gap-4">
            {displayMarkets.map((m) => (
              <MarketCard
                key={m.slug}
                market={m}
                phase={phases[m.slug]}
                connected={!!api && !!MARKET_PROGRAM_ID}
                imageUrl={COIN_ICONS[m.slug]}
                poolData={computePoolData(details[m.slug])}
                sportsData={sportsBySlug[m.slug]}
                sparklinePoints={sparkBySlug[m.slug]}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}