# 06 — Roadmap

## Phase 0: Planning ✅
- [x] Interview and requirements (doc 01)
- [x] Competitor app research (doc 02)
- [x] GitHub repo research (doc 03)
- [x] iPhone capture and AI plan (doc 04)
- [x] Code and license rules (doc 05)
- [x] Architecture spec (doc 07)

## Phase 1: Foundation
- [x] Next.js + TypeScript + Tailwind project; deployed to Vercel (https://ethan-s-personal-dashboard.vercel.app, auto-deploys from `main`)
- [x] Supabase project; email login
- [x] Installable PWA (icon, full screen; guide: docs/setup/02-install-on-iphone.md). No offline mode (decided Nov 10, 2026). *To check: Ethan tries it on his iPhone.*
- [x] "Today" home: Needs doing, Do now, Classes today (with NOW), Coming up
- [x] Classes (weekly schedule; rotating / A-B supported in the logic) and assignments (due date, repeats). Cushion math is built and tested but hidden: Ethan doesn't want to enter time estimates (Nov 17, 2026)
- [x] Calendar: Week / Month (Today page covers the day); drag tasks onto another day (laptop)
- [x] Plain-English quick add: one box + tappable class/day chips ("speech memorization due wed")
- [x] Inbox (review before save) + 7-day Trash (daily cleanup job in Supabase)

## Phase 2: Capture & Claude
- [x] `/api/capture` endpoint with a private token (Settings → Connections)
- [x] "Log It" Apple Shortcut guide: docs/setup/03-log-it-shortcut.md (Version A: Dictate → POST; Version B adds Ask Claude). *To do: Ethan builds it on his iPhone.*
- [x] MCP server (/api/mcp: get_today, list_due, add_assignment, add_task, complete_task, process_inbox, log_food/workout/expense, add_note → Inbox) + guide docs/setup/04-claude-connector.md. *To do: Ethan adds it on claude.ai.*
- [x] Syllabus/PDF upload (Classes page) → text read on the device (pdf.js) → Claude imports via the connector → Inbox batch to approve
- [x] Web push: morning summary, tomorrow preview, 1-hour-before reminders (Settings → Reminders; Supabase pg_cron every 15 min)
- [ ] Snooze buttons on notifications and a "nag level" per item

## Requested next (Nov 17, 2026, after Phase 1)
- [x] **The dashboard talks to me (part 1: reminders done; asking me questions comes with the Claude connector):** notifications on my iPhone (free web push, no phone number needed), e.g. the morning before something is due ("Bio lab due tomorrow, ~2 h left"). The dashboard can also *ask* me things ("which class is 'chem worksheet' for?") and I answer with a tap or a short reply in a Messages screen. Two-way texting is nice-to-have, not required.
- [x] **Design pass 1 (docs 08 + 09):** dark techy theme, bottom-bar screens per area (Today, School, Gym, Finance, Life, Jobs) with a center "+", laptop shows more columns.
- [x] **Design details:** class-first task titles ("Speech: …"), unfinished items highlighted, a clean and satisfying check-off animation.
- [x] **Design gallery before the UI phase:** show me ~20 real, visual layout examples and ~20 color combinations (actual pictures, not descriptions) so I can pick a look. *(Menu → Design gallery: tap a color theme to apply it everywhere; ♥ the layouts you like.)*

## Extras built along the way (Nov 17, 2026)
- [x] Voice: Talk button, hold ＋ to talk, keyboard-dictation fallback (docs/setup/05)
- [x] Swipe right = done, swipe left = tomorrow; Undo on toasts
- [x] Focus timer (25 min, logs minutes to the task, chime)
- [x] Today: progress ring, week strip of the next 7 days, "All clear" state
- [x] Auto-refresh when the installed app is reopened
- [x] Habits on Today, in the Claude connector (log_habit) and in the 8 PM reminder
- [x] Syllabus imports grouped as batches in the Inbox

## Added Nov 18, 2026
- [x] Speech: natural phrasing in any order, fillers, spoken numbers/times, fuzzy matching of misheard class names and days, best of 5 transcriptions, Auto-mic on +
- [x] Notes: extra context said after the main part becomes a caption on the task
- [x] Work section for PRMI (also "work", "primary", "the office"; Mike = LO)
- [x] Bottom bar with every area: Today · School · Work · + · Money · Life · Calendar

## Added Nov 19, 2026
- [x] Calendar month view: taller cells with real titles, tap a day to see its classes and tasks below
- [x] Calendar week, tidied: class times on one line each, free days take one line, "2 due" / "All done ✓" per day, past days fold under "Earlier this week" on the phone (unless something is overdue), workouts show as 🏋️ day badges (also in month view)
- [x] Bottom bar: icon-only tabs, the active one lifts and shows its name (no more squished labels)
- [x] Swipe left/right with your thumb to move between sections
- [x] Today: Work / Money / Gym / Journal tiles, the whole week in Coming up, plus Later
- [x] Quick add / voice logs lifts: "bench 3x10 at 135" → 3 sets of Bench press in today's workout (nicknames like RDL, OHP, pull ups understood)
- [x] Mic understands every kind of thing (tested phrase by phrase in `src/lib/parser/categories.test.ts`):
  - school: subjects like "math" find the class; "it covers…" and "I need to…" become notes
  - work: mortgage words (disclosures, appraisal, escrow, underwriting…) and "end of day/EOD" = 5 PM today
  - money: "got paid 450", "paycheck 612.40", "venmo'd Jake 15"; "pay phone bill on the 1st" stays a task
  - gym: lifts ("bench 3x10 at 135") and cardio ("ran 2 miles in 18 minutes")
  - food: calories and protein ("chicken burrito 700 calories")
  - habits by any form of the word ("meditated" → Meditate, "drank water" → Water)
  - journal lines with mood ("I feel great today" → 😄)
  - repeats ("every Monday", "every other week", "monthly"); names keep their capitals
  - The + sheet shows where each item will go (→ Money, Gym, Food, Habits, Journal) with "Save as a task instead" if it guessed wrong
  - Shortcut and Claude captures of these kinds wait in the Inbox, and one tap logs them in the right place
- [x] **Long talks and whole lists (Nov 19):** the mic keeps listening until you tap Done (minutes, not seconds), restarting itself and stitching the pieces without repeats (`src/lib/use-speech.ts`, `src/lib/speech-join.ts`).
  - One long thought → a short title + organized bullet notes: warm-up words ("okay so I need to…") dropped, details ("it needs…", "make sure…", "he wants…", "the teacher said…") become points (`src/lib/parser/notes.ts`).
  - A whole list → many items at once (`src/lib/parser/multi.ts`): "first / next / also / and then / another thing", sentences, commas, or just a new to-do verb with no punctuation. "For tomorrow:" / "for work:" up front applies to every item. The + sheet shows every item (title, day, notes, where it goes); ✕ to leave one out; **Save all** writes them in one go.
  - Tested in `src/lib/parser/long-speech.test.ts`: real 30–45 second talks plus 6,000 generated lists (with and without punctuation, 25 tasks × 10 kinds of details × 20 connectors × 11 openers), all exactly right.
- [ ] **Idea (later, not now):** connect Ethan's work Outlook (PRMI) so Claude can read and prioritize emails into Work tasks. Needs a check first: work accounts usually need the company's IT to approve any app that reads mail, so ask PRMI IT before building. Free options to look at: Microsoft Graph with a free app registration, or forwarding chosen emails into the Inbox.

## Phase 3: Body
- [x] Gym (inside Life, `/gym`): live workout with exercise picker (27 starter exercises + your own), sets pre-filled from last time, ✓ starts a 90 s rest timer with a chime, finish shows volume and new PRs (estimated 1-rep max), checks in a "Gym"/"Workout" habit, history and best lifts.
- [x] Gym split (Nov 19, migration 0016): Chest → Back & Biceps → Legs → Shoulders & Triceps. "Up next" card, tap a day to switch, **Skip** (kept in history as skipped). Finishing a day moves the rotation to the day after it.
- [x] Say a whole workout in one breath, any order (`src/lib/gym-speech.ts`, 70+ phrasing tests): "chest day, bench 3x10 at 135, incline 3 sets of 8 at 50, flys 3x12 at 30 and pushups 2x20" → a clean note per exercise. Understands gym numbers ("one thirty five"), per-set weights ("135 for 10, 155 for 8"), rep lists ("8 7 6"), kilos, nicknames (RDL, OHP, DB), new exercises, the muscles hit and "skip chest day". The + sheet previews the exact note before saving.
- [x] Gym history as standard notes: split-day badge, one line per exercise, tap to open, copy or delete
- [x] Gym progress charts (Nov 19): strength line per lift (best estimated 1-rep max each workout, touch a point for the set), pounds moved per week (8 weeks), split balance for the last 30 days, and a "Show numbers" table view (`src/lib/gym-progress.ts`, `src/components/gym-charts.tsx`)
- [ ] Gym later: backup exercises, recovery map (free-exercise-db data)
- [x] Food log (Nov 19, migration 0014): say what you ate with calories/protein; a Food card in Life with a daily goal bar, 7-day average, delete + undo; a Food tile on Today
- [ ] Calories later: barcode lookup (Open Food Facts), photo logging through Claude, Meal What-If, adaptive goals

## Phase 4: Life
- [x] Habits with a strength score and streaks (Life tab), XP and levels
- [ ] Coins → reward wishlist
- [ ] Morning Plan / Evening Shutdown + journal; guided weekly review
- [x] Money (Nov 18): Cash App statement (CSV) import with duplicate protection, auto categories, month totals, 6-month chart, tap-to-hide category chart, "spent $12 gas" from quick add
- [ ] Recurring bills and budgets per category
- [x] ~~Side business: window-washing jobs~~ Removed Nov 18, 2026: Ethan doesn't do window washing. Work = LOA at PRMI (Work section).
- [x] Grades: weighted averages, letter grades, What-If, and "what do I need?" (/grades)

## Phase 5: Social
- [ ] Friends, groups, school-wide spaces
- [ ] Challenges and leaderboards (realtime), "overtake" alerts, medals
- [ ] Privacy controls for what's shared
