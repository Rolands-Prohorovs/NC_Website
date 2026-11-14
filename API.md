# API spec (draft 2)

Contract between the frontend (Rolands) and the backend (Timofei). Status: **draft for discussion**.
Answered questions are marked **(agreed)**, still-open ones **Q**. Based on DECISIONS.md D6, D7, D9,
D11, D12, D15, D-open-1 and D-open-5.

## Basics
- Base path: `/api`, JSON in and out, UTF-8.
- One API for all cities. City-specific routes have `:city` (`lahti`), the same id as `src/content/<city>/`.
- Errors: HTTP status + `{ "error": { "code": "nickname_taken", "message": "..." } }`.
  `code` is stable and the frontend maps it to translated text; `message` is for debugging only.
- Dates: `YYYY-MM-DD` for calendar days (streaks), ISO 8601 with timezone for timestamps.
  Streak days are counted in Finnish time (`Europe/Helsinki`).
- **Auth transport (agreed, Q1):** an httpOnly, Secure, SameSite=Lax session cookie, since the site
  and API share a domain. A future mobile app (D-open-4) can use a bearer token from the same
  login endpoint.

## Accounts (D6: nickname + password, no email)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/register` | `{ nickname, password }` | `201` + `User`, logged in |
| POST | `/api/auth/login` | `{ nickname, password }` | `200` + `User` |
| POST | `/api/auth/logout` | none | `204` |
| GET | `/api/me` | none | `200` + `User`, or `401` |
| DELETE | `/api/me` | `{ password }` | `204`; deletes the account and all progress (privacy page) |

```json
// User
{ "nickname": "moomin42", "createdAt": "2026-11-20T14:03:00+02:00" }
```

- Nickname (agreed, Q2): 3 to 20 chars, `a-z A-Z 0-9 _ -`, unique case-insensitively.
- Password (agreed, Q3): min. 8 chars, no other rules; hashed with bcrypt. bcrypt ignores
  everything after 72 bytes, so the max is 72 bytes (`weak_password` above that too).
- Rate limit on login/register (e.g. 10 tries / 15 min per IP + nickname): `429 too_many_attempts`.
- Error codes: `nickname_taken`, `invalid_nickname`, `weak_password`, `wrong_credentials`
  (same code for an unknown nickname and a wrong password), `not_logged_in`.
- **Q4 (D-open-5): forgotten password.** Option A: "make a new account". Option B: register returns
  a one-time `recoveryCode` once, and `POST /api/auth/recover { nickname, recoveryCode, newPassword }`
  sets a new password.

## Progress (D9, D11, D15, D-open-1)
Two kinds of tasks (D11, D15):
- **To-do list**: the few things nearly every newcomer has to do (8 for Lahti: documents,
  housing, insurance, keys, phone number, university email, DVV, bank), defined in `city.json`
  (ids, XP) + `<lang>/progress.json` (text). Done once, can be un-ticked any time. Works without
  an account (stored on the device). All done = badge. **Each gives XP (D15).**
- **Daily tasks**: 3 per day. They give XP too. On the server they need an account.

XP from both kinds adds up to one total per user and city, which ranks the **league** (below).

The frontend only sends "task done / not done"; **XP, streak, badge and the daily offer are
calculated by the backend** (D7), so a future app gets the same rules.

**Where definitions live (agreed, Q5):** task ids, text and XP values are content
(`src/content/<city>/`), so translations and new cities need no database changes. The backend
reads the ids and XP values from the same files: same repo, or copied at deploy.
It never needs the text.

### To-do list
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/cities/:city/progress` | none | `200` + `Progress` |
| PUT | `/api/cities/:city/todo/:taskId` | none | `200` + `Progress`; marks done |
| DELETE | `/api/cities/:city/todo/:taskId` | none | `200` + `Progress`; un-ticks |
| POST | `/api/cities/:city/todo/import` | `{ "done": ["sim", "keys"] }` | `200` + `Progress` |

- `import` is called once on first login: it merges the device's ticks into the account (union,
  nothing is removed), then the frontend clears localStorage. Imported ticks don't count as
  streak days (we don't know when they happened).
- Unknown `:city` or `:taskId`: `404 unknown_city` / `404 unknown_task`.
- There is no `mandatory` flag any more (D15 replaced D13): every to-do task is a must-do.
- To-do XP: ticking adds the task's XP (from `city.json`), un-ticking removes it again, so
  ticking and un-ticking can't farm XP. Imported ticks give XP too.
- When every to-do task is done, `todo.badge` becomes `{ "earnedAt": "..." }`. Proposal: the badge
  is kept even if a task is un-ticked later.

### Daily tasks (later; shape agreed now so `Progress` doesn't change)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/cities/:city/daily` | none | `200` + `Daily` |
| PUT | `/api/cities/:city/daily/:taskId` | none | `200` + `Progress`; completes it, adds its XP |
| DELETE | `/api/cities/:city/daily/:taskId` | none | `200` + `Progress`; same day only, removes the XP again |

