import { Header } from "@/components/Header";
import { MarketGrid } from "@/components/MarketGrid";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <>
      <Header />
      <Suspense fallback={null}>
        <MarketGrid />
      </Suspense>
    </>
  );
}
