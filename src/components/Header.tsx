import { useEffect, useRef, useState } from 'react';
import { fmt, pageUrl, type Locale, type PageId } from '../lib/pages';
import { useProgress } from '../lib/progress';
import type { City, CityLink, SiteCopy } from '../lib/schema';

const NAV: { id: PageId; icon: string }[] = [
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
 * Language options are links to the same page in that language.
 */
export default function Header({ city, cities, current, loc, t }: Props) {
  const progress = useProgress(city.id, city.tasks, city.stats.xp);
  const url = (page: PageId) => pageUrl(loc, page);
  const urlIn = (lang: string) => pageUrl({ ...loc, lang }, current);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = () => setOpen(false);
  const streak = fmt(t.ui.streakDays, { n: city.stats.streak });

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
            ⚙️ {t.club}
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
