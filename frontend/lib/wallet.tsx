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
import { isAdminWallet, normalizeVaraAddress } from "./config";

type GearApiType = import("@gear-js/api").GearApi;

type Ctx = {
  api: GearApiType | null;
  account: string | null;
  connect: (walletId?: string) => Promise<void>;
  disconnect: () => void;
  finBalance: string | null;
  finBalanceError: string | null;
  finBalanceLoading: boolean;
  refreshFinBalance: () => Promise<string | null>;
  isAdmin: boolean;
  isMobile: boolean;
  showWalletModal: boolean;
  setShowWalletModal: (show: boolean) => void;
};

const WalletContext = createContext<Ctx | null>(null);

type ExtensionAccount = {
  address: string;
  meta?: {
    name?: string;
    isSelected?: boolean;
    selected?: boolean;
    source?: string;
  };
  source?: string;
};

function accountDisplayName(acc: ExtensionAccount): string {
  const name = acc.meta?.name?.trim();
  if (name) return `${name} (${acc.address.slice(0, 8)}...${acc.address.slice(-6)})`;
  return acc.address;
}

function pickAccountInteractive(accounts: ExtensionAccount[]): ExtensionAccount | null {
  if (accounts.length === 0) return null;
  if (accounts.length === 1) return accounts[0];

  if (typeof window === "undefined") return accounts[0];

  const options = accounts
    .map((acc, idx) => `${idx + 1}. ${accountDisplayName(acc)}`)
    .join("\n");

  const input = window.prompt(
    `Select wallet account for Finality:\n\n${options}\n\nEnter account number:`,
    "1"
  );
  if (input === null) return null;

  const idx = Number.parseInt(input.trim(), 10);
  if (!Number.isFinite(idx) || idx < 1 || idx > accounts.length) {
    throw new Error("Invalid account selection.");
  }
  return accounts[idx - 1];
}

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || ("ontouchstart" in window && window.innerWidth < 1024);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [api, setApi] = useState<GearApiType | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [finBalance, setFinBalance] = useState<string | null>(null);
  const [finBalanceError, setFinBalanceError] = useState<string | null>(null);
  const [finBalanceLoading, setFinBalanceLoading] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const lastFinBalanceRef = useRef<string | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = isMobileDevice();
      setIsMobile(mobile);
    };
    checkMobile();
    setIsReady(true);
    
    const handleResize = () => checkMobile();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const normalizedAccount = useMemo(() => {
    if (!account) return null;
    return normalizeVaraAddress(account);
  }, [account]);

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

  const connect = useCallback(async (walletId?: string) => {
    try {
      // Check if running in a browser environment
      if (typeof window === "undefined") {
        throw new Error("Wallet connection requires a browser environment");
      }

      const { web3Enable, web3Accounts, web3FromSource } = await import("@polkadot/extension-dapp");
      
      const injected = await web3Enable("Finality");
      
      if (injected.length === 0) {
        throw new Error(
          isMobile 
            ? "No wallet found. Please install SubWallet, Nova Wallet, or another Polkadot-compatible mobile wallet."
            : "No Polkadot extension found. Please install SubWallet, Talisman, or Polkadot.js extension."
        );
      }
      
      const allAccounts = (await web3Accounts()) as ExtensionAccount[];
      
      let accounts = allAccounts;
      
      if (walletId && allAccounts.length > 0) {
        const filtered = allAccounts.filter(acc => {
          const source = acc.meta?.source || acc.source || "";
          const walletMap: Record<string, string[]> = {
            subwallet: ["subwallet", "SubWallet"],
            talisman: ["talisman", "Talisman"],
            polkadot: ["polkadot", "polkadot.js", "polkadot vault"],
            nova: ["nova", "Nova"],
          };
          const keywords = walletMap[walletId] || [walletId];
          return keywords.some(kw => source.toLowerCase().includes(kw.toLowerCase()));
        });
        
        if (filtered.length > 0) {
          accounts = filtered;
        }
      }

      if (accounts.length === 0) {
        throw new Error(
          isMobile 
            ? "No wallet accounts found. Please open this app from your mobile wallet's browser."
            : "No wallet accounts found. Please create an account in your wallet extension."
        );
      }

      const picked = pickAccountInteractive(accounts);
      if (!picked) return;

      const injector = await web3FromSource(picked.source || picked.meta?.source || "");
      if (injector) {
        (window as any).__injectedWeb3 = injector;
      }

      setAccount(picked.address);
      setShowWalletModal(false);
    } catch (error) {
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setFinBalance(null);
    setFinBalanceError(null);
    lastFinBalanceRef.current = null;
    (window as any).__injectedWeb3 = undefined;
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
      isAdmin: isAdminWallet(normalizedAccount),
      isMobile,
      showWalletModal,
      setShowWalletModal,
    }),
    [
      api,
      account,
      normalizedAccount,
      connect,
      disconnect,
      finBalance,
      finBalanceError,
      finBalanceLoading,
      refreshFinBalance,
      isMobile,
      showWalletModal,
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
