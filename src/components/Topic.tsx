import { useEffect, useState } from 'react';
import type { City } from './Landing';
import '../style/landing.css';
import '../style/topic.css';

type Block = { label?: string; text: string };

// body can be a plain string or, optionally, an array of {label, text}.
// In a string, separate blocks with a blank line and put the label on the first line:
//   "From Helsinki-Vantaa Airport\nBus 615 or 617 ...\n\nIntercity coach\nOnnibus and ..."
function toBlocks(body: unknown): Block[] {
  if (Array.isArray(body)) return body as Block[];
  return String(body ?? '')
    .split(/\n\s*\n/)
    .map((chunk) => {
      const [first, ...rest] = chunk.trim().split('\n');
      return rest.length ? { label: first, text: rest.join(' ') } : { text: first };
    })
    .filter((b) => b.text);
}

export default function Topic({ city, cardId }: { city: City; cardId: string }) {
  const [lang, setLang] = useState(city.languages[0]);
  const [open, setOpen] = useState<number | null>(0); // one open at a time, first open by default

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lang');
      if (saved && city.languages.includes(saved)) setLang(saved);
    } catch {}
  }, [city]);

  const t = city.content[lang];
  const card = t.cards[cardId];
  const items = t.topics?.[cardId];
  const meta = city.cards.find((c) => c.id === cardId);

  if (!card || !items || !meta) {
    return (
      <main className="tp-page" data-tone="default">
        <header className="tp-header">
          <a className="tp-back" href={`/${city.id}`}>← {(t as any).back ?? 'All topics'}</a>
          <h1 className="tp-title">404</h1>
        </header>
      </main>
    );
  }

  const isText = meta.icon.length === 2 && /^[A-Z]+$/.test(meta.icon);

  return (
    <div className="tp-page" data-tone={meta.tone}>
      <header className="tp-header">
        <a className="tp-back" href={`/${city.id}`}>← {(t as any).back ?? 'All topics'}</a>
        <div className="tp-hero">
          <span className={`tp-icon${isText ? ' text' : ''}`} aria-hidden="true">{meta.icon}</span>
          <div>
            <h1 className="tp-title">{card.title}</h1>
            <p className="tp-sub">{card.desc}</p>
          </div>
        </div>
      </header>

      <main className="tp-body">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <section key={i} className="tp-acc" data-open={isOpen}>
              <button
                className="tp-acc-btn"
                aria-expanded={isOpen}
                aria-controls={`panel-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{item.label}</span>
                <svg className="tp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <div id={`panel-${i}`} className="tp-acc-panel" role="region" hidden={!isOpen}>
                {toBlocks(item.body).map((b, j) => (
                  <div className="tp-block" key={j}>
                    {b.label && <p className="tp-label">{b.label}</p>}
                    <p className="tp-text">{b.text}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}