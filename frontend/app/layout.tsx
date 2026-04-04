import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Finality",
  description:
    "Five-minute Up / Down markets on Vara testnet. Oracle-backed settlement via DIA + on-chain program.",
  icons: { icon: "/finalityLogo.png" }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-ink font-sans text-mist antialiased" suppressHydrationWarning>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
