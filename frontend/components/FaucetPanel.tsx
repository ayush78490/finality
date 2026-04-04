"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import {
  FIN_DECIMALS,
  FIN_PROGRAM_ID,
  MARKET_PROGRAM_ID
} from "@/lib/config";
import { fetchFinBalance } from "@/lib/fin-balance";
import { submitFaucetClaim } from "@/lib/faucet-submit";

const FAUCET_AMOUNT = "100";

/** Expected claim size in base units (must match on-chain default / admin config). */
const FAUCET_AMOUNT_BASE =
  BigInt(FAUCET_AMOUNT) * 10n ** BigInt(FIN_DECIMALS);

/** Treat as success if balance increased by at least this fraction of the claim (rounding / RPC lag). */
const CLAIM_OK_FRACTION = 95n;

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
            "Most common fix: run Fin.init on this market program (admin). From the repo: cd services/dia-relayer, set BOOTSTRAP_MNEMONIC, RELAYER_MNEMONIC, and MARKET_PROGRAM_ID in .env, then npm run bootstrap. See docs/TESTNET.md.",
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
          "The market program’s FIN treasury is empty. An admin must send FIN to the market program on the FIN token contract."
        );
      } else if (msg.includes("not initialized")) {
        setError(
          "This market program was never initialized (Fin.init). Run dia-relayer bootstrap or init it in Gear IDEA."
        );
      } else {
        setError(msg);
      }
    } finally {
      setPending(false);
    }
  }, [api, account, refreshFinBalance]);

  return (
    <div className="mx-auto max-w-2xl px-3 sm:px-4 pb-14 sm:pb-20 pt-6 sm:pt-10">
      <div className="rounded-2xl sm:rounded-3xl border border-line bg-gradient-to-b from-panel to-ink/40 p-4 sm:p-6 md:p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 sm:h-16 sm:w-16 place-items-center rounded-xl sm:rounded-2xl border border-ember/30 bg-ember/10 text-2xl sm:text-3xl">
            💧
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-white">FIN Faucet</h1>
          <p className="mt-2 text-xs sm:text-sm text-mist/80">
            Claim <span className="font-semibold text-white">{FAUCET_AMOUNT} FIN</span> tokens
            for free — once every 24 hours — and start trading on Finality markets.
          </p>
        </div>

        <div className="mt-6 sm:mt-8 space-y-4">
          <div className="rounded-2xl border border-line bg-ink/40 p-4 sm:p-5">
            <div className="text-sm font-semibold text-white">How it works</div>
            <ol className="mt-3 space-y-3 text-sm text-mist/80">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ember/40 bg-ember/10 text-xs font-bold text-ember">
                  1
                </span>
                <span>
                  Connect your <strong className="text-white">SubWallet</strong> or any
                  Polkadot-compatible wallet. Make sure you&apos;re on the{" "}
                  <strong className="text-white">Vara Testnet</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ember/40 bg-ember/10 text-xs font-bold text-ember">
                  2
                </span>
                <span>
                  Click <strong className="text-white">Claim {FAUCET_AMOUNT} FIN</strong> below.
                  Approve the transaction in your wallet (small VARA gas fee applies).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ember/40 bg-ember/10 text-xs font-bold text-ember">
                  3
                </span>
                <span>
                  Once confirmed, your FIN balance updates in the header. Head to any{" "}
                  <Link href="/" className="text-ember underline-offset-2 hover:underline">
                    market
                  </Link>{" "}
                  and place your first trade!
                </span>
              </li>
            </ol>
          </div>

          <div className="rounded-2xl border border-line bg-ink/40 p-4 sm:p-5">
            <div className="text-sm font-semibold text-white">FIN Token Details</div>
            <div className="mt-3 space-y-2 text-xs text-mist/80">
              <div className="flex items-start justify-between gap-3">
                <span className="text-mist/60">Token name</span>
                <span className="font-mono text-white">FIN (Finality)</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-mist/60">Decimals</span>
                <span className="font-mono text-white">12</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0 text-mist/60">FIN program ID</span>
                <span className="break-all text-right font-mono text-white/80 text-[11px]">
                  {FIN_PROGRAM_ID}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0 text-mist/60">Market program ID</span>
                <span className="break-all text-right font-mono text-white/80 text-[11px]">
                  {MARKET_PROGRAM_ID || "Not set"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-mist/60">Network</span>
                <span className="font-mono text-white">Vara Testnet</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-mist/55">
              FIN is a Gear VFT (fungible token) program on Vara — it is <strong>not</strong> a
              native VARA token. Your FIN balance is tracked by the token program and displayed
              in the app header. SubWallet’s main balance is <strong>TVARA</strong> (gas); it does
              not show custom FIN unless you add the token asset. You need a small amount of{" "}
              <strong>VARA</strong> for gas on every transaction.
            </p>
          </div>

          <div className="rounded-2xl border border-ember/20 bg-ink/50 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Claim Tokens</div>
                <p className="mt-1 text-xs text-mist/70">
                  {FAUCET_AMOUNT} FIN per wallet, once every 24 hours.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-ink/40 px-3 py-2 text-center self-start sm:self-auto">
                <div className="text-xl font-bold text-ember">{FAUCET_AMOUNT}</div>
                <div className="text-[10px] text-mist/60">FIN</div>
              </div>
            </div>

            {!account ? (
              <button
                type="button"
                onClick={() => connect().catch(console.error)}
                className="mt-4 w-full cursor-pointer rounded-2xl bg-gradient-to-r from-ember to-[#f6c177] px-4 py-3 text-sm font-semibold text-ink"
              >
                Connect wallet to claim
              </button>
            ) : (
              <button
                type="button"
                disabled={pending || !api || !MARKET_PROGRAM_ID}
                onClick={() => void onClaim()}
                className="mt-4 w-full cursor-pointer rounded-2xl bg-gradient-to-r from-ember to-[#f6c177] px-4 py-3 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Claiming… (check wallet)" : `Claim ${FAUCET_AMOUNT} FIN`}
              </button>
            )}

            {error ? (
              <div className="mt-3 whitespace-pre-line rounded-xl border border-risk/30 bg-risk/10 px-3 py-2 text-xs leading-relaxed text-risk">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="mt-3 rounded-xl border border-shore/30 bg-shore/10 px-3 py-2 text-xs text-shore space-y-1">
                <div className="font-semibold">Tokens claimed ✓</div>
                <div className="text-shore/80">{success}</div>
                <Link
                  href="/"
                  className="mt-2 inline-block text-ember underline-offset-2 hover:underline"
                >
                  Go to markets →
                </Link>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-line bg-ink/40 p-4 sm:p-5">
            <div className="text-sm font-semibold text-white">Need VARA for gas?</div>
            <p className="mt-2 text-xs text-mist/80 leading-relaxed">
              Every transaction on Vara requires a small amount of <strong className="text-white">VARA</strong> (the native token) for gas.
              You can get testnet VARA from the{" "}
              <a
                href="https://idea.gear-tech.io/programs?node=wss%3A%2F%2Ftestnet.vara.network"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ember underline-offset-2 hover:underline"
              >
                Gear IDEA portal
              </a>{" "}
              — connect your wallet there and use the built-in faucet, or ask in the{" "}
              <a
                href="https://discord.gg/x8ZeSy6S6K"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ember underline-offset-2 hover:underline"
              >
                Vara Discord
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
