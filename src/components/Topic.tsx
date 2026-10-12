import { useEffect, useState } from 'react';
import type { City } from './Landing';
import '../style/landing.css';
import '../style/topic.css';



export default function Topic({ city, cardId }: { city: City; cardId: string }) {
  const [lang, setLang] = useState(city.languages[0]);
  const [open, setOpen] = useState<number | null>(null); // one open at a time

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lang');
      if (saved && city.languages.includes(saved)) setLang(saved);
    } catch {}
  }, [city]);

  const t = city.content[lang];
  const card = t.cards[cardId];
  const items = t.topics?.[cardId];

  if (!card || !items) {
    return (
      <main className="topic inner">
        <a className="back" href={`/${city.id}`}>← {t.club}</a>
        <h1>404</h1>
      </main>
    );
  }

  return (
    <main className="topic inner">
      <a className="back" href={`/${city.id}`}>← {t.club}</a>
      <h1>{card.title}</h1>

      <div className="accordion">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="acc-item" data-open={isOpen}>
              <button
                className="acc-btn"
                aria-expanded={isOpen}
                aria-controls={`panel-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{item.label}</span>
                <span className="chev" aria-hidden="true">▾</span>
              </button>
              <div id={`panel-${i}`} className="acc-panel" role="region" hidden={!isOpen}>
                <p>{item.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
