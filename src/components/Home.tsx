import { useEffect, useState } from 'react';
import { fmt, pageUrl, type Locale } from '../lib/pages';
import { useProgress } from '../lib/progress';
import type { City, HomeCopy } from '../lib/schema';

type Props = { city: City; loc: Locale; h: HomeCopy };

export default function Home({ city, loc, h }: Props) {
  const progress = useProgress(city.id, city.tasks, city.stats.xp);

  // Where the user is in their journey. Stored on this device for now.
  // TODO: store in the database once accounts exist.
  const stageKey = `stage:${city.id}`;
  const [stage, setStage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(stageKey);
      if (saved) setStage(saved);
    } catch {
      /* ignore */
    }
  }, [stageKey]);

  const choose = (id: string) => {
    setStage(id);
    try {
      localStorage.setItem(stageKey, id);
    } catch {
      /* ignore */
    }
  };

  const start = h.starts[stage ?? 'none'] ?? h.starts.none;
  const startHref = pageUrl(loc, start.page, start.hash);

  const pct = progress.total ? (progress.doneCount / progress.total) * 100 : 0;
  const checklistTitle = fmt(h.checklistTitle, {
    days: city.stats.checklistDays,
    done: progress.doneCount,
    total: progress.total,
  });

  return (
    <>
      <section className="hero">
        <div className="inner">
          <h1>
            {h.welcome}
            <span>{h.tagline}</span>
          </h1>
          <p>{h.subtitle}</p>

          <a className="checklist" href={pageUrl(loc, 'progress')}>
            <span className="check-icon" aria-hidden="true">☑</span>
            <span className="check-text">
              <strong>{checklistTitle}</strong>
              <small>{h.checklistHint}</small>
            </span>
            <span
              className="bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.doneCount}
            >
              <i style={{ width: `${pct}%` }} />
            </span>
          </a>
        </div>
      </section>

      <main className="inner">
        <section className="block" aria-labelledby="where-title">
          <h2 id="where-title" className="block-title">{h.whereTitle}</h2>
          <p className="block-hint">{h.whereHint}</p>

          <div className="stages" role="group" aria-labelledby="where-title">
            {h.stages.map((s) => (
              <button
                key={s.id}
                type="button"
                className="stage"
                aria-pressed={stage === s.id}
                onClick={() => choose(s.id)}
              >
                <span className="stage-icon" aria-hidden="true">{s.icon}</span>
                <span className="stage-text">
                  <strong>{s.title}</strong>
                  <small>{s.desc}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="start" aria-live="polite">
            <small>{h.startTitle}</small>
            <h3>{start.title}</h3>
            <p>{start.desc}</p>
            <a className="btn" href={startHref}>{start.cta}</a>
          </div>
        </section>

        <section className="block about" aria-labelledby="about-title">
          <h2 id="about-title" className="block-title">{h.aboutTitle}</h2>
          <p>{h.about}</p>
        </section>

        <section className="block" aria-labelledby="explore-title">
          <h2 id="explore-title" className="block-title">{h.exploreTitle}</h2>
          <div className="grid">
            {(Object.keys(h.pages) as (keyof typeof h.pages)[]).map((id) => {
              const p = h.pages[id];
              return (
                <a key={id} className="card" data-tone={p.tone} href={pageUrl(loc, id)}>
                  <span className="icon" aria-hidden="true">{p.icon}</span>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                </a>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
