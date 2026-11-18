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
- [ ] **Design gallery before the UI phase:** show me ~20 real, visual layout examples and ~20 color combinations (actual pictures, not descriptions) so I can pick a look.

## Extras built along the way (Nov 17, 2026)
- [x] Voice: Talk button, hold ＋ to talk, keyboard-dictation fallback (docs/setup/05)
- [x] Swipe right = done, swipe left = tomorrow; Undo on toasts
- [x] Focus timer (25 min, logs minutes to the task, chime)
- [x] Today: progress ring, week strip of the next 7 days, "All clear" state
- [x] Auto-refresh when the installed app is reopened

## Phase 3: Body
- [ ] Gym: plans, A/B/C rotations, weights filled in from last time, backup exercise, progress, recovery map (free-exercise-db data)
- [ ] Calories: quick add, barcode lookup (Open Food Facts), photo logging through Claude, Meal What-If, adaptive goals

## Phase 4: Life
- [ ] Habits with a strength score, XP, levels, coins → reward wishlist
- [ ] Morning Plan / Evening Shutdown + journal; guided weekly review
- [ ] Budget (categories, recurring items, hide-a-category chart)
- [ ] Side business: window-washing jobs, customers, income, job locations
- [ ] Grades: weighted GPA + What-If

## Phase 5: Social
- [ ] Friends, groups, school-wide spaces
- [ ] Challenges and leaderboards (realtime), "overtake" alerts, medals
- [ ] Privacy controls for what's shared
