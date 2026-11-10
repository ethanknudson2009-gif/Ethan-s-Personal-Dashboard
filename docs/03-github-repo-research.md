# 03 — GitHub Repo Research

**Method:** I used the GitHub search API (about 100 searches across 10 categories, by keyword and topic, excluding archived repos), ranked results by stars, and filtered by hand for relevance. Then I read the READMEs of 30 key projects to find underrated features. Stars and licenses are as of November 10, 2026.

> **Reminder:** these projects are studied for **ideas only**. We do not copy or paraphrase any of their code. See [doc 05](05-code-and-license-rules.md).

**License key:** ✅ permissive (MIT/BSD/Apache/Unlicense) · 🔒 copyleft (GPL/AGPL/MPL) · ⚠️ custom or unclear. The license doesn't matter for us, because we copy no code. It's listed for completeness.

**Big takeaway:** the most-starred projects are phone-only apps or Docker servers you run on your own machine, not web apps for Vercel. Student-planner repos are tiny (most under 150 stars), so the best school ideas come from the commercial apps in doc 02. That's why we're building our own.

## 1. Homework / student planners
| Repo | ★ | License | Idea |
|---|---|---|---|
| Sion612/rubrictrail | 128 | ✅ | Assignment planner built around the rubric |
| devsoc-unsw/circles | 72 | ⚠️ | Drag-and-drop degree planner |
| kaorii-ako/Shiori-v1 | 48 | ✅ | Google Classroom sync, AI study plans, flashcards |
| vincenzo-afk/Synapse | 39 | ✅ | Installable web app: habits + tasks |
| Limecore-Studio/StudyDesk | 32 | ✅ | Anti-procrastination study planner |
| tanjeffreyz/planit | 13 | ⚠️ | Assignments compiled into a calendar |
| HeliumEdu/platform | 12 | ✅ | Classes, calendar, grades |
| sudoguy47/Uniro | 12 | ✅ | Tasks, routines, assignments, notes |
| edwyj/ddl-killer | 5 | 🔒 | Timetable + deadlines + AI scheduling |
| ramneek1-exe/deadliner | small | — | Syllabus → AI → calendar file |

## 2. Calendar
| Repo | ★ | License | Idea |
|---|---|---|---|
| schedule-x/schedule-x | 2.6k | ✅ | Modern calendar component (could be installed as a package) |
| fullcalendar/fullcalendar-react | 2.5k | ✅ | Classic calendar component |
| ulsklyc/yuvomi | 2.3k | ✅ | Family planner: tasks, calendar, budget, meals |
| karolkozer/planby | 1.7k | ⚠️ | Timeline views |
| add2cal/add-to-calendar-button | 1.5k | ⚠️ | "Add to calendar" buttons |
| ridafkih/keeper.sh | 1.5k | 🔒 | Calendar sync + a Claude connector for calendars |
| yassir-jeraidi/full-calendar | 484 | ✅ | Polished React calendar |
| kcsujeet/ilamy-calendar | 355 | ✅ | Day/week/month/year with drag-and-drop |
| origin-space/event-calendar | 294 | ✅ | Clean calendar component |
| list-jonas/shadcn-ui-big-calendar | 272 | ✅ | Light/dark big calendar |

## 3. Tasks / to-do
| Repo | ★ | License | Idea |
|---|---|---|---|
| super-productivity/super-productivity | 23.6k | ✅ | Timeboxing, time tracking, Pomodoro |
| go-vikunja/vikunja | 6.0k | 🔒 | Lists, kanban, Gantt |
| chrisvel/tududi | 3.5k | ✅ | Tasks + projects + notes + areas |
| donetick/donetick | 2.7k | 🔒 | Chores with others, flexible repeats |
| dongdongbh/Mindwtr | 2.4k | 🔒 | Capture-everything inbox and weekly review |
| manuelernestog/weektodo | 2.2k | 🔒 | Weekly planner layout |
| fccview/jotty | 2.0k | 🔒 | Checklists + notes |
| emanuele-em/kanzo | 1.1k | 🔒 | Kanban shared by people and AI agents |
| dohsimpson/TaskTrove | 1.1k | ⚠️ | Modern to-do app |
| RARgames/4gaBoards | 738 | ✅ | Real-time kanban |

