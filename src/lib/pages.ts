export const INFO_PAGES = ['students', 'living', 'meet'] as const;
// Account pages (login, register): one React form island each, not in the nav bar.
export const AUTH_PAGES = ['login', 'register'] as const;
export const PAGES = ['home', 'progress', ...INFO_PAGES, ...AUTH_PAGES] as const;

export type PageId = (typeof PAGES)[number];
export type InfoPageId = (typeof INFO_PAGES)[number];
export type AuthPageId = (typeof AUTH_PAGES)[number];
/** Pages with an entry in the nav (site.json `ui.nav`). */
export type NavPageId = Exclude<PageId, AuthPageId>;

export const isInfoPage = (page: PageId): page is InfoPageId =>
  (INFO_PAGES as readonly string[]).includes(page);

export const isAuthPage = (page: PageId): page is AuthPageId =>
  (AUTH_PAGES as readonly string[]).includes(page);

/** Which city and language a page belongs to. The first language is the default. */
export type Locale = { city: string; lang: string; languages: string[] };

/**
 * Path after `/{city}/`, or undefined for the city home page.
 * The default language has no prefix: /lahti/living, /lahti/fi/living.
 */
export function pagePath(loc: Locale, page: PageId): string | undefined {
  const parts = [
    loc.lang === loc.languages[0] ? '' : loc.lang,
    page === 'home' ? '' : page,
  ].filter(Boolean);
  return parts.length ? parts.join('/') : undefined;
}

export function pageUrl(loc: Locale, page: PageId, hash?: string): string {
  const rest = pagePath(loc, page);
  return `/${loc.city}${rest ? `/${rest}` : ''}${hash ? `#${hash}` : ''}`;
}

/** Fills `{name}` placeholders in a content string. */
export const fmt = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
