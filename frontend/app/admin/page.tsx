"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useWallet } from "@/lib/wallet";
import { isAdminWallet, ADMIN_WALLET } from "@/lib/config";
import { getUpcomingFixtures, getRecentResults, type Fixture } from "@/lib/fixtures";

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
        const [upcoming, results] = await Promise.all([
          getUpcomingFixtures(7),
          getRecentResults(7),
        ]);
        setUpcomingFixtures(upcoming);
        setRecentResults(results);
      } catch (error) {
        console.error("Failed to fetch fixtures:", error);
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
            Admin: {ADMIN_WALLET ? `${ADMIN_WALLET.slice(0, 10)}...${ADMIN_WALLET.slice(-8)}` : "Not configured"}
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
            <div className="space-y-3">
              {upcomingFixtures.map((fixture) => {
                const homeTeam = fixture.participants?.find((p) => p.meta.location === "home");
                const awayTeam = fixture.participants?.find((p) => p.meta.location === "away");
                const isSelected = selectedFixtures.includes(fixture.id);

                return (
                  <div
                    key={fixture.id}
                    onClick={() => toggleFixtureSelection(fixture.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition ${
                      isSelected
                        ? "border-ember/50 bg-ember/10"
                        : "border-line bg-panel hover:border-ember/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-line"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {homeTeam && (
                              <img
                                src={homeTeam.image_path}
                                alt={homeTeam.name}
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                            <span className="text-white font-medium">vs</span>
                            {awayTeam && (
                              <img
                                src={awayTeam.image_path}
                                alt={awayTeam.name}
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                          </div>
                          <div className="mt-1 text-sm text-mist">
                            {homeTeam?.name} vs {awayTeam?.name}
                          </div>
                          <div className="text-xs text-mist/60 mt-1">
                            {fixture.league?.name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white">
                          {new Date(fixture.starting_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-mist">
                          {new Date(fixture.starting_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
                    disabled={!api || selectedFixtures.length === 0}
                    className="w-full sm:w-auto px-6 py-2.5 bg-ember/20 border border-ember/50 text-ember rounded-xl hover:bg-ember/30 disabled:opacity-40"
                  >
                    Create {selectedFixtures.length} Market(s)
                  </button>
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
