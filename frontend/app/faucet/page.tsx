import dynamic from "next/dynamic";
import { Header } from "@/components/Header";

const FaucetPanel = dynamic(
  () => import("@/components/FaucetPanel").then((mod) => mod.FaucetPanel),
  { ssr: false }
);

export default function FaucetPage() {
  return (
    <>
      <Header />
      <FaucetPanel />
    </>
  );
}
