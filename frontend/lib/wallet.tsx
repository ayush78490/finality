"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { VARA_WS } from "./config";
import { fetchFinBalance } from "./fin-balance";
import { isAdminWallet } from "./config";

type GearApiType = import("@gear-js/api").GearApi;

type Ctx = {
  api: GearApiType | null;
  account: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  finBalance: string | null;
  finBalanceError: string | null;
  finBalanceLoading: boolean;
  /** Returns formatted balance on success, or null. */
  refreshFinBalance: () => Promise<string | null>;
  /** Whether the connected wallet is the admin (market creator) */
  isAdmin: boolean;
};

const WalletContext = createContext<Ctx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [api, setApi] = useState<GearApiType | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [finBalance, setFinBalance] = useState<string | null>(null);
  const [finBalanceError, setFinBalanceError] = useState<string | null>(null);
  const [finBalanceLoading, setFinBalanceLoading] = useState(false);
  /** Last successful FIN read — kept on transient RPC failures so the header does not “go blank”. */
  const lastFinBalanceRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { GearApi } = await import("@gear-js/api");
      const a = await GearApi.create({ providerAddress: VARA_WS });
      if (!cancelled) setApi(a);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");
    await web3Enable("Finality");
    const accs = await web3Accounts();
    if (!accs[0]) throw new Error("No Polkadot-compatible account found.");
    setAccount(accs[0].address);
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setFinBalance(null);
    setFinBalanceError(null);
    lastFinBalanceRef.current = null;
  }, []);

  useEffect(() => {
    lastFinBalanceRef.current = null;
  }, [account]);

  const refreshFinBalance = useCallback(async (): Promise<string | null> => {
    if (!api || !account) {
      setFinBalance(null);
      setFinBalanceError(null);
      lastFinBalanceRef.current = null;
      return null;
    }
    setFinBalanceLoading(true);
    setFinBalanceError(null);
    try {
      let formatted: string | null = null;
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetchFinBalance(api, account);
          formatted = r.formatted;
          break;
        } catch (e) {
          lastErr = e;
          if (attempt === 0) await new Promise((r) => setTimeout(r, 450));
        }
      }
      if (formatted !== null) {
        setFinBalance(formatted);
        lastFinBalanceRef.current = formatted;
        return formatted;
      }
      throw lastErr ?? new Error("FIN balance fetch failed");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setFinBalanceError(msg);
      if (lastFinBalanceRef.current != null) {
        setFinBalance(lastFinBalanceRef.current);
      } else {
        setFinBalance(null);
      }
      return null;
    } finally {
      setFinBalanceLoading(false);
    }
  }, [api, account]);

  // Fetch once on connect, then keep polling every 30 s so balance stays fresh.
  useEffect(() => {
    void refreshFinBalance();
    const id = setInterval(() => void refreshFinBalance(), 30_000);
    return () => clearInterval(id);
  }, [refreshFinBalance]);

  const value = useMemo(
    () => ({
      api,
      account,
      connect,
      disconnect,
      finBalance,
      finBalanceError,
      finBalanceLoading,
      refreshFinBalance,
      isAdmin: isAdminWallet(account)
    }),
    [
      api,
      account,
      connect,
      disconnect,
      finBalance,
      finBalanceError,
      finBalanceLoading,
      refreshFinBalance
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("WalletProvider missing");
  return ctx;
}
