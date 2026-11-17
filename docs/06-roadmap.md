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
- [ ] Installable PWA (icon, full screen). No offline mode (decided Nov 10, 2026)
- [x] "Today" home: Needs doing, Do now, Classes today (with NOW), Coming up
- [x] Classes (weekly schedule; rotating / A-B supported in the logic) and assignments (due date, repeats). Cushion math is built and tested but hidden: Ethan doesn't want to enter time estimates (Nov 17, 2026)
- [x] Calendar: Week / Month (Today page covers the day); drag tasks onto another day (laptop)
- [x] Plain-English quick add: one box + tappable class/day chips ("speech memorization due wed")
- [x] Inbox (review before save) + 7-day Trash (daily cleanup job in Supabase)

## Phase 2: Capture & Claude
- [ ] `/api/capture` endpoint with a private token
- [ ] "Log It" Apple Shortcut (Dictate → Ask Claude → POST), set up on the Lock Screen, Back Tap and Siri
- [ ] MCP server + custom connector on claude.ai
- [ ] Syllabus/PDF upload → extract → review-before-save screen
- [ ] Web push: morning digest, tomorrow preview, due reminders, snooze, nag level per item

## Requested next (Nov 17, 2026, after Phase 1)
- [ ] **The dashboard talks to me:** notifications on my iPhone (free web push, no phone number needed), e.g. the morning before something is due ("Bio lab due tomorrow, ~2 h left"). The dashboard can also *ask* me things ("which class is 'chem worksheet' for?") and I answer with a tap or a short reply in a Messages screen. Two-way texting is nice-to-have, not required.
- [x] **Design pass 1 (docs 08 + 09):** dark techy theme, bottom-bar screens per area (Today, School, Gym, Finance, Life, Jobs) with a center "+", laptop shows more columns.
- [x] **Design details:** class-first task titles ("Speech: …"), unfinished items highlighted, a clean and satisfying check-off animation.
- [ ] **Design gallery before the UI phase:** show me ~20 real, visual layout examples and ~20 color combinations (actual pictures, not descriptions) so I can pick a look.

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
