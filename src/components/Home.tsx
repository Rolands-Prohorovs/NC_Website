import { useEffect, useState } from 'react';
import { fmt, pageUrl, type Locale } from '../lib/pages';
import { useProgress } from '../lib/progress';
import type { City, HomeCopy, ProgressCopy, SiteCopy } from '../lib/schema';
import DailyTasks from './DailyTasks';
import StatTiles from './StatTiles';

/** `p` and `t` are needed for the dashboard: task texts, tile labels and the XP unit. */
type Props = { city: City; loc: Locale; h: HomeCopy; p: ProgressCopy; t: SiteCopy };

/**
 * Home: a welcome for first-timers and a small dashboard for returning users.
 * Order: stats, today's daily tasks + the to-do list, the stage picker with the best first
 * step, and the explore cards.
 * Ticks use the same stores as the Progress page, so the two stay in sync.
 */
export default function Home({ city, loc, h, p, t }: Props) {
  const progress = useProgress(city.id, city.tasks, city.stats.xp);
  const d = h.dashboard;

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

  // The next to-do task, in the order the Progress page lists them (by group).
  const next = Object.keys(p.groups)
    .flatMap((group) => city.tasks.filter((task) => task.group === group))
    .find((task) => !progress.done.has(task.id));
  const todoPct = progress.total ? (progress.doneCount / progress.total) * 100 : 0;
  const todoText = fmt(p.tasksDone, { done: progress.doneCount, total: progress.total });

  return (
    <>
      <section className="hero hero-home">
        <div className="inner">
          <h1>
            {h.welcome}
            <span>{h.tagline}</span>
          </h1>
          <p>{h.subtitle}</p>
        </div>
      </section>

      <main className="inner">
        <div data-tone="purple">
          <StatTiles
            cityId={city.id}
            progress={progress}
            p={p}
            t={t}
            compact
            label={d.statsLabel}
            xpEmptyHint={d.xpEmpty}
          />

          <div className="dash">
            <DailyTasks
              city={city}
              lang={loc.lang}
              copy={p.daily}
              title={d.dailyTitle}
              desc={d.dailyDesc}
              xpLabel={t.xp}
              headingId="daily-title"
            />

            <section className="task-group panel" aria-labelledby="todo-title">
              <div className="group-head">
                <h2 id="todo-title">{d.todoTitle}</h2>
                <span className="group-count">
                  {progress.doneCount}/{progress.total}
                </span>
              </div>
              <span
                className="meter"
                role="progressbar"
                aria-label={todoText}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.doneCount}
              >
                <i style={{ width: `${todoPct}%` }} />
              </span>

              {next ? (
                <>
                  <p className="panel-hint">{progress.doneCount === 0 ? d.todoEmpty : d.todoNext}</p>
                  <label className="task">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => progress.toggle(next.id)}
                    />
                    <span className="box" aria-hidden="true" />
                    <span className="task-text">
                      <strong>{p.tasks[next.id].label}</strong>
                      <small>{p.tasks[next.id].hint}</small>
                    </span>
                    <span className="task-xp">
                      +{next.xp} {t.xp}
                    </span>
                  </label>
                </>
              ) : (
                <p className="panel-done">
                  <span aria-hidden="true">🎉</span> {d.todoAllDone}
                </p>
              )}

              <a className="btn btn-primary" href={pageUrl(loc, 'progress')}>
                {d.todoCta}
              </a>
            </section>
          </div>
        </div>

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

        <section className="block" aria-labelledby="explore-title">
          <h2 id="explore-title" className="block-title">{h.exploreTitle}</h2>
          <div className="grid">
            {(Object.keys(h.pages) as (keyof typeof h.pages)[]).map((id) => {
              const card = h.pages[id];
              return (
                <a key={id} className="card" data-tone={card.tone} href={pageUrl(loc, id)}>
                  <span className="icon" aria-hidden="true">{card.icon}</span>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </a>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
