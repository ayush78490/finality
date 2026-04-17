"use client";

import { useEffect, useState, useCallback } from "react";

type WalletInfo = {
  id: string;
  name: string;
  icon: string;
  installed?: boolean;
  getUrl?: (os: "ios" | "android") => string;
  extensionId?: string;
};

const WALLETS: WalletInfo[] = [
  {
    id: "subwallet",
    name: "SubWallet",
    icon: "/wallets/subwallet.svg",
    getUrl: (os) =>
      os === "ios"
        ? "https://apps.apple.com/app/subwallet/id1639708889"
        : "https://play.google.com/store/apps/details?id=app.subwallet.mobile",
  },
  {
    id: "talisman",
    name: "Talisman",
    icon: "/wallets/talisman.svg",
    getUrl: (os) =>
      os === "ios"
        ? "https://apps.apple.com/app/talisman-wallet/id6443694731"
        : "https://play.google.com/store/apps/details?id=com.talisman.wallet",
  },
  {
    id: "polkadot",
    name: "Polkadot Vault",
    icon: "/wallets/polkadot-vault.svg",
    getUrl: () => "https://parity.link/vault",
  },
  {
    id: "nova",
    name: "Nova Wallet",
    icon: "/wallets/nova.svg",
    getUrl: (os) =>
      os === "ios"
        ? "https://apps.apple.com/app/nova-polkadot-wallet/id1597859353"
        : "https://play.google.com/store/apps/details?id=com.novawallet.impl",
  },
];

function getMobileOS(): "ios" | "android" | "other" {
  if (typeof window === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
  if (ua.includes("android")) return "android";
  return "other";
}

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletId: string) => Promise<void>;
  connecting: boolean;
  error: string | null;
};

export function WalletModal({ isOpen, onClose, onConnect, connecting, error }: Props) {
  const [mobileOS, setMobileOS] = useState<"ios" | "android" | "other">("other");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMobileOS(getMobileOS());
    setIsMobile(isMobileDevice() || isTouchDevice());
  }, []);

  const handleWalletClick = useCallback(
    (wallet: WalletInfo) => {
      void onConnect(wallet.id);
    },
    [onConnect]
  );

  const handleOpenInApp = useCallback(
    (wallet: WalletInfo) => {
      if (mobileOS === "other") return;
      const url = wallet.getUrl?.(mobileOS);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [mobileOS]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl border border-[#243547] bg-[#111b26] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#243547]">
          <h2 className="text-lg font-semibold text-white">Connect Wallet</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#7f93a7] hover:text-white hover:bg-[#1e2f41] transition"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {isMobile && mobileOS !== "other" && (
            <div className="mb-4 p-3 rounded-xl bg-[#1a2636] border border-[#2d475f]">
              <p className="text-xs text-[#8ea4b8]">
                Open the wallet app on your {mobileOS === "ios" ? "iPhone/iPad" : "Android device"} and scan the QR code or use the connect button.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {WALLETS.map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                onClick={() => handleWalletClick(wallet)}
                disabled={connecting}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#243547] bg-[#0f1822] hover:bg-[#1a2636] hover:border-[#3d5a7a] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="relative h-10 w-10 rounded-lg bg-[#1e2f41] flex items-center justify-center overflow-hidden">
                  <WalletIcon walletId={wallet.id} />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-white">{wallet.name}</div>
                  <div className="text-[11px] text-[#7f93a7]">
                    {isMobile ? "Mobile wallet" : "Browser extension"}
                  </div>
                </div>
                {connecting ? (
                  <div className="h-5 w-5 rounded-full border-2 border-[#3d5a7a] border-t-[#79b8ff] animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#7f93a7]">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {isMobile && (
            <div className="mt-3 pt-3 border-t border-[#243547]">
              <p className="text-[11px] text-[#6f8296] text-center mb-2">
                Don&apos;t have a wallet app?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {WALLETS.filter(w => w.getUrl).map((wallet) => (
                  <button
                    key={`${wallet.id}-install`}
                    type="button"
                    onClick={() => handleOpenInApp(wallet)}
                    className="flex items-center justify-center gap-1 rounded-lg bg-[#1e2f41] px-2 py-1.5 text-[11px] text-[#8ea4b8] hover:bg-[#2d475f] hover:text-white transition"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" x2="12" y1="15" y2="3"/>
                    </svg>
                    {wallet.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-[#2a1a15] border border-[#e1775e]/30">
              <p className="text-xs text-[#e1775e]">{error}</p>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-[#243547]">
            <p className="text-[10px] text-[#6f8296] text-center leading-relaxed">
              By connecting, you agree to the Terms of Service. Your wallet private keys are never shared with this application.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WalletIcon({ walletId }: { walletId: string }) {
  const iconPaths: Record<string, string> = {
    subwallet: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    talisman: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    polkadot: "M12 2l9 5.25v9.5L12 22l-9-5.25v-9.5L12 2z",
    nova: "M12 2L2 12l10 10 10-10L12 2z",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 text-[#79b8ff]"
    >
      <path d={iconPaths[walletId] || "M12 2v20M2 12h20"} />
    </svg>
  );
}

export function useMobileWallet() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice() || isTouchDevice());
  }, []);

  return isMobile;
}
