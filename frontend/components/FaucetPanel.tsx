"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/lib/wallet";
import {
  FIN_DECIMALS,
  FIN_PROGRAM_ID,
  MARKET_PROGRAM_ID
} from "@/lib/config";
import { fetchFinBalance } from "@/lib/fin-balance";
import { submitFaucetClaim } from "@/lib/faucet-submit";

const FAUCET_AMOUNT = "100";

const FAUCET_AMOUNT_BASE =
  BigInt(FAUCET_AMOUNT) * 10n ** BigInt(FIN_DECIMALS);

const CLAIM_OK_FRACTION = 95n;

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const pulseAnimation = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  }
};

export function FaucetPanel() {
  const { account, api, connect, refreshFinBalance } = useWallet();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onClaim = useCallback(async () => {
    setError(null);
    setSuccess(null);
    if (!api || !account) {
      setError("Connect your wallet first.");
      return;
    }
    if (!MARKET_PROGRAM_ID) {
      setError("Market program id is not configured.");
      return;
    }
    setPending(true);
    try {
      const { raw: beforeRaw } = await fetchFinBalance(api, account);
      await submitFaucetClaim({ api, account });

      const minIncrease = (FAUCET_AMOUNT_BASE * CLAIM_OK_FRACTION) / 100n;
      let afterRaw = beforeRaw;
      for (let i = 0; i < 18; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 800 : 1500));
        afterRaw = (await fetchFinBalance(api, account)).raw;
        await refreshFinBalance();
        if (afterRaw >= beforeRaw + minIncrease) break;
      }

      if (afterRaw < beforeRaw + minIncrease) {
        setError(
          [
            "The extrinsic was included in a block, but your FIN balance did not increase — the program handle likely failed after inclusion.",
            "Most common fix: run Fin.init on this market program (admin). From the repo: cd backend/finality-oracle, set BOOTSTRAP_MNEMONIC, RELAYER_MNEMONIC, and MARKET_PROGRAM_ID in .env, then npm run bootstrap. See docs/TESTNET.md.",
            `Confirm with: npm run faucet:diagnose -- <your SS58> (repo root). If treasury is empty, run npx tsx scripts/check-market-treasury.ts.`
          ].join("\n\n")
        );
        return;
      }

      setSuccess(
        `${FAUCET_AMOUNT} FIN has been sent to your wallet! You can now trade on any market.`
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("cooldown")) {
        setError(
          "You already claimed FIN in the last 24 hours. Please try again later."
        );
      } else if (msg.includes("treasury") || msg.includes("transfer failed")) {
        setError(
          "The market program's FIN treasury is empty. An admin must send FIN to the market program on the FIN token contract."
        );
      } else if (msg.includes("not initialized")) {
        setError(
          "This market program was never initialized (Fin.init). Run Finality Oracle bootstrap or init it in Gear IDEA."
        );
      } else {
        setError(msg);
      }
    } finally {
      setPending(false);
    }
  }, [api, account, refreshFinBalance]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-ink via-panel to-ink" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ember/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-shore/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>
      
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="relative mx-auto max-w-xl px-4 py-12 sm:py-20"
      >
        <motion.div 
          variants={fadeInUp}
          className="text-center mb-10"
        >
          <motion.div
            variants={pulseAnimation}
            className="inline-flex items-center justify-center w-24 h-24 mb-6 rounded-3xl border border-ember/30 bg-gradient-to-br from-ember/20 to-ember/5 shadow-lg shadow-ember/10"
          >
            <div className="relative w-14 h-14">
              <Image
                src="/finalityLogo.png"
                alt="Finality"
                fill
                className="object-contain"
              />
            </div>
          </motion.div>
          
          <h1 className="font-display text-4xl sm:text-5xl text-white mb-3 tracking-tight">
            FIN <span className="text-ember">Faucet</span>
          </h1>
          <p className="text-mist/80 text-sm sm:text-base max-w-md mx-auto">
            Claim free FIN tokens to start trading on Finality markets. 
            Available once every 24 hours.
          </p>
        </motion.div>

        <motion.div 
          variants={fadeInUp}
          className="rounded-3xl border border-line/60 bg-panel/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/20"
        >
          <motion.div variants={fadeInUp} className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-white">Claim Amount</div>
                <p className="text-mist/60 text-sm mt-1">Once every 24 hours</p>
              </div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="rounded-2xl border border-ember/30 bg-gradient-to-br from-ember/20 to-ember/5 px-6 py-3 text-center"
              >
                <div className="text-3xl font-bold text-ember">{FAUCET_AMOUNT}</div>
                <div className="text-xs text-ember/70">FIN</div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="space-y-4 mb-8">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-ink/50 border border-line/40">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-shore/20 text-shore text-sm font-bold">1</div>
              <span className="text-mist text-sm">Connect your <strong className="text-white">wallet</strong> on Vara Testnet</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-ink/50 border border-line/40">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-shore/20 text-shore text-sm font-bold">2</div>
              <span className="text-mist text-sm">Click <strong className="text-white">Claim</strong> and approve in wallet</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-ink/50 border border-line/40">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-shore/20 text-shore text-sm font-bold">3</div>
              <span className="text-mist text-sm">Start trading on <Link href="/" className="text-ember">markets</Link></span>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {!account ? (
              <motion.div
                key="connect"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => connect().catch(console.error)}
                  className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-ember to-[#f6c177] px-6 py-4 text-base font-semibold text-ink shadow-lg shadow-ember/20 transition-all hover:shadow-xl hover:shadow-ember/30"
                >
                  Connect Wallet
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="claim"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <motion.button
                  whileHover={!pending ? { scale: 1.02 } : {}}
                  whileTap={!pending ? { scale: 0.98 } : {}}
                  type="button"
                  disabled={pending || !api || !MARKET_PROGRAM_ID}
                  onClick={() => void onClaim()}
                  className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-ember to-[#f6c177] px-6 py-4 text-base font-semibold text-ink shadow-lg shadow-ember/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                >
                  {pending ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="inline-block w-5 h-5 border-2 border-ink/30 border-t-ink rounded-full"
                      />
                      Claiming...
                    </span>
                  ) : `Claim ${FAUCET_AMOUNT} FIN`}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mt-4 whitespace-pre-line rounded-xl border border-risk/30 bg-risk/10 px-4 py-3 text-sm leading-relaxed text-risk"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mt-4 rounded-2xl border border-shore/30 bg-shore/10 px-4 py-4 text-sm"
              >
                <div className="flex items-center gap-2 text-shore font-semibold mb-2">
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5 }}
                    className="text-lg"
                  >
                    ✓
                  </motion.span>
                  Tokens Claimed!
                </div>
                <div className="text-mist/80 mb-3">{success}</div>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 text-ember font-medium hover:underline"
                >
                  Go to Markets
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div 
          variants={fadeInUp}
          className="mt-8 rounded-2xl border border-line/40 bg-panel/40 p-5"
        >
          <div className="text-sm font-semibold text-white mb-3">Token Details</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-mist/50 text-xs">Token</span>
              <span className="text-white font-medium">FIN</span>
            </div>
            <div className="flex flex-col">
              <span className="text-mist/50 text-xs">Network</span>
              <span className="text-white font-medium">Vara Testnet</span>
            </div>
            <div className="flex flex-col col-span-2">
              <span className="text-mist/50 text-xs">Program ID</span>
              <span className="text-white/70 font-mono text-xs break-all">{FIN_PROGRAM_ID}</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          variants={fadeInUp}
          className="mt-4 text-center"
        >
          <p className="text-mist/50 text-xs">
            Need VARA for gas? Get it from{" "}
            <a href="https://idea.gear-tech.io/programs?node=wss%3A%2F%2Ftestnet.vara.network" target="_blank" rel="noopener" className="text-ember hover:underline">Gear IDEA</a>
            {" "}or{" "}
            <a href="https://discord.gg/x8ZeSy6S6K" target="_blank" rel="noopener" className="text-ember hover:underline">Vara Discord</a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}