// Buduje spis Paczkomatów InPost do podpowiedzi w sklepie (miejscowości i kody) i zapisuje go
// jako publiczny plik public-data/inpost/index.json. Wywoływana raz w tygodniu przez bazę (pg_cron).
// Jeśli plik jest świeższy niż 6 dni, nic nie pobiera z InPost (bezpieczne do wywołania przez każdego).
import { createClient } from "npm:@supabase/supabase-js@2";

const API = "https://api-pl-points.easypack24.net/v1/points";
const BUCKET = "public-data";
const PATH = "inpost/index.json";
const MAX_AGE_MS = 6 * 24 * 3600 * 1000;

type Point = { name?: string; status?: string; address_details?: { city?: string } };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function page(n: number): Promise<{ items: Point[]; total_pages: number }> {
  const url = `${API}?type=parcel_locker&per_page=500&page=${n}&fields=name,status,address_details`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return await res.json();
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw new Error(`InPost: strona ${n} nie odpowiada`);
}

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Świeży spis już jest – nic nie rób
  const { data: files } = await supabase.storage.from(BUCKET).list("inpost", { search: "index.json" });
  const current = (files || []).find((f) => f.name === "index.json");
  const force = new URL(req.url).searchParams.get("force") === "1" && req.headers.get("x-force-key") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (current && !force && Date.now() - new Date(current.updated_at || current.created_at || 0).getTime() < MAX_AGE_MS) {
    return json({ skipped: true, updated_at: current.updated_at });
  }

  try {
    const first = await page(1);
    const pages = [first];
    const total = Math.min(first.total_pages || 1, 200);
    for (let n = 2; n <= total; n += 4) {
      const batch = await Promise.all([n, n + 1, n + 2, n + 3].filter((k) => k <= total).map(page));
      pages.push(...batch);
    }

    const cityIndex = new Map<string, number>();
    const cities: [string, number][] = [];   // [nazwa, liczba Paczkomatów]
    const lockers: [string, number][] = [];  // [kod, indeks miejscowości]
    for (const p of pages.flatMap((pg) => pg.items || [])) {
      if (!p.name || (p.status && p.status !== "Operating")) continue;
      const city = (p.address_details?.city || "").trim();
      if (!city) continue;
      let idx = cityIndex.get(city);
      if (idx === undefined) {
        idx = cities.length;
        cityIndex.set(city, idx);
        cities.push([city, 0]);
      }
      cities[idx][1]++;
      lockers.push([p.name, idx]);
    }
    if (lockers.length < 1000) throw new Error(`Za mało Paczkomatów (${lockers.length}) – nie nadpisuję spisu`);

    const body = JSON.stringify({ updated: new Date().toISOString(), cities, lockers });
    const { error } = await supabase.storage.from(BUCKET).upload(PATH, new Blob([body], { type: "application/json" }), {
      contentType: "application/json",
      upsert: true,
      cacheControl: "86400",
    });
    if (error) throw error;
    return json({ updated: true, cities: cities.length, lockers: lockers.length, kb: Math.round(body.length / 1024) });
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message || err) }, 502);
  }
});
