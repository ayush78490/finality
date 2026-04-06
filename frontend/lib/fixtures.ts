import sportmonksFetch from "./sportmonks";

export interface Participant {
  id: number;
  name: string;
  image_path: string;
  meta: { location: "home" | "away" };
}

export interface Fixture {
  id: number;
  name: string;
  league_id: number;
  season_id: number;
  state_id: number;
  starting_at: string;
  result_info: string;
  has_odds: boolean;
  participants: Participant[];
  league?: {
    id: number;
    name: string;
    image_path: string;
  };
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    count: number;
    per_page: number;
    current_page: number;
    has_more: boolean;
  };
}

function getDateRange(daysAhead: number): { from: string; to: string } {
  const from = new Date().toISOString().split("T")[0];
  const to = new Date(Date.now() + daysAhead * 86400000).toISOString().split("T")[0];
  return { from, to };
}

export async function getUpcomingFixtures(daysAhead = 7): Promise<Fixture[]> {
  const { from, to } = getDateRange(daysAhead);

  const res = await sportmonksFetch<PaginatedResponse<Fixture>>(
    `/fixtures/between/${from}/${to}`,
    { include: "participants;league", per_page: "50" }
  );

  return res.data.filter((f) => f.state_id === 1);
}

export async function getRecentResults(daysBack = 7): Promise<Fixture[]> {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];

  const res = await sportmonksFetch<PaginatedResponse<Fixture>>(
    `/fixtures/between/${from}/${to}`,
    { include: "participants;scores;state", per_page: "50" }
  );

  return res.data.filter((f) => f.state_id === 5);
}

export async function getFixtureById(id: number): Promise<Fixture> {
  const res = await sportmonksFetch<{ data: Fixture }>(
    `/fixtures/${id}`,
    { include: "participants;scores;state;league;venue;events" }
  );

  return res.data;
}

export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  const res = await sportmonksFetch<PaginatedResponse<Fixture>>(
    `/fixtures/date/${date}`,
    { include: "participants;scores;state" }
  );

  return res.data;
}
