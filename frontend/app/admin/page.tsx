"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useWallet } from "@/lib/wallet";
import { isAdminWallet, getAdminWallet, MARKET_PROGRAM_ID } from "@/lib/config";
import type { Fixture } from "@/lib/fixtures";
import { createOnChainMarket } from "@/lib/admin-market-create";
import { fetchOnChainAssetKeys } from "@/lib/market-discovery";

type Tab = "upcoming" | "results" | "create";

export default function AdminPage() {
  const { account, api } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [upcomingFixtures, setUpcomingFixtures] = useState<Fixture[]>([]);
  const [recentResults, setRecentResults] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFixtures, setSelectedFixtures] = useState<number[]>([]);
  const [marketTemplates, setMarketTemplates] = useState<string[]>([
    "Match Winner",
    "Over/Under 2.5",
    "Both Teams Score",
    "Correct Score",
    "Half Time/Full Time",
    "First Goalscorer",
  ]);
  const [createPending, setCreatePending] = useState(false);
  const [createLog, setCreateLog] = useState<string[]>([]);

  useEffect(() => {
    if (account) {
      setIsAdmin(isAdminWallet(account));
    }
  }, [account]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/fixtures", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load fixtures: ${res.status}`);
        }
        const data = (await res.json()) as { upcoming: Fixture[]; recent: Fixture[] };
        setUpcomingFixtures(Array.isArray(data.upcoming) ? data.upcoming : []);
        setRecentResults(Array.isArray(data.recent) ? data.recent : []);
      } catch (error) {
        console.error("Failed to fetch fixtures:", error);
        setUpcomingFixtures([]);
        setRecentResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const toggleFixtureSelection = (id: number) => {
    setSelectedFixtures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const selectAllUpcoming = () => {
    setSelectedFixtures(upcomingFixtures.map((f) => f.id));
  };

  const clearSelection = () => {
    setSelectedFixtures([]);
  };

  const titleShort = (name?: string) => {
    if (!name) return "TEAM";
    const cleaned = name.replace(/\s+/g, " ").trim();
    if (!cleaned) return "TEAM";
    return cleaned.length > 14 ? `${cleaned.slice(0, 14)}...` : cleaned;
  };

  const normalizePercentPair = (home: number, away: number) => {
    const homeClamped = Math.max(1, Math.min(99, Math.round(home)));
    const awayClamped = Math.max(1, Math.min(99, Math.round(away)));
    const sum = homeClamped + awayClamped;
    const homeScaled = Math.max(1, Math.min(99, Math.round((homeClamped / sum) * 100)));
    return { home: homeScaled, away: 100 - homeScaled };
  };

  const probabilitiesFromFixture = (fixture: Fixture) => {
    const odds = Array.isArray(fixture.odds) ? fixture.odds : [];

    const numberFromUnknown = (v: unknown): number | null => {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
      if (typeof v === "string") {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return null;
    };

    const homeCandidate = odds.find((o) => {
      const label = (o.label ?? "").toLowerCase();
      return label.includes("home") || label.includes("1");
    });
    const awayCandidate = odds.find((o) => {
      const label = (o.label ?? "").toLowerCase();
      return label.includes("away") || label.includes("2");
    });

    const homeProbRaw = numberFromUnknown(homeCandidate?.probability);
    const awayProbRaw = numberFromUnknown(awayCandidate?.probability);
    if (homeProbRaw !== null && awayProbRaw !== null) {
      return normalizePercentPair(homeProbRaw, awayProbRaw);
    }

    const homeOdds = numberFromUnknown(homeCandidate?.value);
    const awayOdds = numberFromUnknown(awayCandidate?.value);
    if (homeOdds !== null && awayOdds !== null) {
      const invHome = 1 / homeOdds;
      const invAway = 1 / awayOdds;
      const total = invHome + invAway;
      if (total > 0) {
        return normalizePercentPair((invHome / total) * 100, (invAway / total) * 100);
      }
    }

    // Fallback stays deterministic and based on fixture payload when odds are absent.
    const minuteSeed = new Date(fixture.starting_at).getUTCMinutes();
    const homeFallback = 45 + (fixture.id + minuteSeed) % 11;
    return normalizePercentPair(homeFallback, 100 - homeFallback);
  };

  const clean = (input: string) =>
    input
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);

  const marketIdentityFromFixture = (fixture: Fixture) => {
    const homeTeam = fixture.participants?.find((p) => p.meta.location === "home")?.name ?? "HOME";
    const awayTeam = fixture.participants?.find((p) => p.meta.location === "away")?.name ?? "AWAY";
    const home = clean(homeTeam) || "HOME";
    const away = clean(awayTeam) || "AWAY";
    return {
      diaSymbol: `SP${fixture.id}`,
      assetKey: `SPORT/${fixture.id}/${home}-VS-${away}`,
      label: `${homeTeam} vs ${awayTeam}`,
    };
  };

  const createSelectedMarkets = async () => {
    if (!api || !account || selectedFixtures.length === 0) return;

    const selected = upcomingFixtures.filter((f) => selectedFixtures.includes(f.id));
    if (!selected.length) return;

    setCreatePending(true);
    setCreateLog([]);
    try {
      const existing = await fetchOnChainAssetKeys(api, MARKET_PROGRAM_ID, account)
        .catch(() => [] as string[]);
      let nextAssetId = existing.length;

      for (const fixture of selected) {
        const info = marketIdentityFromFixture(fixture);
        if (existing.includes(info.assetKey)) {
          setCreateLog((prev) => [...prev, `Skipped ${info.label} (already registered)`]);
          continue;
        }

        try {
          setCreateLog((prev) => [...prev, `Creating ${info.label}...`]);
          await createOnChainMarket({
            api,
            account,
            diaSymbol: info.diaSymbol,
            assetKey: info.assetKey,
            assetId: nextAssetId,
            seedFinHuman: "100",
            feeBps: 100,
          });
          existing.push(info.assetKey);
          nextAssetId += 1;
          setCreateLog((prev) => [...prev, `Created ${info.label}`]);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setCreateLog((prev) => [...prev, `Failed ${info.label}: ${msg}`]);
        }
      }
    } finally {
      setCreatePending(false);
    }
  };

  if (!account) {
    return (
      <>
        <Header />
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="text-3xl text-white">Admin Panel</h1>
          <p className="mt-4 text-mist">Connect your wallet to access admin features.</p>
        </div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Header />
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="text-3xl text-white">Access Denied</h1>
          <p className="mt-4 text-mist">
            This page is only for the admin wallet.
            <br />
            Admin: {getAdminWallet() ? `${getAdminWallet().slice(0, 10)}...${getAdminWallet().slice(-8)}` : "Not configured"}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
    <div className="mx-auto max-w-7xl px-3 sm:px-4 pb-14 sm:pb-20 pt-5 sm:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl text-white font-display">Sports Market Admin</h1>
        <p className="mt-2 text-sm text-mist">
          Create prediction markets from upcoming sports matches
        </p>
      </div>

      <div className="flex gap-2 border-b border-line mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("upcoming")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "upcoming"
              ? "border-b-2 border-ember text-ember"
              : "text-mist hover:text-white"
          }`}
        >
          Upcoming Matches ({upcomingFixtures.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("results")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "results"
              ? "border-b-2 border-ember text-ember"
              : "text-mist hover:text-white"
          }`}
        >
          Recent Results ({recentResults.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("create")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "create"
              ? "border-b-2 border-ember text-ember"
              : "text-mist hover:text-white"
          }`}
        >
          Create Markets
        </button>
      </div>

      {activeTab === "upcoming" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-mist">
              {selectedFixtures.length} of {upcomingFixtures.length} selected
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllUpcoming}
                className="px-3 py-1 text-xs text-mist border border-line rounded-lg hover:text-white"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="px-3 py-1 text-xs text-mist border border-line rounded-lg hover:text-white"
              >
                Clear
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-panel/50 border border-line" />
              ))}
            </div>
          ) : upcomingFixtures.length === 0 ? (
            <div className="text-center py-12 text-mist">
              No upcoming matches found
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {upcomingFixtures.map((fixture) => {
                const homeTeam = fixture.participants?.find((p) => p.meta.location === "home");
                const awayTeam = fixture.participants?.find((p) => p.meta.location === "away");
                const isSelected = selectedFixtures.includes(fixture.id);
                const probs = probabilitiesFromFixture(fixture);
                const date = new Date(fixture.starting_at);
                const matchup = `${homeTeam?.name ?? "Home"} vs ${awayTeam?.name ?? "Away"}`;
                const volumeLine = fixture.league?.name ?? "Sports";

                return (
                  <div
                    key={fixture.id}
                    onClick={() => toggleFixtureSelection(fixture.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      isSelected
                        ? "border-[#2a8cff] bg-[linear-gradient(180deg,#182433_0%,#141f2c_100%)]"
                        : "border-[#283546] bg-[linear-gradient(180deg,#1b2735_0%,#161f2b_100%)] hover:border-[#3a4f68]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-2">
                            {homeTeam?.image_path ? (
                              <img
                                src={homeTeam.image_path}
                                alt={homeTeam.name}
                                className="h-6 w-6 rounded-sm object-cover"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-sm bg-[#243244]" />
                            )}
                            <span className="truncate text-[27px] leading-none text-[#e8eef7]">1</span>
                            <span className="truncate text-xl font-semibold text-[#eef4fc]">
                              {titleShort(homeTeam?.name)}
                            </span>
                          </div>
                          <span className="text-3xl font-semibold tracking-tight text-[#f2f7ff]">{probs.home}%</span>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-2">
                            {awayTeam?.image_path ? (
                              <img
                                src={awayTeam.image_path}
                                alt={awayTeam.name}
                                className="h-6 w-6 rounded-sm object-cover"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-sm bg-[#243244]" />
                            )}
                            <span className="truncate text-[27px] leading-none text-[#e8eef7]">0</span>
                            <span className="truncate text-xl font-semibold text-[#eef4fc]">
                              {titleShort(awayTeam?.name)}
                            </span>
                          </div>
                          <span className="text-3xl font-semibold tracking-tight text-[#f2f7ff]">{probs.away}%</span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-[#154566] px-3 py-2 text-center text-[18px] font-semibold uppercase tracking-wide text-[#1ad3ff]">
                            {titleShort(homeTeam?.name)}
                          </div>
                          <div className="rounded-xl bg-[#5a1d2d] px-3 py-2 text-center text-[18px] font-semibold uppercase tracking-wide text-[#ff2f53]">
                            {titleShort(awayTeam?.name)}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-sm">
                          <div className="flex min-w-0 items-center gap-2 text-[#8fa0b3]">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ff3f45]" />
                            <span className="truncate text-[#d7e0ec]">{matchup}</span>
                            <span className="truncate text-[#7f90a4]">{volumeLine}</span>
                          </div>
                          <span className="text-[#a4b6c8]">
                            {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 h-4 w-4 rounded border-[#4d6278] bg-transparent"
                        />
                        <div className="text-right text-xs text-[#94a5b8]">
                          {date.toLocaleDateString()}
                        </div>
                        <div className="text-right text-[11px] text-[#71859a]">
                          #{fixture.id}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "results" && (
        <div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-panel/50 border border-line" />
              ))}
            </div>
          ) : recentResults.length === 0 ? (
            <div className="text-center py-12 text-mist">
              No recent results found
            </div>
          ) : (
            <div className="space-y-3">
              {recentResults.map((fixture) => {
                const homeTeam = fixture.participants?.find((p) => p.meta.location === "home");
                const awayTeam = fixture.participants?.find((p) => p.meta.location === "away");

                return (
                  <div
                    key={fixture.id}
                    className="rounded-xl border border-line bg-panel p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {homeTeam && (
                              <>
                                <img
                                  src={homeTeam.image_path}
                                  alt={homeTeam.name}
                                  className="w-8 h-8 rounded-full"
                                />
                                <span className="text-white font-medium">vs</span>
                                <img
                                  src={awayTeam?.image_path}
                                  alt={awayTeam?.name}
                                  className="w-8 h-8 rounded-full"
                                />
                              </>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-mist">
                            {fixture.league?.name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-mist">
                          {fixture.result_info || "Final"}
                        </div>
                        <div className="text-xs text-mist/60">
                          {new Date(fixture.starting_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "create" && (
        <div>
          <div className="rounded-xl border border-line bg-panel p-6">
            <h2 className="text-xl text-white font-semibold mb-4">Create Markets</h2>

            {selectedFixtures.length === 0 ? (
              <p className="text-mist">
                Go to &quot;Upcoming Matches&quot; tab and select matches to create markets.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-mist mb-4">
                  {selectedFixtures.length} matches selected
                </div>

                <div>
                  <label className="block text-sm text-mist mb-2">
                    Market Template
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {marketTemplates.map((template) => (
                      <button
                        key={template}
                        type="button"
                        className="px-3 py-1.5 text-sm border border-line rounded-lg text-mist hover:text-white hover:border-ember/50"
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-line">
                  <button
                    type="button"
                    onClick={() => void createSelectedMarkets()}
                    disabled={!api || selectedFixtures.length === 0 || createPending}
                    className="w-full sm:w-auto px-6 py-2.5 bg-ember/20 border border-ember/50 text-ember rounded-xl hover:bg-ember/30 disabled:opacity-40"
                  >
                    {createPending
                      ? "Creating on-chain markets..."
                      : `Create ${selectedFixtures.length} Market(s)`}
                  </button>
                  <p className="mt-3 text-xs text-mist/80">
                    Note: this flow sends Oracle.AddAsset, Oracle.SubmitRound, Fin.RegisterAsset, Vft.Approve, and Fin.StartRound.
                    The connected admin wallet must also be the Oracle operator.
                  </p>
                  {createLog.length > 0 ? (
                    <div className="mt-3 max-h-44 overflow-auto rounded-lg border border-line/70 bg-ink/40 p-3 text-xs text-mist space-y-1">
                      {createLog.map((line, idx) => (
                        <div key={`${line}-${idx}`}>{line}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-line bg-panel p-6">
            <h2 className="text-xl text-white font-semibold mb-4">Market Templates</h2>
            <div className="space-y-2">
              {marketTemplates.map((template) => (
                <div
                  key={template}
                  className="flex items-center justify-between py-2 border-b border-line/50"
                >
                  <span className="text-white">{template}</span>
                  <span className="text-xs text-mist">Active</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 px-4 py-2 text-sm border border-line rounded-lg text-mist hover:text-white"
            >
              + Add Template
            </button>
          </div>
        </div>
        )}
      </div>
    </>
  );
}
