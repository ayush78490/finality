import dynamic from "next/dynamic";
import { Header } from "@/components/Header";

const ProfileConsole = dynamic(
  () => import("@/components/ProfileConsole").then((mod) => mod.ProfileConsole),
  { ssr: false }
);

export default function ProfilePage() {
  return (
    <>
      <Header />
      <ProfileConsole />
    </>
  );
}
