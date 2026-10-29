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
src/content/lahti/city.json           name, languages (first = default), stats, checklist tasks
src/content/lahti/<lang>/site.json    strings used on every page (club, nav, menu labels)
src/content/lahti/<lang>/home.json
src/content/lahti/<lang>/progress.json
src/content/lahti/<lang>/{students,living,meet}.json
```

- Schemas are in `src/lib/schema.ts` and are strict: unknown keys fail the build. When adding a field, add it to the schema and to every language's file. Component prop types are inferred from these schemas (`HomeCopy`, `InfoCopy`, ...).
- `src/lib/content.ts` loads entries; a missing file throws with the expected path, and `loadProgress` checks that every task/group in `city.json` has text in `progress.json`.
- In info-page text, blank lines (`\n\n`) split paragraphs. A topic with no `body`/`sections` renders as "coming soon".
- UI strings are per city (not shared) because Finnish inflects place names (Lahti → Lahdessa), so `{city}` templating doesn't work.

## Routing

A single route, `src/pages/[city]/[...path].astro`, generates all pages from `getStaticPaths()` over cities × languages × `PAGES` (`src/lib/pages.ts`). The default language has no prefix (`/lahti/living`); others do (`/lahti/fi/living`). Always build links with `pageUrl(loc, page)` from `src/lib/pages.ts`. `src/pages/index.astro` redirects to `/lahti`. Language switching is plain links, not client state.

## Rendering

- `src/layouts/Site.astro` wraps every city page: `Base.astro` (html `lang`, hreflang alternates, fonts, global CSS) + `Header` island + footer.
- Info pages (`InfoPage.astro`) are static Astro with no JS; topics use `<details>`.
- React islands (`client:load`): `Header`, `Home`, `Progress`. Each receives only its own slice of content as props.
- Checklist progress is shared across islands via a module-level store in `src/lib/progress.ts` (`useProgress`, `useSyncExternalStore`) persisted to `localStorage` key `progress:<cityId>`. Home's stage picker uses `stage:<cityId>`. Both are TODO to move to a PostgreSQL-backed API.

**Styling.** Single global stylesheet `src/style/site.css`. Components use plain class names, no CSS modules or framework.
