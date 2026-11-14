import { useAuth } from '../lib/auth';
import { levelOf } from '../lib/level';
import { useLeague } from '../lib/league';
import { fmt, pageUrl, type Locale } from '../lib/pages';
import { useProgress } from '../lib/progress';
import type { City, ProgressCopy, SiteCopy } from '../lib/schema';
import { useStreak } from '../lib/streak';
import DailyTasks from './DailyTasks';

const MEDALS = ['🥇', '🥈', '🥉'];

type Props = { city: City; loc: Locale; p: ProgressCopy; t: SiteCopy };

export default function Progress({ city, loc, p, t }: Props) {
  const progress = useProgress(city.id, city.tasks, city.stats.xp);
  const auth = useAuth();
  // Only logged-in users are in the league; their row uses the XP shown on this page.
  const league = useLeague(
    city.id,
    auth.user ? { nickname: auth.user.nickname, xp: progress.xp } : null
  );
  const loginUrl = `${pageUrl(loc, 'login')}?next=${encodeURIComponent(pageUrl(loc, 'progress'))}`;

  const level = levelOf(progress.xp);
  const tasksPct = progress.total ? (progress.doneCount / progress.total) * 100 : 0;

  // Last 7 days as dots, assuming the streak runs up to today.
  const streak = useStreak(city.id);
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
              {fmt(p.level, { n: level.level })} · {fmt(p.toNext, { n: level.toNext })}
            </span>
            <span className="meter" aria-hidden="true">
              <i style={{ width: `${level.pct}%` }} />
            </span>
          </div>

          <div className="tile">
            <span className="tile-label">{p.streakLabel}</span>
            {streak > 0 ? (
              <>
                <strong className="tile-big">🔥 {streak}</strong>
                <span className="dots" role="img" aria-label={fmt(t.ui.streakDays, { n: streak })}>
                  {week.map((on, i) => (
                    <i key={i} className={on ? 'on' : ''} />
                  ))}
                </span>
                <span className="tile-sub">{p.streakHint}</span>
              </>
            ) : (
              <>
                {/* No streak yet: an invitation, not a dead 0 and a row of empty dots. */}
                <strong className="tile-big tile-idle" aria-hidden="true">
                  🔥
                </strong>
                <span className="tile-sub">{t.ui.streakStart}</span>
              </>
            )}
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

        <DailyTasks
          city={city}
          lang={loc.lang}
          copy={p.daily}
          xpLabel={t.xp}
          headingId="daily-title"
        />

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

        {/* One card: heading, rows, and the login line or empty state all inside it. */}
        <section className="league" aria-labelledby="league-title">
          <div className="league-head">
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
