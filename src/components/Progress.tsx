import { useAuth } from '../lib/auth';
import { useLeague } from '../lib/league';
import { fmt, pageUrl, type Locale } from '../lib/pages';
import { useDaily, useProgress } from '../lib/progress';
import type { City, ProgressCopy, SiteCopy } from '../lib/schema';

const XP_PER_LEVEL = 100;

const MEDALS = ['🥇', '🥈', '🥉'];

type Props = { city: City; loc: Locale; p: ProgressCopy; t: SiteCopy };

export default function Progress({ city, loc, p, t }: Props) {
  const progress = useProgress(city.id, city.tasks, city.stats.xp);
  const daily = useDaily(city.id, city.dailyTasks);
  const auth = useAuth();
  // Only logged-in users are in the league; their row uses the XP shown on this page.
  const league = useLeague(
    city.id,
    auth.user ? { nickname: auth.user.nickname, xp: progress.xp } : null
  );
  const loginUrl = `${pageUrl(loc, 'login')}?next=${encodeURIComponent(pageUrl(loc, 'progress'))}`;

  const level = Math.floor(progress.xp / XP_PER_LEVEL) + 1;
  const intoLevel = progress.xp % XP_PER_LEVEL;
  const tasksPct = progress.total ? (progress.doneCount / progress.total) * 100 : 0;

  // Streak is a static preview for now (from the JSON). Last 7 days as dots.
  // TODO: compute from real visit dates once the backend exists.
  const streak = city.stats.streak;
  const week = Array.from({ length: 7 }, (_, i) => i >= 7 - Math.min(streak, 7));

  // Group tasks in the order groups appear in the copy.
  const groupIds = Object.keys(p.groups);

  return (
    <>
      <section className="hero hero-compact">
        <div className="inner">
          <h1>{p.title}</h1>
          <p>{p.subtitle}</p>
        </div>
      </section>

      <main className="inner page" data-tone="purple">
        <div className="stats">
          <div className="tile tile-xp">
            <span className="tile-label">{p.xpLabel}</span>
            <strong className="tile-big">
              {progress.xp} <small>{t.xp}</small>
            </strong>
            <span className="tile-sub">
              {fmt(p.level, { n: level })} · {fmt(p.toNext, { n: XP_PER_LEVEL - intoLevel })}
            </span>
            <span className="meter" aria-hidden="true">
              <i style={{ width: `${(intoLevel / XP_PER_LEVEL) * 100}%` }} />
            </span>
          </div>

          <div className="tile">
            <span className="tile-label">{p.streakLabel}</span>
            <strong className="tile-big">🔥 {streak}</strong>
            <span className="dots" role="img" aria-label={fmt(t.ui.streakDays, { n: streak })}>
              {week.map((on, i) => (
                <i key={i} className={on ? 'on' : ''} />
              ))}
            </span>
            <span className="tile-sub">{p.streakHint}</span>
          </div>

          <div className="tile">
            <span className="tile-label">{p.tasksLabel}</span>
            <strong className="tile-big">
              {progress.doneCount}
              <small> / {progress.total}</small>
            </strong>
            <span className="tile-sub">
              {fmt(p.tasksDone, { done: progress.doneCount, total: progress.total })}
            </span>
            <span className="meter" aria-hidden="true">
              <i style={{ width: `${tasksPct}%` }} />
            </span>
          </div>
        </div>

        {daily.total > 0 && (
          <section className="task-group daily" aria-labelledby="daily-title">
            <div className="group-head">
              <h2 id="daily-title">{p.daily.title}</h2>
              <span className="group-count">
                {fmt(p.daily.done, { done: daily.doneCount, total: daily.total })}
              </span>
            </div>
            <p className="block-hint">{p.daily.desc}</p>

            <div className="tasks">
              {city.dailyTasks.map((task) => {
                const copy = p.dailyTasks[task.id];
                return (
                  <label key={task.id} className="task">
                    <input
                      type="checkbox"
                      checked={daily.done.has(task.id)}
                      onChange={() => daily.toggle(task.id)}
                    />
                    <span className="box" aria-hidden="true" />
                    <span className="task-text">
                      <strong>{copy.label}</strong>
                      <small>{copy.hint}</small>
                    </span>
                    <span className="task-xp">+{task.xp} {t.xp}</span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        <div className="list-head">
          <h2>{p.todo.title}</h2>
          <p className="block-hint">{p.todo.desc}</p>
        </div>

        {groupIds.map((gid) => {
          const tasks = city.tasks.filter((task) => task.group === gid);
          if (!tasks.length) return null;
          const doneInGroup = tasks.filter((task) => progress.done.has(task.id)).length;
          const g = p.groups[gid];

          return (
            <section key={gid} className="task-group" aria-labelledby={`g-${gid}`}>
              <div className="group-head">
                <h3 id={`g-${gid}`}>{g.title}</h3>
                <span className="group-count">
                  {doneInGroup}/{tasks.length}
                </span>
              </div>
              <p className="block-hint">{g.desc}</p>

              <div className="tasks">
                {tasks.map((task) => {
                  const copy = p.tasks[task.id];
                  return (
                    <label key={task.id} className="task">
                      <input
                        type="checkbox"
                        checked={progress.done.has(task.id)}
                        onChange={() => progress.toggle(task.id)}
                      />
                      <span className="box" aria-hidden="true" />
                      <span className="task-text">
                        <strong>{copy.label}</strong>
                        <small>{copy.hint}</small>
                      </span>
                      <span className="task-xp">+{task.xp} {t.xp}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="league" aria-labelledby="league-title">
          <div className="list-head">
            <h2 id="league-title">{p.league.title}</h2>
            <p className="block-hint">{p.league.desc}</p>
          </div>

          {league && league.length === 0 && <p className="league-empty">{p.league.empty}</p>}
          {league && league.length > 0 && (
            <ol className="league-list">
              {league.map((row) => (
                <li
                  key={row.nickname.toLowerCase()}
                  className={row.me ? 'league-row league-me' : 'league-row'}
                  aria-current={row.me ? 'true' : undefined}
                >
                  <span className="league-rank">
                    <span className="sr-only">{fmt(p.league.rank, { n: row.rank })}</span>
                    <span aria-hidden="true">{MEDALS[row.rank - 1] ?? row.rank}</span>
                  </span>
                  <span className="league-name">{row.nickname}</span>
                  {row.me && <span className="badge">{p.league.you}</span>}
                  <span className="task-xp">
                    {row.xp} {t.xp}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {auth.status === 'ready' && !auth.user && (
            <p className="league-join">
              {p.league.loginPrompt} <a href={loginUrl}>{p.league.loginCta}</a>
            </p>
          )}
        </section>
      </main>
    </>
  );
}