```json
// Daily
{
  "day": "2026-11-20",
  "offered": [
    { "id": "try-salmiakki", "xp": 15 },
    { "id": "library-card", "xp": 20 },
    { "id": "walk-harbour", "xp": 10 }
  ],
  "done": ["library-card"]
}
```

- The backend picks the 3 tasks the first time the user asks for that day and stores them, so
  reloading or switching devices shows the same 3.
- PUT/DELETE on a task that isn't in today's offer: `409 not_offered_today`. This covers
  "can't un-tick after the day has passed": yesterday's tasks are no longer offered.
- XP is stored with each completion (the task's XP at that moment), not recalculated from the
  pool, so changing a task's XP later doesn't change anyone's past XP.
- **Until this API exists (frontend only):** `city.json` has a fixed `dailyTasks` list of 3
  (`[{ "id": "mail", "xp": 5 }, ...]`, no pool, no daily offer), and the state is kept on the
  device in localStorage `daily:<city>` as
  `{ "date": "2026-11-20", "done": ["mail", "finnish"], "xp": 35 }`. `date` is the device's local
  day; if it isn't today, nothing counts as done. `xp` is all XP earned from daily tasks so far
  (ticking adds the task's XP, un-ticking the same day removes it). **Open:** this XP is not
  imported on login yet (the import endpoint only takes to-do ticks).
- **Q9:** may the user complete all 3, or pick only 1? How are tasks picked (random, no repeats
  within N days)? What happens when the pool runs out?

### Progress
```json
// Progress
{
  "city": "lahti",
  "todo": { "done": ["sim", "keys", "dvv"], "total": 8, "badge": null },
  "xp": 60,          // to-do XP + daily XP
  "level": 1,
  "streak": { "current": 3, "best": 3, "lastDay": "2026-11-20" }
}
```

- **Streak (agreed, Q6):** a streak day is a day (Helsinki time) on which the user completed at
  least one daily task **or** ticked a to-do task for the first time. Only the first tick of a
  to-do task counts, so ticking and un-ticking the same task every day doesn't keep a streak alive.
  The streak no longer ends when the to-do list is done (D9 updated): daily tasks keep it going.
  Until daily tasks exist, the streak can only come from to-do ticks.
- `streak.current` is still shown on the day after `lastDay` (the user can still keep it); it
  drops to 0 once a whole day has passed without activity. `best` is never lowered.
- **Q7: level.** Not decided yet. Proposal stays: fixed XP thresholds per level in the backend;
  the frontend only shows `level` (+ `xpForNextLevel` if we want a progress bar).
- **Un-ticking (Q8, updated by D15):** to-do tasks can be un-ticked any time, which removes
  their XP. Daily
  tasks can be un-ticked only on the same day, which removes their XP and, if it was the day's
  only activity, the streak day.

Suggested storage (Timofei decides): `todo_done(user, city, task_id, first_done_at)`,
`daily_offer(user, city, day, task_ids)`, `daily_done(user, city, day, task_id, xp)`.
XP = sum of `daily_done.xp` + XP of the tasks in `todo_done`; streak days = distinct days in `daily_done` + days of `first_done_at`.

## League (D15)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/cities/:city/league?limit=20` | none | `200` + `[{ nickname, xp, rank }]` |

- **All users** with an account are in it (no opt-in, changed by D15), highest XP first. Equal
  XP shares a rank (1, 2, 2, 4). Public: readable without logging in.
- **Q10:** if the logged-in user is outside the top `limit`, also return their own row?
  Include users with 0 XP? Must be mentioned on the privacy page (nickname + XP are public).
- **Until this endpoint exists (frontend only):** `src/lib/league.ts` returns a few invented
  players (`MOCK_PLAYERS`, same `USE_MOCK_API` switch as auth) and adds the logged-in user with
  the XP stored on their device. Logged-out visitors see the table and a "Log in" line.

## Later (not in v1 unless there is time)
- Live bus data proxy (ROADMAP "Automation"): e.g. `GET /api/cities/:city/transit/plan?from=..&to=..`
  forwarding to Digitransit with the server-side API key. Shape to be defined.

## Frontend mock
Until the API exists, the frontend talks to an interface in `src/lib/` with two implementations:
the current localStorage store (also used when logged out) and a `fetch` client for this API.
Switching to the real API should then change only which implementation is used.
