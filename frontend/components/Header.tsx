"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { useClickOutside } from "@/lib/hooks";
import { isAdminWallet } from "@/lib/config";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const TOPICS = [
  "Trending",
  "Breaking",
  "New",
  "Politics",
  "Sports",
  "Crypto",
  "Esports",
  "Iran",
  "Finance",
  "Geopolitics",
  "Tech",
  "Culture",
  "Economy",
  "Weather",
  "Mentions",
  "Elections"
];

const VISIBLE_TOPICS = 9;

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    account,
    connect,
    disconnect,
    finBalance,
    finBalanceError,
    finBalanceLoading,
    refreshFinBalance,
    isAdmin
  } = useWallet();

  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useClickOutside(() => setIsExpanded(false));
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  useEffect(() => {
    const readTopic = () => {
      if (typeof window === "undefined") return;
      // Only set topic from URL on home page, otherwise keep null
      if (pathname !== "/") {
        setSelectedTopic(null);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("topic") ?? "crypto";
      setSelectedTopic(next.toLowerCase());
    };
    readTopic();
    window.addEventListener("popstate", readTopic);
    return () => window.removeEventListener("popstate", readTopic);
  }, [pathname]);

  const onTopicClick = (topic: string) => {
    const next = topic.toLowerCase();
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    params.set("topic", next);
    const q = params.toString();
    router.push(pathname === "/" ? `/?${q}` : `/?${q}`);
    setSelectedTopic(next);
    setIsExpanded(false);
  };

  const visibleTopics = isExpanded ? TOPICS : TOPICS.slice(0, VISIBLE_TOPICS);
  const hasMore = !isExpanded && TOPICS.length > VISIBLE_TOPICS;

  // Flash green when balance drops (FIN was deducted after a buy).
  const prevBalanceRef = useRef<string | null>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (
      finBalance !== null &&
      prevBalanceRef.current !== null &&
      finBalance !== prevBalanceRef.current
    ) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1800);
      return () => clearTimeout(t);
    }
    prevBalanceRef.current = finBalance;
  }, [finBalance]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-[#0a1018]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1380px] flex-wrap items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 lg:px-6 md:flex-nowrap">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 sm:gap-2 pr-1 text-white no-underline">
          <span className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center overflow-hidden rounded-lg border border-[#2a3643] bg-[#111a24]">
            <Image
              src="/finalityLogo.png"
              alt="Finality logo"
              width={36}
              height={36}
              className="h-7 w-7 sm:h-8 sm:w-8 object-contain"
              priority
            />
          </span>
          <div className="font-sans text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-[#52d7f2]">Finality</div>
        </Link>

        <div className="order-3 hidden w-full basis-full pt-2 sm:mx-2 sm:block sm:min-w-[240px] sm:flex-1 sm:pt-0 md:order-none md:basis-auto">
          <label className="flex h-10 sm:h-12 items-center gap-2 sm:gap-3 rounded-xl border border-[#1e2a36] bg-[#111b27] px-3 sm:px-4 text-[#8aa0b6] focus-within:border-[#2d84ff]">
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search markets..."
              className="w-full bg-transparent text-sm sm:text-base text-[#dbe6f1] placeholder:text-[#6f8296] outline-none"
            />
          </label>
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {account ? (
            <>
              <Link
                href="/faucet"
                className="rounded-lg sm:rounded-xl border border-[#1f3b57] bg-[#102033] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#6fb2ff] transition hover:border-[#2d84ff] hover:text-[#9acaFF]"
              >
                Faucet
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-lg sm:rounded-xl border border-[#1f3b57] bg-[#102033] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#f49b22] transition hover:border-[#f49b22] hover:text-[#ffb756]"
                >
                  Admin
                </Link>
              )}

              <div className="flex max-w-full items-center rounded-full border border-[#006f94] bg-[#07131e] px-2 py-1 shadow-[0_0_0_1px_rgba(0,175,220,0.12)_inset]">
                <Link
                  href="/profile"
                  aria-label="Profile"
                  title="Profile"
                  className="mr-1.5 sm:mr-2 grid h-7 w-7 sm:h-8 sm:w-8 place-items-center overflow-hidden rounded-full border border-[#3d556d] bg-[#12202f] text-[9px] font-semibold text-[#dce8f3]"
                >
                  <span>{account.slice(2, 4).toUpperCase()}</span>
                </Link>

                <Link href="/profile" className="hidden sm:flex flex-col items-start leading-none">
                  <div className="font-mono text-xs font-semibold tracking-wide text-[#5ee3ff]">
                    {shortAddr(account)}
                  </div>
                </Link>

                <div className="mx-2 hidden h-6 w-px bg-[#1f3c4f] sm:block" />

                <button
                  type="button"
                  onClick={() => refreshFinBalance().catch(console.error)}
                  className="flex flex-col items-start text-left leading-none"
                  title="Refresh FIN balance"
                >
                  {finBalanceLoading ? (
                    <div className="font-mono text-base text-[#dbe6f1]">...</div>
                  ) : finBalanceError ? (
                    <div className="max-w-[8.5rem] truncate text-sm text-rose-300" title={finBalanceError}>
                      {finBalanceError.length > 24
                        ? `${finBalanceError.slice(0, 24)}...`
                        : finBalanceError}
                    </div>
                  ) : (
                    <>
                      <div
                        className={`font-mono text-sm sm:text-base font-semibold text-white transition-colors ${
                          flash ? "text-emerald-300" : ""
                        } mb-[-1px]`}
                      >
                        {finBalance ?? "-"} FIN
                      </div>
                      <div className="hidden sm:block font-mono text-xs font-semibold text-[#39d27d]">
                        Wallet Connected
                      </div>
                    </>
                  )}
                </button>

                <Link
                  href="/profile"
                  aria-label="Profile menu"
                  title="Profile"
                  className="ml-2 hidden sm:grid h-6 w-6 place-items-center rounded-full text-[#78cde8] transition hover:bg-[#122739] hover:text-[#a7e7fb]"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3" fill="none">
                    <path
                      d="m6 9 6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </div>

              <button
                type="button"
                onClick={disconnect}
                className="hidden sm:inline-flex rounded-xl border border-[#266ed4] bg-[#0e1f33] px-4 py-2 text-sm font-semibold text-[#7eb9ff] transition hover:bg-[#123057]"
              >
                Sign out
              </button>

              <button
                type="button"
                onClick={disconnect}
                aria-label="Sign out"
                className="sm:hidden rounded-lg border border-[#266ed4] bg-[#0e1f33] px-2.5 py-1.5 text-xs font-semibold text-[#7eb9ff]"
              >
                Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/profile"
                className="hidden px-3 py-2 text-sm font-semibold text-[#1b8fff] transition hover:text-[#62b6ff] lg:block"
              >
                How it works
              </Link>
              <button
                type="button"
                onClick={() => connect().catch(console.error)}
                className="rounded-lg sm:rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#2f9cff] transition hover:text-[#6fb6ff]"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => connect().catch(console.error)}
                className="rounded-lg sm:rounded-xl bg-[#1293ff] px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-[#2ba0ff]"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </div>

      <div className="hidden sm:block">
        <nav
          ref={navRef}
          className="mx-auto flex max-w-[1380px] items-center gap-4 sm:gap-6 overflow-visible px-2 sm:px-4 py-2 sm:py-3 text-sm sm:text-lg text-[#91a6bb] lg:px-6"
        >
          <div className="flex items-center gap-1 overflow-x-auto overflow-visible">
            {visibleTopics.map((topic, i) => {
              const isActive = selectedTopic !== null && selectedTopic === topic.toLowerCase();
              const isDividerAfter = topic === "New";
              return (
                <div key={topic} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => onTopicClick(topic)}
                    className={`shrink-0 whitespace-nowrap px-2 font-semibold transition ${
                      isActive
                        ? "text-white"
                        : "text-[#8fa4b7] hover:text-[#d6e2ef]"
                    } ${i === 0 ? "flex items-center gap-1.5" : ""}`}
                  >
                    {topic === "Trending" ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
                        <path
                          d="M3 16l5-5 4 4 6-8 3 3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                    <span>{topic}</span>
                  </button>
                  {isDividerAfter ? <span className="ml-4 h-6 w-px bg-[#223547]" /> : null}
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 whitespace-nowrap px-2 font-semibold text-[#8fa4b7] transition hover:text-[#d6e2ef]"
              >
                <span>More</span>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                >
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {isExpanded && (
                <div className="absolute left-0 top-full z-50 mt-2 min-w-[160px] rounded-lg border border-[#1e2a36] bg-[#111b27] py-1 shadow-lg">
                  {TOPICS.slice(VISIBLE_TOPICS).map((topic) => {
                    const isActive = selectedTopic !== null && selectedTopic === topic.toLowerCase();
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => onTopicClick(topic)}
                        className={`w-full px-4 py-2 text-left font-semibold transition ${
                          isActive
                            ? "bg-[#1a2636] text-white"
                            : "text-[#8fa4b7] hover:bg-[#1a2636] hover:text-[#d6e2ef]"
                        }`}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
