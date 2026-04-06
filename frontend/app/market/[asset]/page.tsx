import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { MARKETS, marketBySlug } from "@/lib/markets";

const MarketConsole = dynamic(
  () => import("@/components/MarketConsole").then((mod) => mod.MarketConsole),
  { ssr: false }
);

export function generateStaticParams() {
  return MARKETS.map((m) => ({ asset: m.slug }));
}

export default function MarketPage({ params }: { params: { asset: string } }) {
  const m = marketBySlug(params.asset);
  if (!m) notFound();
  return (
    <>
      <Header />
      <MarketConsole market={m} />
    </>
  );
}
