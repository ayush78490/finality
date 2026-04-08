import { NextResponse } from "next/server";
import { getUpcomingFixtures, getRecentResults } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [upcoming, recent] = await Promise.all([
      getUpcomingFixtures(7),
      getRecentResults(7),
    ]);

    return NextResponse.json({ upcoming, recent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
