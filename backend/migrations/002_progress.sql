-- Progress (API.md "Progress"). Task definitions (ids, XP) are content files, not tables:
-- city and task_id are plain text, checked by the code, so new cities and tasks need no migration.
-- To-do XP is read from city.json when it is shown; daily XP is stored with each completion.

-- To-do ticks. A row is never deleted on un-tick (done = false), so the day of the
-- first tick is remembered and re-ticking later doesn't make a new streak day (API.md Q6).
create table todo_done (
  user_id       bigint      not null references users (id) on delete cascade,
  city          text        not null,
  task_id       text        not null,
  done          boolean     not null default true,
  first_done_at timestamptz,          -- null = came from import, never a streak day
  primary key (user_id, city, task_id)
);

-- Badge for finishing the to-do list; kept even if a task is un-ticked later.
create table todo_badge (
  user_id   bigint      not null references users (id) on delete cascade,
  city      text        not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, city)
);

-- Daily completions. xp is the tier's XP at that moment, so changing a tier's XP later
-- doesn't change anyone's past XP. Un-ticking on the same day deletes the row.
create table daily_done (
  user_id bigint      not null references users (id) on delete cascade,
  city    text        not null,
  day     date        not null,      -- calendar day in Europe/Helsinki
  task_id text        not null,
  xp      integer     not null check (xp >= 0),
  done_at timestamptz not null default now(),
  primary key (user_id, city, day, task_id)
);
