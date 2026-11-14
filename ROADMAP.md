# Roadmap: Lahti newcomer guide (coding)

Owner of this file: Rolands. Update it when plans change; Claude Code reads it for context.
Thesis-writing roadmap is kept separately.

## Fixed dates
| Date | What |
|---|---|
| Nov 11 | Customer meeting |
| Nov 19 | Progress presentation to the whole Rotary club |
| ~every 2 weeks | Customer meetings (after Nov 19: ~Dec 3, ~Dec 17, January) |
| **Dec 17** | **Feature freeze**: all features done |
| January | Testing, security review, hosting, domain |
| **February** | Launch for Lahti: real users |

Capacity: Rolands ~10 h/week -> about 65 h until Dec 17. Scope has to fit that.

## Who does what
- **Rolands: frontend.** Pages, content, design, mobile, account UI, connecting the frontend to the API.
- **Timofei: backend + database.** Node.js + TypeScript API, PostgreSQL, accounts, XP/streak logic, API proxy for live data.
- The contract between the two is the **API spec** (endpoints + JSON shapes). Agree it early; the frontend builds against a mock until the real API exists.

## Status
Done (step 1): pages, routing, localization EN/FI, hamburger menu, multi-city content structure, schema validation.

## Phase A: Nov 2 to Nov 11 (customer meeting) ~10 h
Goal: show the new content format on one real page.
- [x] Design the "short format" for a topic (see Content format below) and add it to `schema.ts`
- [x] Living in Lahti page: rewrite in the short format with official sources (EN). Start from the content already there; main reference: City of Lahti Newcomer's Guide (see SOURCES.md). Done for 12 of 25 topics; the rest have no official source yet (SOURCES.md "Needs a source")
- [x] Log every source used in `SOURCES.md`
- [x] Add `source` + `checked` (date) to topics; show "Official source / checked <date>" in the UI
- [ ] With Timofei: first draft of the API spec (auth, progress, streak, XP). Draft 2 is in `API.md`; Q4, Q7, Q9, Q10 (league) still open
- [ ] Find out what the Rotary club's hosting supports (see Risks), ask at the meeting if unknown

## Phase B: Nov 11 to Nov 19 (Rotary presentation) ~10 h
Goal: the whole site looks like the finished product, on a phone.
- [ ] Students + Meet people: short format + sources (EN). Students done 2026-11-06 (10 topics, new structure); fi/students.json still has the old structure
- [ ] Finnish: catch up (fi/living has 19 topics vs 26 in en) and translate the new content
- [ ] Fill or cut the "coming soon" topics (Students 6, Meet 3, Living 2)
- [ ] Mobile pass on real phones
- [ ] Demo script for the 19th: open on a phone, pick a stage, follow the first step, tick a task
- [ ] Draft list of fun/settling-in tasks; at the Rotary meeting, ask members for task ideas

## Phase C: Nov 19 to Dec 17 (feature freeze) ~40 h
- [ ] Styling and colours (Miro step 4): final visual design
- [ ] Progress page logic: streak and a badge when all to-do tasks are done (D9, D11)
- [ ] Daily tasks (D11): pool of tasks in content (EN + FI), "today's 3" UI, XP. May slip past Dec 17. Started 2026-11-08: fixed list of placeholder daily tasks on the Progress page, reset at midnight, stored on the device. 2026-11-13: cut to 3, each gives XP (D15)
- [x] ~~Mandatory to-do tasks (D13)~~ removed 2026-11-13 (D15): the to-do list now holds only must-do tasks (8), no badge or separate counter
- [x] League UI on the Progress page (D15): all users ranked by XP (to-do + daily). Done 2026-11-13 against **mock** players (`src/lib/league.ts`); needs `GET /api/cities/:city/league` from Timofei
- [ ] Final task list (incl. ideas from the Rotary meeting), EN + FI
- [x] Account UI: register / log in / log out with nickname + password; progress works without logging in (D-open-1). Done 2026-11-11 against a **mock** API (`src/lib/auth.ts`, users in localStorage, `USE_MOCK_API`); `/login` + `/register` pages, header Log in button / account menu (D14). Progress import on login is a stub until the real API exists
- [ ] Connect frontend to Timofei's API (mock -> real), migrate localStorage progress into the account on first login
- [ ] Live data: bus journey planner / stops via backend proxy (see Automation)
- [ ] Automated source-link checker in the build (flags dead official links)
- [ ] Basic accessibility (contrast, keyboard, alt text) and SEO (titles, descriptions)
- [ ] Privacy page (what is stored, why, how to delete the account)

## Phase D: January: testing and launch prep
- [ ] Test with real newcomers (5 people is enough), fix what confuses them
- [ ] Security review together with Timofei (passwords hashed, rate limiting, HTTPS, input validation)
- [ ] Deploy to the Rotary hosting, buy the domain (.fi, ~EUR 12.90/yr)
- [ ] Customer verifies all content
- [ ] Short handover doc: how to add a city / edit content

## Content format (proposal)
Nobody reads walls of text. Each topic becomes:
- **one-line summary**: the answer in one sentence
- **steps or key facts**: 2 to 5 short bullets
- **official source** button + "checked <date>"
- optional chips: "what you need" (passport, residence permit...), cost, time
Longer text only where it really helps (culture, etiquette).

## Automation: "nobody should have to maintain this"
Rule: copy only stable facts; link to the official page for anything that changes; fetch live data where an API exists.
| Information | How |
|---|---|
| Bus routes, stops, timetables, journey planning | Digitransit routing API (covers the Waltti region incl. Lahti/LSL). Needs a free API key, so call it **through the backend**, never from the browser |
| Airport -> Lahti, trains | Deep link into a journey planner (zero maintenance) |
| Ticket prices, office opening hours, DVV/Kela/bank steps | No API: short summary + link to official page + "checked" date |
| Broken official links | Build-time link checker |
| Weather / daylight for the winter section (nice to have) | FMI open data |

## Risks
1. **Hosting.** The Rotary site may be on shared hosting (often PHP/WordPress only). A Node.js backend + PostgreSQL needs Node support or a VPS (Miro note: ~EUR 5.87/month). Check before Timofei builds anything host-specific.
2. **Accounts = security work.** Kept as small as possible: nickname + password, no email, so there is no password reset. Decide what happens when someone forgets their password.
3. **Content correctness.** Current text is AI-drafted; everything must get an official source before launch.

## Ideas (not decided)
Parked ideas: not planned, not promised to the customer. Decide later whether to build them.
- **Tips page or section** (added 2026-11-05). A page, or a section on an existing page, with short practical tips for newcomers.
  - Step 1: tips written by us, stored in the content JSON like the other content (frontend only).
  - Step 2 (maybe): users add their own tips and share them with others. Needs the backend (Timofei) and accounts, plus moderation (approve before showing, or report button) because it is public user content. Also check EN/FI handling and GDPR (who wrote it, deleting it).
