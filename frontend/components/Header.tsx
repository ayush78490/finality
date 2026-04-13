"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet";

export function Header() {
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
    <header className="sticky top-0 z-50 bg-transparent transition-colors duration-300">
      <div className="mx-auto flex w-full max-w-[1300px] items-center justify-between px-6 py-5 sm:px-8">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 no-underline">
          <div className="relative h-8 w-8 overflow-hidden rounded bg-transparent">
            <Image
              src="/finalityLogo.png"
              alt="Finality"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-[17px] font-bold text-white tracking-wide">
            Finality
          </span>
        </Link>

        {/* Center: Main Nav Pill */}
        <nav className="hidden rounded-full border border-line/60 bg-panel/60 px-2 py-1.5 backdrop-blur-md md:flex items-center gap-1">
          <Link href="/" className="rounded-full px-5 py-1.5 text-[13px] font-medium text-mist transition hover:text-white">
            Home
          </Link>
          <Link
            href="/markets"
            className={`flex items-center gap-2 rounded-full px-5 py-1.5 text-[13px] font-medium transition ${
              pathname === "/markets"
                ? "bg-line text-white"
                : "text-mist hover:bg-line/50 hover:text-white"
            }`}
          >
            {pathname === "/markets" && <div className="h-1.5 w-1.5 rounded-full bg-shore"></div>}
            Markets
          </Link>
          <Link href="/faucet" className={`rounded-full px-5 py-1.5 text-[13px] font-medium transition ${pathname === "/faucet" ? "text-white" : "text-mist hover:text-white"}`}>
            Faucet
          </Link>
          <Link href="/profile" className={`rounded-full px-5 py-1.5 text-[13px] font-medium transition ${pathname === "/profile" ? "text-white" : "text-mist hover:text-white"}`}>
            Profile
          </Link>
          {isAdmin && (
            <Link href="/admin" className={`rounded-full px-5 py-1.5 text-[13px] font-medium transition ${pathname === "/admin" ? "text-white" : "text-mist hover:text-white"}`}>
              Admin
            </Link>
          )}
        </nav>

        {/* Right: Controls & Wallet */}
        <div className="flex items-center gap-4">
          <div className="hidden cursor-pointer items-center gap-1 text-[13px] font-medium text-mist sm:flex transition hover:text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Eng
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>

          {account ? (
            <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-1 py-1">
              <Link
                href="/profile"
                className="grid h-7 w-7 place-items-center rounded-full bg-line/80 text-[11px] font-bold text-shore"
              >
                {account.slice(2, 4).toUpperCase()}
              </Link>
              <div className="hidden sm:block h-4 w-px bg-line" />
              <button
                type="button"
                onClick={() => refreshFinBalance().catch(console.error)}
                className="hidden sm:block text-[13px] pr-2"
              >
                {finBalanceLoading ? (
                  <span className="text-mist">...</span>
                ) : finBalanceError ? (
                  <span className="text-red-400">Err</span>
                ) : (
                  <span className={`font-medium text-white ${flash ? "text-shore" : ""}`}>
                    {finBalance ?? "-"} FIN
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={disconnect}
                className="rounded-full px-3 py-1 text-[12px] font-medium text-mist hover:text-white hover:bg-line/50 transition"
              >
                Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => connect().catch(console.error)}
              className="rounded-full border border-line bg-panel/60 px-5 py-1.5 text-[13px] font-medium text-mist transition hover:bg-line hover:text-white whitespace-nowrap"
            >
              Login / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
}