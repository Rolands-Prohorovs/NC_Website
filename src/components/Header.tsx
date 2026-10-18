import { useEffect, useRef, useState } from 'react';
import { fmt, useSite } from './Shell';
import type { PageId } from './types';

const NAV: { id: PageId; icon: string; path: string }[] = [
  { id: 'home', icon: '🏠', path: '' },
  { id: 'progress', icon: '📋', path: '/progress' },
  { id: 'students', icon: '🎓', path: '/students' },
  { id: 'living', icon: '📍', path: '/living' },
  { id: 'meet', icon: '🤝', path: '/meet' },
];

/**
 * One header, two layouts (switched in CSS at 900px):
 *  - wide screens: inline nav bar, language switch, XP/streak pills
 *  - narrow screens: brand + burger button that opens a slide-out drawer
 */
export default function Header() {
  const { city, cities, current, lang, setLang, t, progress } = useSite();
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
          <a className="brand" href={`/${city.id}`}>
            ⚙️ {t.club}
          </a>

          <nav className="topbar" aria-label="Main">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`/${city.id}${n.path}`}
                aria-current={n.id === current ? 'page' : undefined}
              >
                {t.ui.nav[n.id]}
              </a>
            ))}
          </nav>

          <div className="right">
            <a className="pill pill-xp" href={`/${city.id}/progress`}>
              🌱 {progress.xp} {t.xp}
            </a>
            <a className="pill pill-streak" href={`/${city.id}/progress`} title={streak}>
              🔥 {city.stats.streak}
            </a>

            <div className="langs" role="group" aria-label={t.ui.language}>
              {city.languages.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={l === lang}
                >
                  {l.toUpperCase()}
                </button>
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
                href={`/${city.id}${n.path}`}
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
                  <button
                    key={l}
                    type="button"
                    aria-pressed={l === lang}
                    onClick={() => {
                      setLang(l);
                      close();
                    }}
                  >
                    {l.toUpperCase()}
                    {l === lang ? ' ✓' : ''}
                  </button>
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
