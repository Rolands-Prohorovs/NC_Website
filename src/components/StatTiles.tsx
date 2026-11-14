import { levelOf } from '../lib/level';
import { fmt } from '../lib/pages';
import type { Progress } from '../lib/progress';
import type { ProgressCopy, SiteCopy } from '../lib/schema';
import { useStreak } from '../lib/streak';

type Props = {
  cityId: string;
  progress: Progress;
  p: ProgressCopy;
  t: SiteCopy;
  /** Smaller tiles for the Home dashboard. */
  compact?: boolean;
  /** Accessible name of the row, when the page has no heading for it. */
  label?: string;
  /** Shown in the XP tile instead of the level line while the user has 0 XP. */
  xpEmptyHint?: string;
};

/** The three tiles shared by Progress and Home: level/XP, streak, to-do progress. */
export default function StatTiles({ cityId, progress, p, t, compact, label, xpEmptyHint }: Props) {
  const level = levelOf(progress.xp);
  const tasksPct = progress.total ? (progress.doneCount / progress.total) * 100 : 0;

  // Last 7 days as dots, assuming the streak runs up to today.
  const streak = useStreak(cityId);
  const week = Array.from({ length: 7 }, (_, i) => i >= 7 - Math.min(streak, 7));

  return (
    <div
      className={compact ? 'stats stats-compact' : 'stats'}
      role={label ? 'group' : undefined}
      aria-label={label}
    >
      <div className="tile tile-xp">
        <span className="tile-label">{p.xpLabel}</span>
        <strong className="tile-big">
          {progress.xp} <small>{t.xp}</small>
        </strong>
        <span className="tile-sub">
          {progress.xp === 0 && xpEmptyHint
            ? `${fmt(p.level, { n: level.level })} · ${xpEmptyHint}`
            : `${fmt(p.level, { n: level.level })} · ${fmt(p.toNext, { n: level.toNext })}`}
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
            {!compact && <span className="tile-sub">{p.streakHint}</span>}
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
  );
}
