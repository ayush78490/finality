import { NextRequest, NextResponse } from "next/server";
import { getFixtureById, getUpcomingFixtures, getRecentResults } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const idsRaw = req.nextUrl.searchParams.get("ids") ?? "";
    const ids = idsRaw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);

    if (ids.length > 0) {
      const details = await Promise.all(ids.map((id) => getFixtureById(id).catch(() => null)));
      const fixtures = details.filter((f): f is NonNullable<typeof f> => !!f);
      return NextResponse.json({ fixtures });
    }

    const [upcoming, recent] = await Promise.all([getUpcomingFixtures(7), getRecentResults(7)]);

    const merged = [...upcoming, ...recent];
    const seen = new Set<number>();
    const fixtures = merged.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return ids.length === 0 || ids.includes(f.id);
    });

    return NextResponse.json({ fixtures });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
