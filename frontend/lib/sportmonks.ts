const BASE_URL = "https://api.sportmonks.com/v3/football";
const TOKEN = process.env.SPORTMONKS_TOKEN!;

async function sportmonksFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("api_token", TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message ?? `SportMonks error: ${res.status}`);
  }

  return res.json();
}

export default sportmonksFetch;
