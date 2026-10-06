import { useEffect, useState } from 'react';
import '../style/landing.css';

type Copy = {
  club: string; xp: string; welcome: string; tagline: string; subtitle: string;
  checklistTitle: string; checklistHint: string; sectionTitle: string;
  cards: Record<string, { title: string; desc: string }>;
};
export type City = {
  id: string; name: string; languages: string[];
  stats: { xp: number; streak: number; checklistDays: number; done: number; total: number };
  cards: { id: string; icon: string; tone: string }[];
  content: Record<string, Copy>;
};

export default function Landing({ city, cities }: { city: City; cities: { id: string; name: string }[] }) {
  const [lang, setLang] = useState(city.languages[0]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lang');
      if (saved && city.languages.includes(saved)) setLang(saved);
    } catch {}
  }, [city]);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem('lang', lang); } catch {}
  }, [lang]);

  const t = city.content[lang];
  const s = city.stats;
  const title = t.checklistTitle
    .replace('{days}', String(s.checklistDays))
    .replace('{done}', String(s.done))
    .replace('{total}', String(s.total));

  return (
    <>
      <header className="top">
        <div className="inner">
          <span className="brand">⚙️ {t.club}</span>
          <nav className="cities" aria-label="City">
            {cities.map((c) => (
              <a key={c.id} href={`/${c.id}`} aria-current={c.id === city.id ? 'page' : undefined}>{c.name}</a>
            ))}
          </nav>
          <div className="right">
            <div className="langs" role="group" aria-label="Language">
              {city.languages.map((l) => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={l === lang}>{l.toUpperCase()}</button>
              ))}
            </div>
            <span className="pill xp">🌱 {s.xp} {t.xp}</span>
            <span className="pill streak">🔥 {s.streak}</span>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="inner">
          <h1>
            {t.welcome}
            <span>{t.tagline}</span>
          </h1>
          <p>{t.subtitle}</p>
          <a className="checklist" href="#checklist">
            <span className="check-icon" aria-hidden="true">☑</span>
            <span className="check-text">
              <strong>{title}</strong>
              <small>{t.checklistHint}</small>
            </span>
            <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={s.total} aria-valuenow={s.done}>
              <i style={{ width: `${(s.done / s.total) * 100}%` }} />
            </span>
          </a>
        </div>
      </section>

      <main className="inner">
        <h2 className="section-title">{t.sectionTitle}</h2>
        <div className="grid">
          {city.cards.map((c) => (
            <a key={c.id} className="card" data-tone={c.tone} href={`#${c.id}`}>
              <span className={`icon${c.icon.length === 2 && /^[A-Z]+$/.test(c.icon) ? ' text' : ''}`}>{c.icon}</span>
              <h3>{t.cards[c.id].title}</h3>
              <p>{t.cards[c.id].desc}</p>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