## 4. Gym / workout
| Repo | ★ | License | Idea |
|---|---|---|---|
| DuarteSantos8/openGym | 20.8k | 🔒 | Most popular gym tracker |
| wger-project/wger | 7.3k | 🔒 | Workouts + nutrition + weight |
| CodeWithCJ/SparkyFitness | 6.8k | ⚠️ | Food, fitness, water; family accounts |
| IgnisDa/ryot | 3.7k | 🔒 | Tracking with graphs |
| chrisdoc/hevy-mcp | 536 | ✅ | Logging workouts through a Claude connector |
| aceberg/ExerciseDiary | 473 | ✅ | Year-long workout heatmap |
| brandonp2412/Flex | 452 | ✅ | Strength + cardio, rest timers |
| Cawlumm/lyftr | 362 | ✅ | Workouts + nutrition on the web |
| vanalmsick/workout_challenge | 153 | ⚠️ | Fitness challenges between friends |
| yuhonas/free-exercise-db | 2.1k | ✅ Unlicense | 800+ exercises: **public-domain data we can import** |

## 5. Calories / nutrition
| Repo | ★ | License | Idea |
|---|---|---|---|
| simonoppowa/OpenNutriTracker | 2.9k | 🔒 | Simple calorie tracker |
| openfoodfacts/smooth-app | 1.5k | ✅ | Barcode scanning |
| openfoodfacts/openfoodfacts-server | 1.2k | 🔒 | The free food database (we use its API, with credit) |
| maksimowiczm/FoodYou | 623 | 🔒 | Food diary |
| apoorvdarshan/fud-ai | 524 | ✅ | AI calorie estimates from photos |
| TraceApps/nutritrace | 377 | 🔒 | Self-hosted nutrition tracker |
| kcal-app/kcal | 357 | 🔒 | Food journal |
| vangelov/calories-in | 187 | ✅ | Meal-plan editor |
| brandonp2412/FitBook | 177 | ✅ | Barcodes, macros, graphs |
| jrhizor/awesome-nutrition-tracking | 152 | ✅ CC0 | Curated list of nutrition tools |

## 6. Habits / goals
| Repo | ★ | License | Idea |
|---|---|---|---|
| HabitRPG/habitica | 14.3k | ⚠️ | Habits as a role-playing game with parties and challenges |
| iSoron/uhabits (Loop) | 10.4k | 🔒 | Habit-strength score |
| daya0576/beaverhabits | 1.9k | ✅ | Clean web habit tracker |
| FriesI23/mhabit | 1.7k | ✅ | Smart habit scoring |
| xpavle00/Habo | 1.6k | 🔒 | Simple habit tracker |
| InlitX/streak | 1.2k | 🔒 | Streak-focused design |
| dohsimpson/HabitTrove | 694 | 🔒 | Coins → reward wishlist |
| jofoerster/habitsync | 349 | ✅ | Challenges with friends |
| Vsein/Neohabit | 292 | 🔒 | Heatmaps, skill trees |
| get-thriving/thrive | 173 | ✅ | Goals system |

## 7. Budget / money
| Repo | ★ | License | Idea |
|---|---|---|---|
| actualbudget/actual | 30.1k | ✅ | Envelope budgeting |
| firefly-iii/firefly-iii | 25.2k | 🔒 | Full personal-finance manager |
| ghostfolio/ghostfolio | 9.7k | 🔒 | Investments |
| ellite/Wallos | 8.8k | 🔒 | Subscription tracker |
| mayswind/ezbookkeeping | 6.1k | ✅ | Receipt reading, map locations |
| jameskokoska/Cashew | 4.8k | 🔒 | Beautiful budget design |
| Tanq16/ExpenseOwl | 1.5k | ✅ | Super-simple expense tracker |
| TheAxelander/OpenBudgeteer | 974 | 🔒 | Bucket budgeting |
| teelur/budget-board | 896 | 🔒 | Spending + goals |
| simonwep/ocular | 581 | ✅ | Simple budget view |

## 8. Notes / journal
| Repo | ★ | License | Idea |
|---|---|---|---|
| usememos/memos | 64.4k | ✅ | Quick-capture timeline |
| siyuan-note/siyuan | 47.2k | 🔒 | Knowledge workspace |
| lfnovo/open-notebook | 41.8k | ✅ | Chat with your PDFs and notes |
| TriliumNext/Trilium | 38.8k | 🔒 | Knowledge base |
| streetwriters/notesnook | 14.9k | 🔒 | Encrypted notes |
| jrnl-org/jrnl | 7.4k | 🔒 | Journaling |
| Smaug6739/Alexandrie | 3.9k | ✅ | Offline-first notes |
| dullage/flatnotes | 3.3k | ✅ | Simple notes web app |
| UdaraJay/Pile | 3.1k | ⚠️ | Reflective journaling |
| brufdev/many-notes | 1.1k | ✅ | Markdown notes |

