import deployed from "../../config/deployed.token.json";
import oracleCfg from "../../config/oracle.config.json";

export const VARA_WS =
  process.env.NEXT_PUBLIC_VARA_WS ?? "wss://testnet.vara.network";

const CANONICAL_MARKET_PROGRAM_ID = oracleCfg.marketProgramId as string;
const envMarket = process.env.NEXT_PUBLIC_MARKET_PROGRAM_ID?.trim();

/**
 * Admin wallet address - market creator. Used to show created markets in profile.
 */
export const ADMIN_WALLET = (oracleCfg.adminWallet as string) || "";

/**
 * Market program id for `Fin.FaucetClaim` / trading. Source of truth is `config/oracle.config.json`.
 * A typo in `NEXT_PUBLIC_MARKET_PROGRAM_ID` sends messages to the wrong program (failed txs, red dot in Gear IDEA).
 */
export const MARKET_PROGRAM_ID =
  envMarket && envMarket.toLowerCase() !== CANONICAL_MARKET_PROGRAM_ID.toLowerCase()
    ? CANONICAL_MARKET_PROGRAM_ID
    : envMarket || CANONICAL_MARKET_PROGRAM_ID;

if (
  typeof window !== "undefined" &&
  envMarket &&
  envMarket.toLowerCase() !== CANONICAL_MARKET_PROGRAM_ID.toLowerCase()
) {
  console.warn(
    "[Finality] Ignoring NEXT_PUBLIC_MARKET_PROGRAM_ID (does not match config/oracle.config.json).",
    { ignored: envMarket, using: CANONICAL_MARKET_PROGRAM_ID }
  );
}

/**
 * FIN token program id — **only** from `config/deployed.token.json` (same token the market
 * program uses as `FIN_TOKEN_PROGRAM`). Do not use `NEXT_PUBLIC_FIN_PROGRAM_ID`; a typo there
 * made the header show 0 FIN after a successful faucet claim.
 */
export const FIN_PROGRAM_ID = deployed.varaTestnet.finTokenProgramId as string;

/** Base units per 1 FIN (matches on-chain FIN decimals). */
export const FIN_DECIMALS = 12;

export const DIA_API =
  process.env.NEXT_PUBLIC_DIA_API ?? "https://api.diadata.org";

/**
 * Check if a wallet address is the admin (market creator)
 */
export function isAdminWallet(address: string | null): boolean {
  if (!address || !ADMIN_WALLET) return false;
  return address.toLowerCase() === ADMIN_WALLET.toLowerCase();
}
