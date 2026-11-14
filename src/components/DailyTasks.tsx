import { fmt } from '../lib/pages';
import { useDaily } from '../lib/progress';
import type { City, ProgressCopy } from '../lib/schema';

type Props = {
  city: City;
  lang: string;
  /** Strings from progress.json `daily`; `title` and `desc` can be overridden per page. */
  copy: ProgressCopy['daily'];
  title?: string;
  desc?: string;
  xpLabel: string;
  /** Must be unique on the page: it labels the section. */
  headingId: string;
};

/**
 * Today's daily tasks as a tickable list (Progress page and Home). Both use the same store, so
 * a tick on one page shows on the other.
 *
 * Today's tasks are only known in the browser (see `useDaily`), so the server renders
 * placeholder rows of the same height and the real tasks replace them without moving the page.
 */
export default function DailyTasks({ city, lang, copy, title, desc, xpLabel, headingId }: Props) {
  const daily = useDaily(city, lang);

  // Daily tasks switched off for this city (quota 0), or nothing in the pool.
  if (daily.quota === 0 || (daily.status === 'ready' && daily.total === 0)) return null;

  return (
    <section
      className="task-group daily"
      aria-labelledby={headingId}
      aria-busy={daily.status === 'loading'}
    >
      <div className="group-head">
        <h2 id={headingId}>{title ?? copy.title}</h2>
        {daily.status === 'ready' && (
          <span className="group-count">
            {fmt(copy.done, { done: daily.doneCount, total: daily.total })}
          </span>
        )}
      </div>
      <p className="block-hint">{desc ?? copy.desc}</p>

      {daily.status === 'error' && (
        <p className="daily-status" role="status">
          {copy.error}
        </p>
      )}

      {daily.status === 'loading' && (
        <div className="tasks">
          <p className="sr-only" role="status">
            {copy.loading}
          </p>
          {Array.from({ length: daily.quota }, (_, i) => (
            <div key={i} className="task task-skeleton" aria-hidden="true" />
          ))}
        </div>
      )}

      {daily.status === 'ready' && (
        <div className="tasks">
          {daily.tasks.map((task) => (
            <label key={task.id} className="task">
              <input
                type="checkbox"
                checked={daily.done.has(task.id)}
                onChange={() => daily.toggle(task.id)}
              />
              <span className="box" aria-hidden="true" />
              <span className="task-text">
                <strong>{task.label}</strong>
                {task.hint && <small>{task.hint}</small>}
              </span>
              <span className="task-xp">
                +{task.xp} {xpLabel}
              </span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
