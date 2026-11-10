# 02 — Competitor App Research

**Goal:** study the top student planners, calendars and dashboard apps, find the single best idea in each category (calendar, PDF upload, notifications, design), and build those ideas into our own free dashboard. Ideas only, never code (see [doc 05](05-code-and-license-rules.md)).

## Category winners

| Category | Winner | The one idea we're taking |
|---|---|---|
| Calendar (school) | MyStudyLife | Rotating / A-B / block schedules + snap a photo of your timetable to build it |
| Calendar (smart) | Motion | Auto-schedules tasks into free time and re-plans when things move |
| Calendar (time reality-check) | Shovel | "The Cushion": hours you have vs. hours you need, per assignment |
| Fast entry | Fantastical + Todoist | Type or say "Bio lab report due Fri 11:59pm" and it fills in the details itself |
| PDF / syllabus upload | DormWay | Upload a syllabus → AI pulls deadlines, grade weights, late policy → you review before saving |
| Notifications | Due + TickTick | Keeps reminding you until it's done, plus a daily summary and one-tap snooze |
| Daily routine | Sunsama | Morning planning + evening shutdown, warns when you overcommit |
| Habits | Reclaim | Habits get time blocks that move around your schedule |
| Gamification | Todoist Karma | Points, levels, daily/weekly streaks, vacation mode |
| Grades | Power Planner | Weighted GPA + "What If?" mode for the grade you need |
| Beautiful design | Amie, Notion Calendar, Structured | Drag tasks onto the calendar; calm minimal UI; color-coded day timeline |

## The 14 apps

### Student planners
1. **MyStudyLife** (free; web, iOS, Android; 10M+ students): rotating, A/B-week and block schedules, terms and holidays; Schedule Scan builds a timetable from a photo or PDF; "Scout" AI coach; reminders, including for overdue homework; grade tracking; Pomodoro timer; widgets; streaks. **Take:** rotation schedules, timetable scan, overdue alerts, automatic subject colors.
2. **Power Planner** (free, one-time premium): semesters, classes with rooms, weighted GPA across semesters, a "What If?" mode, and an end-of-day notification about tomorrow. **Take:** GPA + What-If, tomorrow preview.
3. **Shovel** (paid): treats free time as study time; the Cushion (available hours minus estimated hours) tells you whether you're ahead or behind; time-blocking; AI syllabus upload with a review screen. **Take:** the Cushion meter and turning a "due date" into a "do date."
4. **DormWay** (free): AI Syllabus Reader (assignments, dates, exams, grading breakdown, late policy) with a review step; you can even email it a syllabus; a Do Now / Up Next / Due Soon timeline. **Take:** the syllabus pipeline, the review step, and the three-part timeline.

### Smart calendars & daily planners
5. **Motion** (paid): auto-scheduling by priority, deadline, length and free time; reschedules automatically; flags tasks at risk of missing their deadline. **Take:** a "plan my day" button and at-risk warnings.
6. **Reclaim.ai** (free plan): habit time blocks that adjust to your schedule, focus-time goals, time analytics. **Take:** flexible gym/habit blocks and a "where my time went" chart.
7. **Sunsama** (paid): a guided morning plan with an overcommit warning, an evening shutdown, a weekly review. **Take:** Morning Plan + Shutdown, paired with the journal.
8. **Structured** (freemium, 1M+ users): the whole day as one color-and-icon timeline; drag-and-drop; an inbox; habits shown in the timeline. **Take:** the Today timeline as the dashboard's centerpiece.
9. **Fantastical** (paid): best-in-class plain-English entry, including dictation; day/week/month/quarter/year views; even has a Claude connector. **Take:** a smart text box and a semester view.
10. **Notion Calendar** (free): known for clean, minimal, fast design and a command bar. **Take:** its design style and a ⌘K command bar.

### Tasks, reminders & design
11. **TickTick:** Constant Reminders, snooze for minutes/hours/tomorrow, a daily summary notification, Pomodoro, countdowns, habits, an Eisenhower matrix. **Take:** snooze options, the daily digest, exam countdowns.
12. **Due:** Auto Snooze keeps notifying every 1–60 minutes until you act; Prominent Alerts break through Silent mode; quick +1h / +3h / +1 day buttons. Reviews warn that constant nagging stresses people out. **Take:** a per-item "nag level" (off / gentle / persistent).
13. **Todoist:** Quick Add understands things like "every Friday at 4pm #Work p1"; "Ramble" voice entry; Karma points, levels, streaks, vacation mode. **Take:** XP and streaks, the base for our leaderboards.
14. **Amie:** often called the most beautiful calendar; drag to-dos onto the calendar; delightful animations. **Take:** drag from list to calendar and small animations.

## Our combined designs

### Calendar
- Views: Today timeline, Week, Month, Semester.
- School-aware: rotating / A-B / block schedules, terms, holidays.
- Everything on one calendar (classes, assignments, exams, gym, window-washing jobs, work shifts), color-coded by area.
- Plain-English and voice entry; a "Plan my day" button; habit blocks that adjust around everything else.
- A Cushion meter on every assignment; drag tasks onto the calendar.
- iCal import/export.

### PDF / file upload
- Two ways in: upload on the website, or send a file through Claude (connector or Shortcut).
- Accepts PDFs, photos, screenshots and Word docs.
- Pulls out assignments, dates, exams, grade weights, late policy and class times.
- **A review screen before saving.**
- The file stays attached to its class so you can ask questions about it later.
- Also works for gym program PDFs and nutrition labels.

### Notifications
- A morning digest and an evening "tomorrow" preview.
- Smart reminders timed by the Cushion.
- A nag level per item; one-tap Done / +1h / Tonight / Tomorrow.
- Overdue and streak-at-risk alerts; quiet hours; social alerts are opt-in.
- On iPhone, notifications only work after "Add to Home Screen" (iOS 16.4+), so onboarding has to walk through it. Email is a backup.

### Dashboard design
- Home = "Today": Do Now / Up Next / Due Soon, the day timeline, habit rings, calories left, today's workout, XP and streak.
- A calm, minimal base; color only where it means something (one per life area).
- Small moments of delight: check-off animation, confetti on milestones.
- Dark/light mode; bottom tab bar on phone, sidebar on desktop; ⌘K command bar; cards you can rearrange.

## Sources
- MyStudyLife: https://mystudylife.com/ · https://mystudylife.com/tour/
- Power Planner: https://apps.microsoft.com/detail/9WZDNCRFJ25V
- Shovel, The Cushion (Purdue): https://purdue.edu/teaching-learning/programs/sst/assets/Shovel%20-%20The%20Cushion.pdf
- DormWay: https://dormway.app/for-students
- Motion: https://www.usemotion.com/help/time-management/auto-scheduling
- Reclaim: https://reclaim.ai/pricing
- Sunsama review: https://clickup.com/blog/sunsama-review/
- Structured: https://apps.apple.com/app/1499198946
- Fantastical: https://apps.apple.com/gb/app/id718043190
- Notion Calendar review: https://toolfinder.co/tools/cron-calendar
- TickTick review: https://tidbits.com/?p=71296
- Due review: https://tidbits.com/2024/07/06/just-due-it-persistent-notifications-for-tasks/
- Todoist Karma: https://todoist.com/help/articles/introduction-to-karma
- Amie review: https://ellieplanner.com/comparisons/amie-calendar-review
- iOS web push for PWAs: https://www.mobiloud.com/blog/progressive-web-apps-ios
