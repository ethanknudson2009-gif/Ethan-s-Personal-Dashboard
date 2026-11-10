# Ethan's Personal Dashboard

A personal "life dashboard" web app, built with Claude for a class assignment. It brings school, fitness, food, money, habits, notes and my window-washing side business into **one place**, with friends and leaderboards. It works on a computer browser and installs on my iPhone like an app.

> **Status:** Planning and research complete. No app code yet. Development starts in Phase 1 (see [Roadmap](docs/06-roadmap.md)).

## The idea in one minute

- **One dashboard** for everything: homework and classes, calendar and to-dos, gym, calories, habits and goals, budget, notes/journal, and side-business jobs.
- **One button to talk to it:** press a Lock Screen button on my iPhone, say "bio lab report due Friday" or "ate two eggs and toast," and it's saved, sorted, and on the dashboard.
- **Claude is the brain:** it reads syllabus PDFs, estimates calories from food photos, and plans my week. It connects through a Claude custom connector, so there are no extra paid AI services.
- **Social:** invite friends, groups, or the whole school for challenges and leaderboards.
- **$0 to run:** free hosting (Vercel), free database (Supabase), and my existing Claude Pro plan.

## How this project was planned

Everything below came from a planning session with Claude:

1. **Interview:** what I need, which devices I use, and my limits (no extra paid services).
2. **Competitor research:** 14 top planner, calendar and student apps (MyStudyLife, Motion, Shovel, DormWay, Sunsama, TickTick, Due, Todoist, Fantastical, Amie, and more), picking the single best idea from each.
3. **GitHub research:** about 100 GitHub searches across 10 categories to find the top open-source projects in each, then reading 30 of their READMEs for underrated features.
4. **Phone research:** the fastest ways to capture by voice on an iPhone 13, and how to keep everything in one place.
5. **Rules:** no copying or paraphrasing anyone's code. Ideas only; we build everything ourselves.

## Documents

| Doc | What's in it |
|---|---|
| [01 – Brainstorm & requirements](docs/01-brainstorm-and-requirements.md) | The interview, everything I want, and decisions made |
| [02 – Competitor app research](docs/02-competitor-app-research.md) | 14 apps studied, category winners, our combined designs |
| [03 – GitHub repo research](docs/03-github-repo-research.md) | Top 10 repos in each of 10 categories, plus underrated features |
| [04 – iPhone capture & AI plan](docs/04-iphone-capture-and-ai-plan.md) | One-button voice, Claude connector, "one app" plan |
| [05 – Code & license rules](docs/05-code-and-license-rules.md) | How we use other projects (ideas only, no code) |
| [06 – Roadmap](docs/06-roadmap.md) | Build phases and feature backlog |
| [07 – Architecture](docs/07-architecture.md) | Folders, database, capture API, parser, Claude connector, PWA plan |

A live, editable copy of the research is also kept as a Claude Doc: *Personal Dashboard — Best-of-the-Best Research Blueprint*.

## Planned tech stack

- **Next.js + React + TypeScript**: the web app, installable on a phone as a PWA
- **Supabase** (free tier): login, database, file storage, realtime leaderboards
- **Vercel** (free Hobby plan): hosting
- **MCP server** inside the app: lets Claude (web, desktop, iPhone) read and write dashboard data
- **Apple Shortcuts:** the one-button "Log It" voice capture on iPhone

## Built with

Planned and built with [Claude](https://claude.ai) (research and planning) and Claude Code (coding).
