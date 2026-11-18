import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TIME_ZONE, addDays, fromLocal, toLocalDate } from "@/lib/time";
import { formatDue, formatTimeOfDay, taskDisplayTitle } from "@/lib/format";
import { captureSchema, decide, readDraft, SAVEABLE_TYPES, taskRowFromDraft } from "@/lib/capture";
import { nextOccurrence, repeatFromForm } from "@/lib/tasks";
import { describeDraft } from "@/lib/capture/handle";
import { classesOn, type ScheduleContext } from "@/lib/schedule";

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
        const { data: task } = await db.from("tasks").insert({ ...taskRowFromDraft(d, ctx.timeZone, item.source), user_id: userId }).select("id").single();
        await db.from("inbox_items").update({ status: "approved", result_table: "tasks", result_id: task?.id ?? null }).eq("id", id).eq("user_id", userId);
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
          problems: ["Notes aren't built yet, so this waits here"],
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

  // ── Not built yet: these wait in the Inbox ──────────────────────────────
  for (const [name, type, label] of [
    ["log_food", "food", "Log food (calories tracking comes in Phase 3)"],
    ["log_workout", "workout", "Log a workout (gym tracking comes in Phase 3)"],
    ["log_expense", "expense", "Log an expense (budget comes in Phase 4)"],
    ["add_note", "note", "Save a note or journal entry (notes come in Phase 4)"],
  ] as const) {
    server.registerTool(
      name,
      {
        title: label,
        description: `${label}. That part of the dashboard isn't built yet, so this is kept safely in the Inbox until it is.`,
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
          problems: [`${type} tracking isn't built yet, so this waits here`],
          source: "mcp",
        });
        return text(`Kept in Ethan's Inbox (the ${type} section isn't built yet): "${what}"`);
      },
    );
  }

  return server;
}
