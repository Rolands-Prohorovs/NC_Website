
import { useEffect, useRef, useState } from 'react';
import '../style/landing.css';

type Copy = {
  club: string;
  xp: string;
  welcome: string;
  tagline: string;
  subtitle: string;
  checklistTitle: string;
  checklistHint: string;
  sectionTitle: string;
  cards: Record<string, { title: string; desc: string }>;
  topics?: Record<string, { label: string; body: string }[]>;
};

export type City = {
  id: string;
  name: string;
  languages: string[];
  stats: {
    xp: number;
    streak: number;
    checklistDays: number;
    done: number;
    total: number;
  };
  cards: { id: string; icon: string; tone: string }[];
  content: Record<string, Copy>;
};

export default function Landing({
  city,
  cities,
}: {
  city: City;
  cities: { id: string; name: string }[];
}) {
  const [lang, setLang] = useState(city.languages[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lang');
      if (saved && city.languages.includes(saved)) {
        setLang(saved);
      } else {
        setLang(city.languages[0]);
      }
    } catch {
      setLang(city.languages[0]);
    }
  }, [city]);

  useEffect(() => {
    document.documentElement.lang = lang;

    try {
      localStorage.setItem('lang', lang);
    } catch {
      // Local storage may be unavailable.
    }
  }, [lang]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const handleOutsideClick = (event: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsideClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [menuOpen]);

  const t = city.content[lang];
  const s = city.stats;

  const title = t.checklistTitle
    .replace('{days}', String(s.checklistDays))
    .replace('{done}', String(s.done))
    .replace('{total}', String(s.total));

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="top">
        <div className="inner top-inner">
          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="hamburger-icon" aria-hidden="true">
              {menuOpen ? '✕' : '☰'}
            </span>
          </button>

          <span className="brand">⚙️ {t.club}</span>

          <div className="right">
            <div className="langs" role="group" aria-label="Language">
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
            <span className="pill xp">
              🌱 {s.xp} {t.xp}
            </span>
            <span className="pill streak">🔥 {s.streak}</span>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="menu-layer">
          <button
            className="menu-backdrop"
            type="button"
            aria-label="Close navigation menu"
            onClick={closeMenu}
          />

          <nav
            id="site-menu"
            ref={menuRef}
            className="site-menu"
            aria-label="Main navigation"
          >
            <div className="menu-heading">
              <div>
                <strong>{t.club}</strong>
                <small>{city.name}</small>
              </div>

              <button
                type="button"
                className="menu-close"
                aria-label="Close navigation menu"
                onClick={closeMenu}
              >
                ✕
              </button>
            </div>

            <a className="menu-link" href={`/${city.id}`} onClick={closeMenu}>
              <span aria-hidden="true">🏠</span>
              Home
            </a>
            <a className="menu-link" href={`/${city.id}/tasks`} onClick={closeMenu}>
              <span aria-hidden="true">📋</span>
              Tasks
            </a>
            <a className="menu-link" href={`/${city.id}/apps`} onClick={closeMenu}>
              <span aria-hidden="true">📱</span>
              Apps
            </a>
            <a className="menu-link" href={`/${city.id}/info`} onClick={closeMenu}>
              <span aria-hidden="true">ℹ️</span>
              Info
            </a>
            
            {/* <a
              className="menu-link"
              href="#checklist"
              onClick={closeMenu}
            >
              <span aria-hidden="true">☑️</span>
              {title}
            </a> */}

            {/* <div className="menu-progress">
              <div className="menu-progress-label">
                <span>{s.done} / {s.total} tasks completed</span>
                <span>{Math.round((s.total > 0 ? s.done / s.total : 0) * 100)}%</span>
              </div>
              <div className="menu-progress-track">
                <div
                  className="menu-progress-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      s.total > 0 ? (s.done / s.total) * 100 : 0
                    )}%`,
                  }}
                />
              </div>
            </div> */}

            {/* <div className="menu-section">
              <span className="menu-label">EXPLORE</span>

              {city.cards.map((c) => (
                <a
                  key={c.id}
                  className="menu-link"
                  href={`/${city.id}/${c.id}`}
                  onClick={closeMenu}
                >
                  <span aria-hidden="true">{c.icon}</span>
                  {t.cards[c.id]?.title ?? c.id}
                </a>
              ))}
            </div> */}

            <div className="menu-section">
              <span className="menu-label">LANGUAGE</span>

              <div className="menu-languages">
                {city.languages.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setLang(l);
                      closeMenu();
                    }}
                    aria-pressed={l === lang}
                  >
                    {l.toUpperCase()}
                    {l === lang ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-section">
              <span className="menu-label">CITY</span>

              {cities.map((c) => (
                <a
                  key={c.id}
                  className="menu-link"
                  href={`/${c.id}`}
                  aria-current={c.id === city.id ? 'page' : undefined}
                  onClick={closeMenu}
                >
                  <span aria-hidden="true">
                    {c.id === city.id ? '●' : '○'}
                  </span>
                  {c.name}
                </a>
              ))}
            </div>

            <div className="menu-stats">
              <span>🌱 {s.xp} {t.xp}</span>
              <span>🔥 {s.streak}</span>
            </div>
          </nav>
        </div>
      )}

      <section className="hero">
        <div className="inner">
          <h1>
            {t.welcome}
            <span>{t.tagline}</span>
          </h1>

          <p>{t.subtitle}</p>

          <a className="checklist" id="checklist" href="#checklist">
            <span className="check-icon" aria-hidden="true">☑</span>

            <span className="check-text">
              <strong>{title}</strong>
              <small>{t.checklistHint}</small>
            </span>

            <span
              className="bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={s.total}
              aria-valuenow={s.done}
            >
              <i
                style={{
                  width: `${Math.min(
                    100,
                    s.total > 0 ? (s.done / s.total) * 100 : 0
                  )}%`,
                }}
              />
            </span>
          </a>
        </div>
      </section>

      <main className="inner">
        <h2 className="section-title">{t.sectionTitle}</h2>

        <div className="grid">
          {city.cards.map((c) => (
            <a
              key={c.id}
              className="card"
              data-tone={c.tone}
              href={`/${city.id}/${c.id}`}
            >
              <span
                className={`icon${
                  c.icon.length === 2 && /^[A-Z]+$/.test(c.icon)
                    ? ' text'
                    : ''
                }`}
              >
                {c.icon}
              </span>

              <h3>{t.cards[c.id].title}</h3>
              <p>{t.cards[c.id].desc}</p>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
