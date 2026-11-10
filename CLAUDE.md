# CLAUDE.md — instructions for Claude Code

You are helping **Ethan** (a student with an iPhone 13 and a Claude Pro plan) build his personal dashboard for a class assignment. His teacher will read this repo, so keep commits, docs and code clean and understandable.

**Read these before doing any work:**
- `docs/01-brainstorm-and-requirements.md`: what Ethan wants (source of truth for requirements)
- `docs/06-roadmap.md`: current phase and backlog
- `docs/05-code-and-license-rules.md`: **mandatory rules** (summary below)
- `docs/04-iphone-capture-and-ai-plan.md`: voice capture + Claude connector design
- `docs/07-architecture.md`: the technical blueprint (data model, APIs, parser, MCP, PWA)
- `docs/02-…` and `docs/03-…` are research. Use them for feature ideas only.

## Hard rules

1. **Never copy or paraphrase code from any other repo or app.** Not MIT, not GPL, nothing. Take *ideas* only (features, workflows, UX) from the docs and write all code fresh. Do not open or fetch other projects' source files to "use as reference."
2. Public-domain **data** (Unlicense/CC0, e.g. free-exercise-db) may be imported. Credit data sources where required (e.g. "Food data from Open Food Facts").
3. Standard libraries are installed as npm packages (Next.js, React, Supabase client, a calendar component, etc.). Never vendor or copy library source into the repo.
4. **$0 budget.** No paid services or paid APIs. Do not add the Anthropic API or any other paid AI key. AI features go through Claude via an **MCP connector** (Claude Pro custom connector) or Apple Shortcuts' "Ask Claude" action. Free tiers only: Vercel Hobby and Supabase Free.
5. Never commit secrets. Use `.env.local` (git-ignored) and Vercel/Supabase environment variables.
6. Must run in a **web browser** (teacher's only hard requirement) and work well on iPhone as an installable PWA.

## Product summary

- Modules: homework & classes, calendar & to-dos, gym, calories/nutrition, habits & goals (XP), budget, notes/journal, side business (window-washing jobs). More can be added later.
- Social: friends, groups, school-wide challenges and leaderboards (Phase 5).
- Capture: one iPhone Lock Screen button → Apple Shortcut "Log It": Dictate → Ask Claude (returns JSON) → POST to `/api/capture` → "Saved ✓". Fallback: raw text → our own date/keyword parser → Inbox.
- Every AI capture shows a **review-before-save** screen or lands in an Inbox. Nothing silently writes wrong data.
- Everything ends up in the dashboard. Claude is the brain, never a second storage place.

## Stack (planned)

- Next.js (App Router) + React + TypeScript + Tailwind; PWA (manifest + service worker + web push)
- Supabase: Auth, Postgres with Row Level Security, Storage (PDFs/photos), Realtime (leaderboards)
- Vercel Hobby hosting
- MCP server route inside the Next.js app (remote/HTTP), protected by auth, exposing tools like `add_task`, `log_food`, `log_workout`, `get_today`, `list_due`, `process_inbox`

## Working style

- Small, reviewable commits with clear messages (the teacher reads history).
- Update `docs/06-roadmap.md` checkboxes as features land.
- Explain decisions in plain language. Ethan is learning.
- Ask Ethan before adding any new external service or account signup.
