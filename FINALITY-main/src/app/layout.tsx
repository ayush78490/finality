import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientWrapper } from "@/components/ClientWrapper";

// Force dynamic rendering to avoid SSR issues with wagmi
export const dynamic = 'force-dynamic';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finality — Where Markets Meet Truth",
  description: "Predict real-world outcomes with irreversible settlement and transparent resolution. A crypto-native prediction market platform.",
  keywords: ["prediction markets", "crypto", "web3", "defi", "betting", "forecasting"],
  authors: [{ name: "Finality" }],
  openGraph: {
    title: "Finality — Where Markets Meet Truth",
    description: "Predict real-world outcomes with irreversible settlement and transparent resolution.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}


