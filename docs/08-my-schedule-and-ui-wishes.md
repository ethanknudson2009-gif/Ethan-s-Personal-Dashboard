# 08 — My Schedule & UI Wishes

*From Ethan, November 17, 2026. Used for seed data, parser tests and the design phase.*

## Class schedule (Fall 2026)

School is **Monday–Thursday**, the same every week (a *weekly* schedule, not A/B). Two classes a day:

| Day | Morning | Afternoon |
|---|---|---|
| Monday | World History | Choir |
| Tuesday | Human Anatomy | AI Mastermind |
| Wednesday | College Algebra | Speech |
| Thursday | AutoCAD | Church History |

**Still needed from Ethan:** the actual start/end times for "morning" and "afternoon" (placeholders: 8:00–11:30 and 12:30–3:30, editable on the Classes page).

**Days off:** Ethan doesn't need the dashboard to track breaks and holidays (decided Nov 17, 2026), so the Classes page doesn't show them. The database table and schedule logic still support them if that changes.

**Nicknames the quick-add parser understands** (editable later on the Classes page):

| Class | Say any of |
|---|---|
| World History | "world history" |
| Church History | "church history" |
| Choir | "choir" |
| Human Anatomy | "anatomy", "anat" |
| AI Mastermind | "ai", "ai mastermind" |
| College Algebra | "algebra", "math" |
| Speech | "speech" |
| AutoCAD | "cad", "autocad" |

Just "history" is **ambiguous** (two history classes). The parser doesn't guess: the item goes to the Inbox asking "World History or Church History?"

## Work
Ethan is a **Loan Officer Assistant (LOA)** at **PRMI**, part-time hours but treated like a full-time job. He also calls it **"work"**, **"primary"** (which is how speech-to-text often hears "PRMI") or **"the office"**. **Mike** is his **LO** (loan officer). Any of these send a task to the **Work** section (e.g. "primary, send Mike the loan files tomorrow" → Work: "Send Mike the loan files", due tomorrow).

## Study time
About **2 hours every weekday** (Mon–Fri). This is the default in the Cushion math.

## UI wishes (for the design phase, after Phase 1 works)

- **One simple button to talk to the dashboard.** Whatever capture flow we end up with (doc 04), using it must feel like one tap.
- **Tasks and the calendar should be super simple but professional.** Titles show the class first, e.g. **Speech: "What is Equal" Journal**.
- **Highlight what needs checking off:** unfinished tasks and reminders stand out until they're done.
- **A really satisfying check-off animation:** clean, smooth, small and quick, never in the way.
- **Before building the look:** show ~20 visual layout examples and ~20 color combinations as real pictures (see the roadmap).

## Decisions from testing (Nov 17, 2026)
- **Keep adding simple.** No due time, time estimate, priority or "X days after" fields. Quick add is one text box plus chips for class, day and repeat. (A time typed in the text, like "fri 3pm", is still kept.)
- **Cushion is hidden** because it needs time estimates. The math stays in `src/lib/cushion` (tested) in case estimates come back later.
- **Highlights instead of numbers:** overdue glows red, due today pulses teal, tomorrow is amber. The School tab shows a red badge with how many are due or overdue.

## Speech & quick add (Nov 18, 2026)
- Tapping **+** starts the mic right away (Auto-mic switch in the sheet).
- Talk naturally, in any order; fillers, spoken numbers and misheard class names are handled.
- Anything said after the main part ("it needs to be 3 pages", "make sure…", a new sentence) becomes **notes**, shown as a caption under the task.
