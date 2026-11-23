import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TIME_ZONE, addDays, fromLocal, toLocalDate } from "@/lib/time";
import { formatDue, formatTimeOfDay, taskDisplayTitle } from "@/lib/format";
import { captureSchema, decide, moneyRowFromDraft, readDraft, SAVEABLE_TYPES, taskRowFromDraft } from "@/lib/capture";
import { categorize } from "@/lib/money/categories";
import { nextOccurrence, repeatFromForm } from "@/lib/tasks";
import { describeDraft } from "@/lib/capture/handle";
import { classesOn, type ScheduleContext } from "@/lib/schedule";
import { coachTips } from "@/lib/gym-coach";

/**
 * The Claude connector (MCP server). Claude on the web, desktop or iPhone can
 * read and add to the dashboard through these tools. See docs/07 §10.
 *
 * Safety rules:
 *  - Built fresh for ONE user per request (from their private mcp token);
 *    every query is filtered by that user's id.
 *  - Things Claude adds go to the Inbox for review unless the user clearly
 *    confirmed the exact details in the chat (`confirmed_by_user`).
 *  - Dates always go through our own parser (Claude passes the words).
 */
export function buildMcpServer(userId: string) {
  const db = createAdminClient();
  const server = new McpServer({ name: "ethans-dashboard", version: "1.0.0" });
  const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

  async function context() {
    const [{ data: profile }, { data: classes }] = await Promise.all([
      db.from("profiles").select("timezone, auto_save_types").eq("id", userId).maybeSingle(),
      db.from("classes").select("id, name, color, short_names").eq("user_id", userId).is("deleted_at", null).eq("archived", false),
    ]);
    const timeZone = profile?.timezone || DEFAULT_TIME_ZONE;
    const list = classes ?? [];
    return {
      timeZone,
      autoSaveTypes: profile?.auto_save_types ?? [],
      classes: list.map((c) => ({ id: c.id, name: c.name, shortNames: c.short_names })),
      className: new Map(list.map((c) => [c.id, c.name])),
    };
  }

  async function openTasks() {
    const { data } = await db
      .from("tasks")
      .select("id, title, class_id, due_at, due_has_time")
      .eq("user_id", userId)
      .eq("status", "open")
      .is("deleted_at", null)
      .order("due_at", { ascending: true, nullsFirst: false });
    return data ?? [];
  }

  // ── Read ────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_today",
    {
      title: "Today at a glance",
      description:
        "Ethan's day: today's date, classes meeting today, what's overdue or due today, what's due tomorrow, and how many Inbox items wait for review. Call this first when he asks about his day or what to do.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const ctx = await context();
      const now = new Date();
      const today = toLocalDate(now, ctx.timeZone);
      const tomorrow = addDays(today, 1);
      const tasks = await openTasks();
      const line = (t: (typeof tasks)[number]) =>
        `- ${taskDisplayTitle(t.title, t.class_id ? (ctx.className.get(t.class_id) ?? null) : null)} — ${formatDue(new Date(t.due_at!), t.due_has_time, now, ctx.timeZone)} [id: ${t.id}]`;
      const dated = tasks.filter((t) => t.due_at);
      const urgent = dated.filter((t) => toLocalDate(new Date(t.due_at!), ctx.timeZone) <= today);
      const tmr = dated.filter((t) => toLocalDate(new Date(t.due_at!), ctx.timeZone) === tomorrow);

      const meetings = await todaysClasses(today);
      const [{ data: habits }, { data: checked }] = await Promise.all([
        db.from("habits").select("id, name").eq("user_id", userId).is("deleted_at", null).eq("archived", false),
        db.from("habit_checkins").select("habit_id").eq("user_id", userId).eq("on_date", today),
      ]);
      const doneIds = new Set((checked ?? []).map((c) => c.habit_id));
      const { count } = await db.from("inbox_items").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending").is("deleted_at", null);

      return text(
        [
          `Today is ${today} (${ctx.timeZone}).`,
          meetings.length ? `Classes today:\n${meetings.map((m) => `- ${m.name} ${formatTimeOfDay(m.starts)}–${formatTimeOfDay(m.ends)}`).join("\n")}` : "No classes today.",
          urgent.length ? `Overdue or due today:\n${urgent.map(line).join("\n")}` : "Nothing overdue or due today.",
          tmr.length ? `Due tomorrow:\n${tmr.map(line).join("\n")}` : "Nothing due tomorrow.",
          habits?.length ? `Habits today: ${habits.map((h) => `${h.name} ${doneIds.has(h.id) ? "✓" : "✗"}`).join(", ")}.` : "No habits set up.",
          `Inbox items waiting for review: ${count ?? 0}.`,
        ].join("\n\n"),
      );
    },
  );

  async function todaysClasses(today: string) {
    const [{ data: term }, { data: rows }] = await Promise.all([
      db
        .from("terms")
        .select("starts_on, ends_on, schedules(kind, school_weekdays, day_labels, anchor_date, anchor_label), no_school_days(date)")
        .eq("user_id", userId)
        .order("starts_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("class_meetings")
        .select("weekday, day_label, starts_at, ends_at, classes!inner(id, name, deleted_at)")
        .eq("user_id", userId)
        .is("classes.deleted_at", null),
    ]);
    if (!term?.schedules) return [];
    const s = term.schedules;
    const ctx: ScheduleContext = {
      term: { startsOn: term.starts_on, endsOn: term.ends_on },
      schedule: {
        kind: s.kind === "rotating" ? "rotating" : "weekly",
        schoolWeekdays: s.school_weekdays,
        dayLabels: s.day_labels,
        anchorDate: s.anchor_date ?? term.starts_on,
        anchorLabel: s.anchor_label ?? s.day_labels[0] ?? "",
      },
      noSchoolDays: (term.no_school_days ?? []).map((d) => d.date),
    };
    const meetings = (rows ?? []).map((r) => ({ classId: r.classes.id, weekday: r.weekday, dayLabel: r.day_label, startsAt: r.starts_at, endsAt: r.ends_at, name: r.classes.name }));
    return classesOn(today, ctx, meetings).map((m) => {
      const r = m as (typeof meetings)[number];
      return { name: r.name, starts: r.startsAt, ends: r.endsAt };
    });
  }

  server.registerTool(
    "list_due",
    {
      title: "List what's due",
      description: "Open tasks and assignments due in the next N days (default 7), optionally for one class. Includes overdue items and each task's id.",
      inputSchema: {
        days: z.number().int().min(1).max(120).optional().describe("How many days ahead to look (default 7)"),
        class_name: z.string().optional().describe("Only this class, e.g. 'Speech'"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ days, class_name }) => {
      const ctx = await context();
      const now = new Date();
      const limit = fromLocal(addDays(toLocalDate(now, ctx.timeZone), (days ?? 7) + 1), { hour: 0, minute: 0 }, ctx.timeZone);
      let tasks = (await openTasks()).filter((t) => t.due_at && new Date(t.due_at) < limit);
      if (class_name) {
        const wanted = class_name.toLowerCase();
        tasks = tasks.filter((t) => t.class_id && (ctx.className.get(t.class_id) ?? "").toLowerCase().includes(wanted));
      }
      if (!tasks.length) return text("Nothing due in that range.");
      return text(
        tasks
          .map((t) => `- ${taskDisplayTitle(t.title, t.class_id ? (ctx.className.get(t.class_id) ?? null) : null)} — ${formatDue(new Date(t.due_at!), t.due_has_time, now, ctx.timeZone)} [id: ${t.id}]`)
          .join("\n"),
      );
    },
  );

  // ── Add ─────────────────────────────────────────────────────────────────
  const addInput = {
    title: z.string().min(1).max(200).describe("Short title WITHOUT the class name or date words, e.g. 'Outline'"),
    class_name: z.string().max(80).optional().describe("The class, if it's school work, e.g. 'Speech'"),
    due_text: z
      .string()
      .max(100)
      .optional()
      .describe("The due date/time words exactly as said, e.g. 'friday 3pm' or 'tomorrow'. Do NOT convert to a date; the dashboard does that."),
    repeat: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
    area: z.enum(["school", "work", "personal"]).optional().describe("'work' for Ethan's job at PRMI; school tasks normally have a class"),
    notes: z.string().max(2000).optional().describe("Extra details Ethan mentioned (page count, what to bring…)"),
    confirmed_by_user: z
      .boolean()
      .optional()
      .describe("true ONLY if Ethan clearly confirmed these exact details in this chat. Otherwise leave false: it goes to his Inbox to review."),
  };

  async function addTask(
    args: { title: string; class_name?: string; due_text?: string; repeat?: string; area?: "school" | "work" | "personal"; notes?: string; confirmed_by_user?: boolean },
    type: "homework" | "task",
  ) {
    const ctx = await context();
    const input = captureSchema.parse({
      raw_text: [args.class_name, args.title, args.due_text ? `due ${args.due_text}` : ""].filter(Boolean).join(" "),
      type,
      title: args.title,
      class_name: args.class_name,
      due_text: args.due_text,
      confidence: args.confirmed_by_user ? 1 : 0.8,
      notes: args.notes,
    });
    const decision = decide(input, {
      now: new Date(),
      timeZone: ctx.timeZone,
      classes: ctx.classes,
      autoSaveTypes: args.confirmed_by_user ? ["homework", "task"] : ctx.autoSaveTypes,
    });
    if (args.area) decision.draft.area = args.area;
    const what = describeDraft(decision.draft);
    if (decision.autoSave) {
      const repeat = repeatFromForm(args.repeat ?? "none");
      const { data, error } = await db
        .from("tasks")
        .insert({ ...taskRowFromDraft(decision.draft, ctx.timeZone, "mcp"), repeat, user_id: userId })
        .select("id")
        .single();
      if (error || !data) return text(`Couldn't save: ${error?.message}`);
      return text(`Saved to the dashboard: ${what} [id: ${data.id}]`);
    }
    await db.from("inbox_items").insert({
      user_id: userId,
      raw_text: input.raw_text,
      draft: decision.draft,
      type: decision.draft.type,
      confidence: decision.confidence,
      problems: decision.problems,
      source: "mcp",
    });
    return text(
      `Added to Ethan's Inbox for review: ${what}.${decision.problems.length ? ` Notes: ${decision.problems.join("; ")}.` : ""} He can approve it with one tap.`,
    );
  }

  server.registerTool(
    "add_assignment",
    { title: "Add a school assignment", description: "Add homework, a test or a project for one of Ethan's classes.", inputSchema: addInput },
    async (args) => addTask(args, "homework"),
  );
  server.registerTool(
    "add_task",
    { title: "Add a to-do", description: "Add a personal to-do (not tied to a class).", inputSchema: addInput },
    async (args) => addTask(args, "task"),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Check off a task",
      description: "Mark a task done by its id (from get_today or list_due). Repeating tasks create their next copy automatically. Only do this when Ethan says it's done.",
      inputSchema: { task_id: z.string().uuid() },
    },
    async ({ task_id }) => {
      const { data: task } = await db
        .from("tasks")
        .select("id, title, kind, class_id, notes, due_at, due_has_time, estimate_minutes, priority, repeat, series_id, nag_level, source, status")
        .eq("user_id", userId)
        .eq("id", task_id)
        .maybeSingle();
      if (!task) return text("No task with that id.");
      if (task.status === "done") return text("That task is already done.");
      const now = new Date();
      const seriesId = task.series_id ?? task.id;
      await db.from("tasks").update({ status: "done", completed_at: now.toISOString(), series_id: task.repeat ? seriesId : task.series_id }).eq("id", task.id).eq("user_id", userId);
      const ctx = await context();
      const next = nextOccurrence(task, now, ctx.timeZone);
      if (next) {
        await db.from("tasks").insert({
          user_id: userId,
          title: task.title,
          kind: task.kind,
          class_id: task.class_id,
          notes: task.notes,
          due_at: next.toISOString(),
          due_has_time: task.due_has_time,
          repeat: task.repeat,
          series_id: seriesId,
          source: task.source,
        });
      }
      return text(`Checked off: ${task.title}.${next ? ` Next one due ${toLocalDate(next, ctx.timeZone)}.` : ""}`);
    },
  );

  // ── Habits ──────────────────────────────────────────────────────────────
  server.registerTool(
    "log_habit",
    {
      title: "Check in a habit",
      description:
        "Mark one of Ethan's habits done for today (e.g. when he says 'I went to the gym' or 'did my reading'). Set done=false to undo. Matches the habit by name.",
      inputSchema: { habit_name: z.string().min(1).max(60), done: z.boolean().optional() },
    },
    async ({ habit_name, done }) => {
      const ctx = await context();
      const today = toLocalDate(new Date(), ctx.timeZone);
      const { data: habits } = await db.from("habits").select("id, name").eq("user_id", userId).is("deleted_at", null).eq("archived", false);
      const wanted = habit_name.toLowerCase();
      const match =
        habits?.find((h) => h.name.toLowerCase() === wanted) ??
        habits?.find((h) => h.name.toLowerCase().includes(wanted) || wanted.includes(h.name.toLowerCase()));
      if (!match) {
        return text(`No habit called "${habit_name}". His habits: ${habits?.map((h) => h.name).join(", ") || "none yet (he can add them on the Life tab)"}.`);
      }
      if (done === false) {
        await db.from("habit_checkins").delete().eq("user_id", userId).eq("habit_id", match.id).eq("on_date", today);
        return text(`Un-checked ${match.name} for today.`);
      }
      await db.from("habit_checkins").upsert({ user_id: userId, habit_id: match.id, on_date: today }, { onConflict: "habit_id,on_date" });
      return text(`Checked in: ${match.name} ✓ for today.`);
    },
  );

  // ── Inbox ───────────────────────────────────────────────────────────────
  server.registerTool(
    "process_inbox",
    {
      title: "Review the Inbox",
      description:
        "List pending Inbox items, or approve/dismiss specific ones by id. Only approve or dismiss items Ethan named or agreed to in this chat.",
      inputSchema: {
        action: z.enum(["list", "approve", "dismiss"]),
        ids: z.array(z.string().uuid()).max(50).optional(),
      },
    },
    async ({ action, ids }) => {
      const ctx = await context();
      if (action === "list") {
        const { data } = await db
          .from("inbox_items")
          .select("id, raw_text, draft, problems, source")
          .eq("user_id", userId)
          .eq("status", "pending")
          .is("deleted_at", null)
          .order("created_at");
        if (!data?.length) return text("The Inbox is empty.");
        return text(
          data
            .map((i) => {
              const d = readDraft(i.draft);
              return `- [id: ${i.id}] "${i.raw_text}" → ${d ? describeDraft(d) : "(unreadable)"}${i.problems.length ? ` (check: ${i.problems.join("; ")})` : ""}`;
            })
            .join("\n"),
        );
      }
      if (!ids?.length) return text("Give the ids to approve or dismiss.");
      const results: string[] = [];
      for (const id of ids) {
        const { data: item } = await db.from("inbox_items").select("id, draft, source, status").eq("user_id", userId).eq("id", id).maybeSingle();
        if (!item || item.status !== "pending") {
          results.push(`${id}: not found or already handled`);
          continue;
        }
        if (action === "dismiss") {
          await db.from("inbox_items").update({ status: "dismissed" }).eq("id", id).eq("user_id", userId);
          results.push(`${id}: dismissed`);
          continue;
        }
        const d = readDraft(item.draft);
        if (!d || !SAVEABLE_TYPES.includes(d.type)) {
          results.push(`${id}: can't be saved yet (${d?.type ?? "unknown"} tracking isn't built)`);
          continue;
        }
        if (d.type === "expense" && d.amount == null) {
          results.push(`${id}: needs an amount first`);
          continue;
        }
        const table = d.type === "expense" ? "money_transactions" : "tasks";
        const { data: saved } =
          d.type === "expense"
            ? await db.from("money_transactions").insert({ ...moneyRowFromDraft(d, toLocalDate(new Date(), ctx.timeZone)), user_id: userId }).select("id").single()
            : await db.from("tasks").insert({ ...taskRowFromDraft(d, ctx.timeZone, item.source), user_id: userId }).select("id").single();
        await db.from("inbox_items").update({ status: "approved", result_table: table, result_id: saved?.id ?? null }).eq("id", id).eq("user_id", userId);
        results.push(`${id}: approved → ${describeDraft(d)}`);
      }
      return text(results.join("\n"));
    },
  );

  // ── Files & syllabus import ───────────────────────────────────────────────
  server.registerTool(
    "list_files",
    {
      title: "List uploaded files",
      description: "Syllabus PDFs and other files Ethan uploaded on the Classes page, with their class and whether the text is ready to read.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const ctx = await context();
      const { data } = await db
        .from("files")
        .select("id, filename, class_id, status, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!data?.length) return text("No files uploaded yet. Ethan can upload a syllabus on the Classes page.");
      return text(
        data
          .map((f) => `- [id: ${f.id}] ${f.filename} — ${f.class_id ? (ctx.className.get(f.class_id) ?? "?") : "no class"} — ${f.status}`)
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "get_file_text",
    {
      title: "Read an uploaded file",
      description:
        "The text of an uploaded PDF (pulled out on Ethan's device). Use it to find assignments, tests, due dates, grade weights and the late policy, then call import_syllabus. Long files come in parts: pass `part` 2, 3, … if it says there's more.",
      inputSchema: { file_id: z.string().uuid(), part: z.number().int().min(1).max(50).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ file_id, part }) => {
      const { data: f } = await db.from("files").select("filename, extracted_text, status").eq("user_id", userId).eq("id", file_id).maybeSingle();
      if (!f) return text("No file with that id.");
      if (!f.extracted_text) {
        return text(
          f.status === "needs_claude"
            ? `"${f.filename}" is an image or scan with no text layer. Ask Ethan to attach it directly in this chat so you can read it.`
            : `"${f.filename}" has no text yet.`,
        );
      }
      const size = 60_000;
      const n = part ?? 1;
      const chunk = f.extracted_text.slice((n - 1) * size, n * size);
      const more = f.extracted_text.length > n * size;
      return text(`${f.filename} (part ${n}${more ? `; there's more: ask for part ${n + 1}` : ", last part"}):\n\n${chunk}`);
    },
  );

  server.registerTool(
    "import_syllabus",
    {
      title: "Import assignments from a syllabus",
      description:
        "After reading a syllabus, send every assignment, quiz, test and project with its date words. They go to Ethan's Inbox as one batch to review and approve with one tap. Put dates in due_text exactly as written (e.g. 'Sept 14', '10/3', 'Friday of week 5'): the dashboard works out the real date.",
      inputSchema: {
        class_name: z.string().min(1).max(80).describe("Which of Ethan's classes this syllabus is for"),
        file_id: z.string().uuid().optional(),
        items: z
          .array(
            z.object({
              title: z.string().min(1).max(200).describe("e.g. 'Chapter 3 quiz' (no class name)"),
              due_text: z.string().max(100).optional(),
              kind: z.enum(["assignment", "exam", "project"]).optional(),
            }),
          )
          .min(1)
          .max(150),
        notes: z.string().max(4000).optional().describe("Grade weights, late policy, anything worth keeping"),
      },
    },
    async ({ class_name, file_id, items, notes }) => {
      const ctx = await context();
      const batchId = crypto.randomUUID();
      const rows = items.map((item) => {
        const input = captureSchema.parse({
          raw_text: `${class_name} ${item.title}${item.due_text ? ` due ${item.due_text}` : ""}`,
          type: "homework",
          title: item.title,
          class_name,
          due_text: item.due_text,
          confidence: 0.85,
        });
        const d = decide(input, { now: new Date(), timeZone: ctx.timeZone, classes: ctx.classes, autoSaveTypes: [] });
        return {
          user_id: userId,
          raw_text: input.raw_text,
          draft: d.draft,
          type: "homework",
          confidence: d.confidence,
          problems: d.problems,
          source: "syllabus",
          batch_id: batchId,
        };
      });
      const { error } = await db.from("inbox_items").insert(rows);
      if (error) return text(`Couldn't import: ${error.message}`);
      if (file_id) await db.from("files").update({ status: "imported" }).eq("id", file_id).eq("user_id", userId);
      if (notes) {
        await db.from("inbox_items").insert({
          user_id: userId,
          raw_text: `${class_name} syllabus notes: ${notes}`.slice(0, 2000),
          draft: { type: "note", title: `${class_name} syllabus notes`, classId: null, className: class_name, dueDate: null, dueTime: null, amount: null, category: null, notes },
          type: "note",
          confidence: 1,
          problems: ["Syllabus notes to read (dismiss when you're done)"],
          source: "syllabus",
          batch_id: batchId,
        });
      }
      const flagged = rows.filter((r) => r.problems.length).length;
      return text(
        `Sent ${rows.length} item${rows.length === 1 ? "" : "s"} to Ethan's Inbox for review${flagged ? ` (${flagged} need a quick check, e.g. a date I couldn't read)` : ""}. He can approve them all with one tap.`,
      );
    },
  );

  // ── Money ───────────────────────────────────────────────────────────────
  server.registerTool(
    "log_expense",
    {
      title: "Log money spent or received",
      description:
        "Record money Ethan spent (or got paid) in the Money section. Goes to his Inbox for a one-tap check unless he confirmed the exact details in this chat.",
      inputSchema: {
        amount: z.number().positive().describe("Dollars, e.g. 12.5"),
        what: z.string().min(1).max(200).describe("What it was, e.g. 'Gas' or 'Chipotle'"),
        received: z.boolean().optional().describe("true if he got paid (income) instead of spending"),
        when_text: z.string().max(60).optional().describe("Date words as said, e.g. 'yesterday'. Default today."),
        confirmed_by_user: z.boolean().optional(),
      },
    },
    async ({ amount, what, received, when_text, confirmed_by_user }) => {
      const ctx = await context();
      const today = toLocalDate(new Date(), ctx.timeZone);
      if (received) {
        // Income isn't an "expense" draft: save directly when confirmed, else note it in the Inbox.
        if (!confirmed_by_user) {
          await db.from("inbox_items").insert({
            user_id: userId,
            raw_text: `got $${amount} for ${what}`,
            draft: { type: "note", title: `Got $${amount} for ${what}`, classId: null, className: null, dueDate: null, dueTime: null, amount, category: null, notes: "Income: add it on the Money page" },
            type: "note",
            confidence: 0.9,
            problems: ["Income: confirm in the chat or add it on the Money page"],
            source: "mcp",
          });
          return text(`Noted in Ethan's Inbox: got $${amount} for ${what}. Ask him to confirm to save it to Money.`);
        }
        const cents = Math.round(amount * 100);
        await db.from("money_transactions").insert({
          user_id: userId,
          occurred_on: today,
          amount_cents: cents,
          description: what,
          category: categorize(what, cents),
          source: "capture",
        });
        return text(`Saved to Money: +$${amount} for ${what}.`);
      }
      const input = captureSchema.parse({
        raw_text: `spent $${amount} on ${what}${when_text ? ` ${when_text}` : ""}`,
        type: "expense",
        title: what,
        amount,
        due_text: when_text,
        confidence: confirmed_by_user ? 1 : 0.8,
      });
      const decision = decide(input, { now: new Date(), timeZone: ctx.timeZone, classes: [], autoSaveTypes: confirmed_by_user ? ["expense"] : ctx.autoSaveTypes });
      if (decision.autoSave) {
        await db.from("money_transactions").insert({ ...moneyRowFromDraft(decision.draft, today), user_id: userId });
        return text(`Saved to Money: −$${amount} · ${what}.`);
      }
      await db.from("inbox_items").insert({
        user_id: userId,
        raw_text: input.raw_text,
        draft: decision.draft,
        type: "expense",
        confidence: decision.confidence,
        problems: decision.problems,
        source: "mcp",
      });
      return text(`Added to Ethan's Inbox for review: −$${amount} · ${what}. One tap saves it to Money.`);
    },
  );

  // ── Food and workouts: kept in the Inbox, one tap logs them ──
  for (const [name, type, label] of [
    ["log_food", "food", "Log food Ethan ate (include calories and protein if known)"],
    ["log_workout", "workout", "Log a workout, e.g. 'bench 3x10 at 135' or 'ran 2 miles in 18 minutes'"],
  ] as const) {
    server.registerTool(
      name,
      {
        title: label,
        description: `${label}. It waits in Ethan's Inbox, where one tap logs it in the right place.`,
        inputSchema: {
          text: z.string().min(1).max(2000).describe("What to log, in plain words, e.g. '2 eggs and toast, ~350 calories'"),
          amount: z.number().optional().describe("Dollars (expenses) if known"),
        },
      },
      async ({ text: what, amount }) => {
        await db.from("inbox_items").insert({
          user_id: userId,
          raw_text: what,
          draft: { type, title: what, classId: null, className: null, dueDate: null, dueTime: null, amount: amount ?? null, category: null, notes: null },
          type,
          confidence: 0.9,
          problems: [],
          source: "mcp",
        });
        return text(`Added to Ethan's Inbox. One tap logs it: "${what}"`);
      },
    );
  }

  // ── Look things up and fix them ("my last back day was actually 12 reps, not 10") ──
  // Reading is free; every change needs Ethan to have said yes to the exact change
  // in the chat (confirmed_by_user), the same review-before-save rule as the app.
  const needsYes = (what: string) =>
    text(`Not changed yet. Show Ethan exactly this change and ask him to confirm: ${what}. Then call again with confirmed_by_user: true.`);

  server.registerTool(
    "get_gym_history",
    {
      title: "Workout history and coach tips",
      description:
        "Ethan's recent workouts with every set (set ids, weight in lb, reps), plus the dashboard's coach tips. Use it to answer questions about his training, to spot patterns (too many reps → go heavier, stalls, skipped muscles), or to find the set to fix before fix_workout_set. Filter by exercise words or split day (e.g. 'back').",
      inputSchema: {
        exercise: z.string().max(80).optional().describe("Only workouts with an exercise whose name contains these words, e.g. 'dumbbell row'"),
        split_day: z.string().max(40).optional().describe("Only this split day, e.g. 'back' or 'legs'"),
        limit: z.number().int().min(1).max(60).optional().describe("How many workouts (default 10)"),
      },
    },
    async ({ exercise, split_day, limit }) => {
      const ctx = await context();
      const [{ data: rows }, { data: exercises }] = await Promise.all([
        db
          .from("workouts")
          .select("id, started_at, split_day, skipped, workout_sets(id, exercise_id, position, weight_lb, reps, done)")
          .eq("user_id", userId)
          .not("ended_at", "is", null)
          .is("deleted_at", null)
          .order("started_at", { ascending: false })
          .limit(150),
        db.from("exercises").select("id, name, muscle, bodyweight").or(`user_id.is.null,user_id.eq.${userId}`),
      ]);
      const name = new Map((exercises ?? []).map((e) => [e.id, e.name]));
      const all = (rows ?? []).map((w) => ({
        id: w.id,
        date: toLocalDate(new Date(w.started_at), ctx.timeZone),
        day: w.split_day,
        skipped: w.skipped,
        sets: [...(w.workout_sets ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((x) => ({ id: x.id, exerciseId: x.exercise_id, weightLb: x.weight_lb === null ? null : Number(x.weight_lb), reps: x.reps, done: x.done })),
      }));
      const words = exercise?.toLowerCase().trim();
      const picked = all
        .filter((w) => !split_day || (w.day ?? "").toLowerCase().includes(split_day.toLowerCase().replace(/s$/, "")))
        .filter((w) => !words || w.sets.some((x) => (name.get(x.exerciseId) ?? "").toLowerCase().includes(words)))
        .slice(0, limit ?? 10);
      if (!picked.length) return text("No workouts match.");
      const lines = picked.map((w) => {
        if (w.skipped) return `${w.date} · skipped ${w.day ?? "day"}`;
        const byEx = new Map<string, string[]>();
        for (const x of w.sets) {
          const n = name.get(x.exerciseId) ?? "Exercise";
          if (words && !n.toLowerCase().includes(words)) continue;
          byEx.set(n, [...(byEx.get(n) ?? []), `${x.weightLb ?? "BW"}×${x.reps ?? "?"}${x.done ? "" : " (not done)"} [set ${x.id}]`]);
        }
        return `${w.date}${w.day ? ` · ${w.day} day` : ""} [workout ${w.id}]\n${[...byEx].map(([n, v]) => `  ${n}: ${v.join(", ")}`).join("\n")}`;
      });
      const tips = coachTips(
        all,
        (exercises ?? []).map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, bodyweight: e.bodyweight })),
        toLocalDate(new Date(), ctx.timeZone),
      ).slice(0, 6);
      return text(
        `${lines.join("\n")}${tips.length ? `\n\nCoach tips from all his history:\n${tips.map((t) => `- ${t.title}: ${t.why}`).join("\n")}` : ""}`,
      );
    },
  );

  server.registerTool(
    "fix_workout_set",
    {
      title: "Fix a logged set",
      description:
        "Change the weight or reps of sets Ethan already logged (find the set ids with get_gym_history). Only when Ethan said the numbers were wrong, e.g. 'on my last back day I actually did 12 reps on dumbbell row, not 10'. First call WITHOUT confirmed_by_user to get the exact change to show him; after he says yes, call again with confirmed_by_user: true.",
      inputSchema: {
        changes: z
          .array(
            z.object({
              set_id: z.string().uuid(),
              weight_lb: z.number().min(0).max(2000).nullable().optional().describe("New weight in lb (null = bodyweight)"),
              reps: z.number().int().min(0).max(1000).optional(),
            }),
          )
          .min(1)
          .max(20),
        confirmed_by_user: z.boolean().optional().describe("true ONLY after Ethan said yes to this exact change in the chat"),
      },
    },
    async ({ changes, confirmed_by_user }) => {
      const ids = changes.map((c) => c.set_id);
      const [{ data: sets }, { data: exercises }] = await Promise.all([
        db.from("workout_sets").select("id, exercise_id, weight_lb, reps, workout_id").eq("user_id", userId).in("id", ids),
        db.from("exercises").select("id, name").or(`user_id.is.null,user_id.eq.${userId}`),
      ]);
      if (!sets || sets.length !== ids.length) return text("Some of those set ids aren't Ethan's sets. Look them up again with get_gym_history.");
      const name = new Map((exercises ?? []).map((e) => [e.id, e.name]));
      const plan = changes.map((c) => {
        const s = sets.find((x) => x.id === c.set_id)!;
        const before = `${s.weight_lb ?? "BW"}×${s.reps ?? "?"}`;
        const after = `${c.weight_lb !== undefined ? (c.weight_lb ?? "BW") : (s.weight_lb ?? "BW")}×${c.reps ?? s.reps ?? "?"}`;
        return { c, line: `${name.get(s.exercise_id) ?? "Exercise"}: ${before} → ${after}` };
      });
      const summary = plan.map((p) => p.line).join("; ");
      if (!confirmed_by_user) return needsYes(summary);
      for (const { c } of plan) {
        const row: { weight_lb?: number | null; reps?: number } = {};
        if (c.weight_lb !== undefined) row.weight_lb = c.weight_lb;
        if (c.reps !== undefined) row.reps = c.reps;
        const { error } = await db.from("workout_sets").update(row).eq("id", c.set_id).eq("user_id", userId);
        if (error) return text(`Couldn't save: ${error.message}`);
      }
      return text(`Fixed: ${summary}.`);
    },
  );

  server.registerTool(
    "find_tasks",
    {
      title: "Find tasks",
      description: "Search Ethan's tasks (open, and done in the last 30 days) by words in the title or notes. Returns ids for update_task or complete_task.",
      inputSchema: { words: z.string().min(1).max(100), include_done: z.boolean().optional() },
    },
    async ({ words, include_done }) => {
      const ctx = await context();
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      let q = db
        .from("tasks")
        .select("id, title, notes, status, class_id, due_at, due_has_time, area, completed_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(200);
      q = include_done ? q.or(`status.eq.open,completed_at.gte.${since}`) : q.eq("status", "open");
      const { data } = await q;
      const want = words.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = (data ?? []).filter((t) => want.every((w) => `${t.title} ${t.notes ?? ""} ${ctx.className.get(t.class_id ?? "") ?? ""}`.toLowerCase().includes(w))).slice(0, 15);
      if (!hits.length) return text("No tasks match.");
      return text(
        hits
          .map(
            (t) =>
              `${t.status === "done" ? "✓ " : ""}${taskDisplayTitle(t.title, ctx.className.get(t.class_id ?? "") ?? null)} · ${t.area}${t.due_at ? ` · due ${formatDue(new Date(t.due_at), t.due_has_time, new Date(), ctx.timeZone)}` : ""}${t.notes ? ` · notes: ${t.notes.slice(0, 120)}` : ""} [id: ${t.id}]`,
          )
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Change a task",
      description:
        "Fix a task's title, notes, due date or area (find it with find_tasks). First call WITHOUT confirmed_by_user to get the change to show Ethan; after he says yes, call again with confirmed_by_user: true. Pass due words as said ('friday 3pm'), not a converted date.",
      inputSchema: {
        task_id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        notes: z.string().max(2000).nullable().optional().describe("Replaces the notes (null clears them)"),
        add_to_notes: z.string().max(1000).optional().describe("Adds a line to the notes instead of replacing them"),
        due_text: z.string().max(100).nullable().optional().describe("New due date/time words, or null to remove the date"),
        area: z.enum(["school", "work", "personal"]).optional(),
        confirmed_by_user: z.boolean().optional(),
      },
    },
    async ({ task_id, title, notes, add_to_notes, due_text, area, confirmed_by_user }) => {
      const ctx = await context();
      const { data: task } = await db.from("tasks").select("id, title, notes, due_at, due_has_time, area, class_id").eq("user_id", userId).eq("id", task_id).maybeSingle();
      if (!task) return text("No task with that id.");
      const row: { title?: string; notes?: string | null; due_at?: string | null; due_has_time?: boolean; area?: string } = {};
      const said: string[] = [];
      if (title !== undefined && title !== task.title) {
        row.title = title;
        said.push(`title "${task.title}" → "${title}"`);
      }
      if (notes !== undefined) {
        row.notes = notes;
        said.push(notes ? `notes → "${notes.slice(0, 200)}"` : "clear the notes");
      } else if (add_to_notes) {
        row.notes = [task.notes, add_to_notes].filter(Boolean).join("\n");
        said.push(`add to notes: "${add_to_notes}"`);
      }
      if (due_text === null) {
        row.due_at = null;
        row.due_has_time = false;
        said.push("remove the due date");
      } else if (due_text) {
        const d = decide(captureSchema.parse({ raw_text: `${task.title} due ${due_text}`, type: "task", title: task.title, due_text, confidence: 1 }), {
          now: new Date(),
          timeZone: ctx.timeZone,
          classes: ctx.classes,
          autoSaveTypes: ["task"],
        });
        const r2 = taskRowFromDraft(d.draft, ctx.timeZone, "mcp");
        if (!r2.due_at) return text(`I couldn't read "${due_text}" as a date. Ask Ethan for the day.`);
        row.due_at = r2.due_at;
        row.due_has_time = r2.due_has_time;
        said.push(`due ${task.due_at ? formatDue(new Date(task.due_at), task.due_has_time, new Date(), ctx.timeZone) : "(none)"} → ${formatDue(new Date(r2.due_at), r2.due_has_time, new Date(), ctx.timeZone)}`);
      }
      if (area && area !== task.area) {
        row.area = area;
        said.push(`area ${task.area} → ${area}`);
      }
      if (!said.length) return text("Nothing would change.");
      const summary = `${task.title}: ${said.join("; ")}`;
      if (!confirmed_by_user) return needsYes(summary);
      const { error } = await db.from("tasks").update(row).eq("id", task_id).eq("user_id", userId);
      if (error) return text(`Couldn't save: ${error.message}`);
      return text(`Updated ${summary}.`);
    },
  );

  return server;
}
