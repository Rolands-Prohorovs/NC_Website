# Decisions

Short log of decisions and why. Newest at the bottom of each list.

## Made
- **D1: Astro + React.** Astro renders static pages (fast, works without JS); React only for interactive parts (header, home stage picker, checklist).
- **D2: Content in JSON per city and language** (`src/content/<city>/<lang>/`). Adding a city should need no code. Customer asked for maximum automation.
- **D3: UI strings per city, not shared.** Finnish inflects place names (Lahti -> Lahdessa), so `{city}` templating doesn't work.
- **D4: One dynamic route** generates all cities x languages x pages.
- **D5: Split work: Rolands frontend, Timofei backend + database.** Separate theses about each part.
- **D6: Accounts are minimal: nickname + password.** Agreed with customer. Used only for streak, XP and maybe a league.
- **D7: Business logic lives in the backend**, so a future mobile app can reuse it (Miro: "Keep in mind").
- **D8: Hosting on the Rotary club's existing hosting subscription**; the domain is bought separately (not paid by us).
- **D9: Gamification.** Tasks are light, fun settling-in activities. When all to-do tasks are done the user gets a badge. Agreed with the customer. Task ideas: Rolands + Rotary club members. *Updated by D11:* the streak no longer ends at the badge, because daily tasks keep it going.
- **D10: Every fact has a source**, logged in `SOURCES.md` and linked from the topic. Used for review, testing and the thesis.
- **D11: Two kinds of tasks.** (1) A to-do list of ~17 near-essential settling-in tasks (the Progress page): done once, badge when all are done, works without an account. (2) Later: daily tasks, 3 offered per day from a pool, each with its own XP, need an account. Only daily tasks give XP. A streak day = one daily task done, or a to-do task ticked for the first time. Daily tasks can't be un-ticked after their day. Task definitions (ids, text, XP) live in content files; the backend reads ids/XP from them and stores only state. Details in `API.md`.
- **D12: Auth basics.** Session cookie (bearer token later for an app); nickname 3 to 20 chars `a-z A-Z 0-9 _ -`, case-insensitive unique; password min. 8 chars, no other rules, bcrypt.

## Open
- **D-open-1: Is an account required?** Proposal: no. Progress works without an account (stored on the device). An optional account (nickname + password) saves it to the server and enables the league. Fewer people forced to sign up, less personal data, and the backend is still fully needed. Decide with Timofei + customer.
- **D-open-3: "Information depending on the user's location."** With one city in v1, location detection adds nothing. Proposal: v1 = city in the URL; geolocation picks the nearest city once there are several.
- **D-open-4: Content for a future mobile app.** Content is JSON at build time. If the app comes, the backend could serve the same JSON. No work needed now; keep the JSON clean.
- **D-open-5: Forgotten password** with no email: accept "make a new account", or add an optional recovery code at sign-up.