## 9. All-in-one life dashboards
| Repo | ★ | License | Idea |
|---|---|---|---|
| khoj-ai/khoj | 38.1k | 🔒 | AI "second brain" |
| lissy93/dashy | 27.0k | ✅ | Widget dashboard layout |
| danielmiessler/LifeOS | 19.8k | ✅ | AI life OS (runs on a computer) |
| Volmarg/personal-management-system | 4.2k | ✅ | Personal data manager |
| ulsklyc/yuvomi | 2.3k | ✅ | Modules that work together |
| Lifeforge-app/lifeforge | 1.7k | ⚠️ non-commercial | Modular life manager |
| surajverma/homehub | 1.3k | ✅ | Family hub web app |
| krelltunez/dayGLANCE | 185 | ✅ | "Your day at a glance" |
| edrisranjbar/lifeos | 119 | ✅ | Life OS with a Claude connector |
| lifeos-app/lifeos | 24 | ✅ | Life as a role-playing game, as an installable web app |

## 10. AI, voice & Claude connectors (MCP)
| Repo | ★ | License | Idea |
|---|---|---|---|
| taylorwilsdon/google_workspace_mcp | 3.5k | ✅ | Polished connector design |
| amicalhq/amical | 1.6k | ✅ | AI dictation app |
| ridafkih/keeper.sh | 1.5k | 🔒 | Calendar connector |
| chrisdoc/hevy-mcp | 536 | ✅ | Workout connector |
| abhiz123/todoist-mcp-server | 392 | ✅ | Tasks in plain English |
| FradSer/mcp-server-apple-events | 232 | ✅ | Apple Reminders/Calendar connector |
| zcaceres/gtasks-mcp | 176 | ✅ | Google Tasks connector |
| kaijiabo/open-sunsama | 162 | ⚠️ | Planner with a one-click Claude connector |
| b0x42/Super-Productivity-MCP | 134 | ✅ | Tasks connector |
| edrisranjbar/lifeos | 119 | ✅ | 15–26 life tools exposed to Claude |

## Underrated features worth building (our own versions)

**Homework**
- *RubricTrail:* Brief → Rubric → Plan → Check → Submit; warns when your weekly study time can't cover the deadline; self-checks against each rubric item; a final submission checklist; reads text from photos of handouts in the browser for free.
- *Shiori:* weighted grades with GPA prediction; day-by-day study plans from a syllabus; XP and a friends leaderboard.

**Tasks** (school + window-washing jobs)
- *Donetick:* repeats scheduled from when you actually finished; tasks that can only be checked off near their due time; NFC tags that complete a task; "Things" for tracking numbers or yes/no values; points.
- *Tududi:* assign tasks to people who don't use the app (customers, a helper).
- *Super Productivity:* an anti-procrastination prompt, break reminders, an Eisenhower board.
- *Mindwtr:* a guided weekly review and a "Waiting For" list.
- *dayGLANCE:* a Plan vs. Actual view.

**Gym**
- *openGym:* weights filled in from last time; a backup exercise when a machine is taken; plate math; progression rules; a map of which muscles are still recovering; A/B/C rotations; a reminder when you arrive at the gym.
- *Workout Challenge:* friend competitions with goals; a weekly leaderboard email.

**Calories**
- *Fud AI:* analyze several photos together; "Meal What-If" before logging; review and edit before saving; calorie goals that adjust from your weight trend; detection of under-logging.
- *OpenNutriTracker:* quick add with just a name and calories; calorie targets per meal; barcode lookup.

**Habits & motivation**
- *HabitSync:* monthly challenges with voting and medals; an alert when a friend overtakes you; tracking of habits you're trying to cut back on.
- *HabitTrove / Yuvomi:* earn coins and spend them on a reward wishlist.
- *Loop:* a habit-strength score, so one missed day doesn't reset you to zero.
- *Neohabit:* goals like "3 times in 10 days"; skill trees.

**Money & notes**
- *ExpenseOwl:* tap a category to hide it from the chart.
- *ezBookkeeping:* receipt reading; job-site locations on a map.
- *Yuvomi:* modules that work together (a receipt attaches to both the expense and the item).
- *HomeHub:* a 7-day Trash.
- *Memos:* a quick-capture timeline.

## Top 10 picks to build in
1. Lock Screen "Log It" button with Claude doing the sorting
2. A review-before-save screen for every AI capture
3. Repeats based on when you finished + a Plan vs. Actual view
4. Cushion / study-time capacity warnings
5. A habit-strength score instead of all-or-nothing streaks
6. Coins spent on your own reward wishlist
7. Friend challenges with "overtake" alerts
8. Gym: weights filled in from last time, a backup exercise, a recovery map
9. Meal What-If + calorie goals that adapt
10. A 7-day Trash + a guided weekly review
