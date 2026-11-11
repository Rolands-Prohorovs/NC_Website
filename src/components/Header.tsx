import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useAuth } from '../lib/auth';
import { fmt, isAuthPage, pageUrl, type Locale, type NavPageId, type PageId } from '../lib/pages';
import { useProgress } from '../lib/progress';
import type { City, CityLink, SiteCopy } from '../lib/schema';

const NAV: { id: NavPageId; icon: string }[] = [
  { id: 'home', icon: '🏠' },
  { id: 'progress', icon: '📋' },
  { id: 'students', icon: '🎓' },
  { id: 'living', icon: '📍' },
  { id: 'meet', icon: '🤝' },
];

type Props = {
  city: City;
  cities: CityLink[];
  current: PageId;
  loc: Locale;
  t: SiteCopy;
};

/**
 * One header, two layouts (switched in CSS at 900px):
 *  - wide screens: inline nav bar, language switch, XP/streak pills
 *  - narrow screens: brand + burger button that opens a slide-out drawer
 * The account control (Log in, or the nickname with a small menu) is in the top bar on both.
 * Language options are links to the same page in that language.
 */
export default function Header({ city, cities, current, loc, t }: Props) {
  const progress = useProgress(city.id, city.tasks, city.stats.xp);
  const auth = useAuth();
  const loginRef = useRef<HTMLAnchorElement>(null);
  const focusLoginAfterLogout = useRef(false);
  // Come back to this page after logging in (not when already on an account page).
  const loginUrl = isAuthPage(current)
    ? pageUrl(loc, 'login')
    : `${pageUrl(loc, 'login')}?next=${encodeURIComponent(pageUrl(loc, current))}`;
  const url = (page: PageId) => pageUrl(loc, page);
  const urlIn = (lang: string) => pageUrl({ ...loc, lang }, current);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = () => setOpen(false);
  const streak = fmt(t.ui.streakDays, { n: city.stats.streak });

  const logout = async () => {
    focusLoginAfterLogout.current = true;
    const result = await auth.logout();
    if ('error' in result) console.warn('Logout failed', result.error);
  };

  // The account menu disappears on logout; put focus on the Log in link that replaces it.
  useEffect(() => {
    if (auth.user || !focusLoginAfterLogout.current) return;
    focusLoginAfterLogout.current = false;
    if (!open) loginRef.current?.focus();
  }, [auth.user, open]);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Close if the viewport grows to the desktop layout while open.
    const mq = window.matchMedia('(min-width: 900px)');
    const onChange = () => mq.matches && setOpen(false);

    document.addEventListener('keydown', onKey);
    mq.addEventListener('change', onChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onChange);
      toggleRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <header className="top">
        <div className="inner top-inner">
          <a className="brand" href={url('home')}>
            <img src="/rotary-logo.png" alt={t.club} width="335" height="82" />
          </a>

          <nav className="topbar" aria-label="Main">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={url(n.id)}
                aria-current={n.id === current ? 'page' : undefined}
              >
                {t.ui.nav[n.id]}
              </a>
            ))}
          </nav>

          <div className="right">
            <a className="pill pill-xp" href={url('progress')}>
              🌱 {progress.xp} {t.xp}
            </a>
            <a className="pill pill-streak" href={url('progress')} title={streak}>
              🔥 {city.stats.streak}
            </a>

            <div className="langs" role="group" aria-label={t.ui.language}>
              {city.languages.map((l) => (
                <a
                  key={l}
                  href={urlIn(l)}
                  hrefLang={l}
                  lang={l}
                  aria-current={l === loc.lang ? 'true' : undefined}
                >
                  {l.toUpperCase()}
                </a>
              ))}
            </div>

            {auth.user ? (
              <AccountMenu
                nickname={auth.user.nickname}
                progressHref={url('progress')}
                t={t}
                onLogout={logout}
              />
            ) : (
              <a
                ref={loginRef}
                className="account-login"
                href={loginUrl}
                aria-current={current === 'login' ? 'page' : undefined}
                // Hidden (but keeping its space) until we know whether someone is logged in.
                data-pending={auth.status === 'unknown' ? '' : undefined}
              >
                {t.ui.account.login}
              </a>
            )}

            <button
              ref={toggleRef}
              className="menu-toggle"
              type="button"
              aria-label={open ? t.ui.closeMenu : t.ui.openMenu}
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen((o) => !o)}
            >
              <span aria-hidden="true">{open ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="menu-layer">
          <button
            className="menu-backdrop"
            type="button"
            tabIndex={-1}
            aria-label={t.ui.closeMenu}
            onClick={close}
          />

          <nav
            id="site-menu"
            ref={drawerRef}
            className="site-menu"
            aria-label="Main navigation"
          >
            <div className="menu-heading">
              <div>
                <strong>{t.club}</strong>
                <small>{city.name}</small>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="menu-close"
                aria-label={t.ui.closeMenu}
                onClick={close}
              >
                ✕
              </button>
            </div>

            {NAV.map((n) => (
              <a
                key={n.id}
                className="menu-link"
                href={url(n.id)}
                aria-current={n.id === current ? 'page' : undefined}
                onClick={close}
              >
                <span aria-hidden="true">{n.icon}</span>
                {t.ui.nav[n.id]}
              </a>
            ))}

            <div className="menu-section">
              <span className="menu-label">{t.ui.language}</span>
              <div className="menu-languages">
                {city.languages.map((l) => (
                  <a
                    key={l}
                    href={urlIn(l)}
                    hrefLang={l}
                    lang={l}
                    aria-current={l === loc.lang ? 'true' : undefined}
                    onClick={close}
                  >
                    {l.toUpperCase()}
                    {l === loc.lang ? ' ✓' : ''}
                  </a>
                ))}
              </div>
            </div>

            <div className="menu-section">
              {auth.user ? (
                <>
                  <span className="menu-label">
                    {fmt(t.ui.account.loggedInAs, { nickname: auth.user.nickname })}
                  </span>
                  <button
                    type="button"
                    className="menu-link"
                    onClick={() => {
                      close();
                      void logout();
                    }}
                  >
                    <span aria-hidden="true">↩</span>
                    {t.ui.account.logout}
                  </button>
                </>
              ) : (
                <>
                  <a className="menu-link" href={loginUrl} onClick={close}>
                    <span aria-hidden="true">👤</span>
                    {t.ui.account.login}
                  </a>
                  <a
                    className="menu-link"
                    href={pageUrl(loc, 'register')}
                    aria-current={current === 'register' ? 'page' : undefined}
                    onClick={close}
                  >
                    <span aria-hidden="true">✚</span>
                    {t.ui.account.register}
                  </a>
                </>
              )}
            </div>

            {cities.length > 1 && (
              <div className="menu-section">
                <span className="menu-label">{t.ui.city}</span>
                {cities.map((c) => (
                  <a
                    key={c.id}
                    className="menu-link"
                    href={`/${c.id}`}
                    aria-current={c.id === city.id ? 'true' : undefined}
                    onClick={close}
                  >
                    <span aria-hidden="true">{c.id === city.id ? '●' : '○'}</span>
                    {c.name}
                  </a>
                ))}
              </div>
            )}

            <div className="menu-stats">
              <span>
                🌱 {progress.xp} {t.xp}
              </span>
              <span>🔥 {streak}</span>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

type AccountMenuProps = {
  nickname: string;
  progressHref: string;
  t: SiteCopy;
  onLogout: () => void;
};

/**
 * Logged-in control: a button with the nickname that opens a small menu (disclosure pattern:
 * plain links/buttons reached with Tab). Closes on Escape, outside click, or when focus leaves.
 */
function AccountMenu({ nickname, progressHref, t, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
  };

  return (
    <div className="account" ref={wrapRef} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        className="account-toggle"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">👤</span>
        <span className="sr-only">{t.ui.account.menu}: </span>
        <span className="account-name">{nickname}</span>
        <span className="account-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      <div id="account-menu" className="account-menu" hidden={!open}>
        <p className="account-who">{fmt(t.ui.account.loggedInAs, { nickname })}</p>
        <a href={progressHref}>{t.ui.nav.progress}</a>
        <button type="button" onClick={onLogout}>
          {t.ui.account.logout}
        </button>
        {/* TODO (Privacy page, ROADMAP Phase C): "Delete account" goes here.
            DELETE /api/me with { password } (API.md). Not built yet. */}
      </div>
    </div>
  );
}
