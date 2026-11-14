/**
 * /data/lahti/en/daily.json — the city's whole pool of daily tasks with the texts of one
 * language. A static file: the browser fetches it after the page has loaded and picks today's
 * tasks itself (src/lib/daily.ts), because a static build can't know the date. Keeping the
 * pool out of the pages means a few hundred task texts are not in every page's HTML.
 * TODO: goes away when the backend serves GET /api/cities/:city/daily (API.md).
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCities, loadDailyPool } from '../../../../lib/content';
import type { City } from '../../../../lib/schema';

export const getStaticPaths = (async () => {
  const cities = await getCities();
  return cities.flatMap((city) =>
    city.languages.map((lang) => ({ params: { city: city.id, lang }, props: { city, lang } }))
  );
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { city, lang } = props as { city: City; lang: string };
  return new Response(JSON.stringify(await loadDailyPool(city, lang)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
