# 01 — Brainstorm & Requirements

*Planning session with Claude, November 10, 2026.*

## The assignment

- My teacher assigned us to build a personal dashboard using Claude.
- We can take as much time as needed. The only hard rule: **it must at least run in a web browser.**
- The teacher wants to see the brainstorm, so this whole planning process is documented here.

## Interview: what I want

### Modules
"All of the above and probably more — don't be closed-minded."

- Homework & classes (assignments, due dates, class schedule, grades)
- Calendar & to-dos
- Gym & fitness (workout planner, log, PRs)
- Calories & nutrition (food log, macros)
- Money & budget (including side-business income)
- Habits & goals
- Notes & journal
- Side business / work (window-washing jobs and clients)

### Social
- Invite others: friends, niche groups, school-wide
- Leaderboards and challenges

### Devices
- **Both** computer and phone are essential.
- On the phone I want to **view** it and **talk** to it.
- I want to open it from an **app icon**, not by going through Safari, without building a real App Store app.
- Phone: **iPhone 13** (no Action Button, no Apple Intelligence).

### Input features
- File upload (for example, upload a syllabus and the assignments appear)
- Speech-to-text: talk to it
- AI that can see and understand assignments
- Snap a photo of food and estimate the calories

### Fastest possible capture
- I don't want to grab my phone, open the Claude app, start voice mode, say the assignment, and ask it to transfer it to the dashboard.
- I want to **pick up my phone, press one button, talk, and have it saved automatically.**

### Everything in one place
- I don't want to send a picture in one app, see the dashboard in another, and talk to it in a third.
- Keep it as unified as possible. Perfection isn't required.

### Where my assignments live now
- Mostly in my head or my notes. Teachers only sometimes post assignments in the gradebook, so automatic school-system (LMS) sync isn't worth much. **Manual and AI capture matters most.**

### Budget
- I have **Claude Pro** and will not buy anything else.
- I don't want to sign up for a bunch of free APIs. I'd rather connect the dashboard to Claude itself.
- Free tools, free hosting, no license fees.

### Build approach
- If a good repo existed, we'd customize it. Research showed none covers everything, so **we build from scratch with Claude Code.**

## Key decisions

| # | Decision | Why |
|---|---|---|
| 1 | Build our own app from scratch | No existing project covers all the modules plus social features plus phone AI (see doc 03) |
| 2 | Next.js + Supabase + Vercel, all on free tiers | Free, runs in any browser, installable on iPhone |
| 3 | Claude is the AI, through a custom connector (MCP) and Shortcuts' "Ask Claude" | Uses Claude Pro; no extra AI accounts or API keys |
| 4 | One Lock Screen button → "Log It" Shortcut | Fastest capture on an iPhone 13 |
| 5 | Every path ends in the dashboard | Keeps everything in one place |
| 6 | Review-before-save for AI captures | Top apps do this because AI can misread dates |
| 7 | Ideas only, no copied or paraphrased code | My rule (see doc 05) |
| 8 | Social features come last (Phase 5) | Get the personal tool working first |

## Open questions to test early

- Can Shortcuts' "Ask Claude" action accept a **photo**? If yes, food photos go through the same one button. If not, use Claude's "Analyze Photo" Lock Screen button plus the connector.
- Can a button inside the dashboard launch the "Log It" Shortcut and return to the dashboard smoothly?
- Supabase's free plan pauses a project after about 7 days without activity. Daily use should keep it awake.
