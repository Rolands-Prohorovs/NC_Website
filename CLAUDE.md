# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Newcomer guide website for Rotary Club Lahti International, starting with Lahti (Lahti Lab/LUT) as the first city. The key design goal is that adding a new city/university should require as little code as possible — ideally just a new content folder. Must be fully mobile responsive.

## Commands

Requires Node >= 22.12.0.

- `npm run dev` — dev server at `localhost:4321`
- `npm run build` — static build to `./dist/`
- `npm run preview` — preview the build

There is no test suite or linter. `npm run build` is the main correctness check: it validates every content file against the schema and renders every page of every city in every language. TypeScript is not a project dependency; to type-check run `npx astro sync` then `npx -p typescript tsc --noEmit -p .`.

## Content

All text lives in `src/content/<city>/`, loaded as Astro content collections (`src/content.config.ts`):

```
src/content/lahti/city.json           name, clubUrl, languages (first = default), stats, to-do tasks, daily tiers
src/content/lahti/daily.json          pool of daily tasks: id + tier only
src/content/lahti/<lang>/site.json    strings used on every page (club, nav, menu labels)
src/content/lahti/<lang>/home.json
src/content/lahti/<lang>/progress.json
src/content/lahti/<lang>/daily.json   text of every daily task, keyed by id
src/content/lahti/<lang>/{students,living,meet}.json
```

- Schemas are in `src/lib/schema.ts` and are strict: unknown keys fail the build. When adding a field, add it to the schema and to every language's file. Component prop types are inferred from these schemas (`HomeCopy`, `InfoCopy`, ...).
- `src/lib/content.ts` loads entries; a missing file throws with the expected path, and `loadProgress` checks that every task/group in `city.json` has text in `progress.json`.
- Info-page topics use the short format (ROADMAP.md "Content format"): `summary`, then `steps` (numbered) or `facts` (bullets, max 5), optional chips `need`/`cost`/`time`, and `source` + `checked` (YYYY-MM-DD), rendered by `TopicContent.astro`. A topic with a `summary` must have a `source`, so the build enforces D10. `body` is for longer text only; blank lines (`\n\n`) split paragraphs. Every topic needs a `summary`, `body` or `sections`: there are no "coming soon" placeholders, so an unwritten topic stays out of the file.
- `links` entries are either external (`{ label, url }`, opens in a new tab) or another page of the site (`{ label, page, topic? }`). `topic` is the target topic's optional `id`; `loadInfo` in `content.ts` fails the build if no topic has that id.
- Daily tasks (D16): `city.json` `daily` holds the XP of each tier (`easy`/`medium`/`hard`) and how many of each are offered per day; a task is just `{ id, tier }`. `loadDailyPool` fails the build if a task lacks text in any language. To add or replace tasks in bulk, fill a CSV with the columns `id,tier,en_label,en_hint,fi_label,fi_hint` (template: `scripts/daily-placeholder.csv`) and run `node scripts/import-daily.mjs tasks.csv` (merges by id; `--replace` makes the pool exactly the CSV, `--city <id>` for another city), then `npm run build`. Ids starting `placeholder-` are stand-ins to be replaced.
- UI strings are per city (not shared) because Finnish inflects place names (Lahti → Lahdessa), so `{city}` templating doesn't work.

## Routing

A single route, `src/pages/[city]/[...path].astro`, generates all pages from `getStaticPaths()` over cities × languages × `PAGES` (`src/lib/pages.ts`). The default language has no prefix (`/lahti/living`); others do (`/lahti/fi/living`). Always build links with `pageUrl(loc, page)` from `src/lib/pages.ts`. `src/pages/index.astro` redirects to `/lahti`. Language switching is plain links, not client state.

## Rendering

- `src/layouts/Site.astro` wraps every city page: `Base.astro` (html `lang`, hreflang alternates, fonts, global CSS) + `Header` island + footer.
- Info pages (`InfoPage.astro`) are static Astro with no JS; topics use `<details>`.
- React islands (`client:load`): `Header`, `Home`, `Progress`. Each receives only its own slice of content as props.
- Checklist progress is shared across islands via a module-level store in `src/lib/progress.ts` (`useProgress`, `useSyncExternalStore`) persisted to `localStorage` key `progress:<cityId>`. Daily-task ticks and the XP earned from them are in `daily:<cityId>` (`useDaily`).
- Today's daily tasks are not in the HTML: the build can't know the date. `useDaily` fetches the pool for the page's language from the static endpoint `src/pages/data/[city]/[lang]/daily.json.ts` after hydration and picks today's with `pickDaily` (`src/lib/daily.ts`, a pure function the backend will take over; the same algorithm is written out in API.md). `DailyTasks.tsx` renders them. Level maths is in `src/lib/level.ts`. Home's stage picker uses `stage:<cityId>`. All are TODO to move to a PostgreSQL-backed API.
- The streak is read only through `useStreak()` in `src/lib/streak.ts`, which returns 0 until the backend provides it (API.md "Progress"); at 0 the UI shows `ui.streakStart` instead of a number.
- XP = to-do task XP + daily task XP (`useProgress().xp`). The league on the Progress page (`src/lib/league.ts`, `useLeague`) ranks users by it; until the backend has the endpoint it shows invented `MOCK_PLAYERS` plus the logged-in user, behind `USE_MOCK_API` from `src/lib/auth.ts`.

**Styling.** Single global stylesheet `src/style/site.css`. Components use plain class names, no CSS modules or framework.

## Planning files

`ROADMAP.md` holds the phases, dates and task split (Rolands: frontend, Timofei: backend + DB). `DECISIONS.md` holds the decisions made and the open ones. `SOURCES.md` lists every content source; log new ones there. `API.md` is the draft API contract with the backend. Read ROADMAP.md and DECISIONS.md before planning work, and follow the content format and automation rules in ROADMAP.md.
