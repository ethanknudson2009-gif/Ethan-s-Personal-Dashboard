/**
 * Captures: anything that arrives from outside the quick-add box (the iPhone
 * "Log It" Shortcut, Claude through the connector, a syllabus). Each one
 * becomes a *draft* that either saves directly or waits in the Inbox for a
 * one-tap review. See docs/07-architecture.md §6 and §8.
 */
import { z } from "zod";
import { parse, type CaptureDraft, type ClassRef } from "@/lib/parser";
import { fromLocal } from "@/lib/time";
import { categorize } from "@/lib/money/categories";

export const CAPTURE_TYPES = ["homework", "task", "food", "workout", "expense", "note", "habit"] as const;
export type CaptureType = (typeof CAPTURE_TYPES)[number];

/** Types the dashboard can save today. Others wait in the Inbox until their module exists. */
export const SAVEABLE_TYPES: CaptureType[] = ["homework", "task", "expense"];

/**
 * The JSON the iPhone Shortcut sends (version 1). Only raw_text is required.
 * Claude fills the rest when it can; our own parser fills or checks it.
 */
export const captureSchema = z.object({
  v: z.literal(1).optional(),
  // Long enough for a minute of talking (a whole list).
  raw_text: z.string().trim().min(1, "raw_text is required").max(6000),
  type: z.enum(CAPTURE_TYPES).nullish(),
  title: z.string().trim().max(200).nullish(),
  due_text: z.string().trim().max(100).nullish(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).nullish(),
  class_name: z.string().trim().max(80).nullish(),
  estimate_minutes: z.number().int().min(0).max(6000).nullish(),
  amount: z.number().min(0).max(1_000_000).nullish(),
  category: z.string().trim().max(80).nullish(),
  notes: z.string().max(2000).nullish(),
  confidence: z.number().min(0).max(1).nullish(),
  client_id: z.string().trim().max(100).nullish(),
});

export type CaptureInput = z.infer<typeof captureSchema>;

/** What gets stored in inbox_items.draft and turned into a real record on approval. */
export type InboxDraft = {
  type: CaptureType;
  title: string;
  classId: string | null;
  className: string | null;
  dueDate: string | null; // YYYY-MM-DD, local
  dueTime: string | null; // HH:MM, local
  amount: number | null;
  category: string | null;
  notes: string | null;
  area?: "school" | "work" | "personal";
  /** Money coming in (paycheck) instead of spent. */
  incoming?: boolean;
};

export type Decision = {
  draft: InboxDraft;
  confidence: number;
  problems: string[];
  /** true = save straight away; false = put in the Inbox. */
  autoSave: boolean;
};

const AUTO_SAVE_MIN_CONFIDENCE = 0.85;

function timeOf(d: CaptureDraft): string | null {
  const t = d.when?.time;
  return d.when?.hasTime && t ? `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}` : null;
}

/**
 * Combines what Claude sent (if anything) with our own parser, decides the
 * draft, and whether it may skip the Inbox.
 *
 * Rules (docs/07 §8, decision D8):
 *  - Dates always come from OUR parser (Claude's `due` is only a cross-check).
 *  - Raw text only (no Claude) → always the Inbox.
 *  - Claude JSON → auto-save only if the type is in `autoSaveTypes`, it can
 *    be saved today, confidence ≥ 0.85 and there are no problems.
 */
export function decide(
  input: CaptureInput,
  ctx: { now: Date; timeZone: string; classes: ClassRef[]; autoSaveTypes: string[] },
): Decision {
  const fromClaude = Boolean(input.type || input.title || input.due_text || input.class_name);

  // Our parser reads the most specific text we have for each part.
  // Raw text from the Shortcut is dictated speech: clean it up like the in-app mic does.
  const parsedRaw = parse(input.raw_text, { ...ctx, spoken: true });
  const parsedDue = input.due_text ? parse(`due ${input.due_text}`, ctx) : null;
  const parsedClass = input.class_name ? parse(input.class_name, { ...ctx, classes: ctx.classes }) : null;

  const problems = [...parsedRaw.problems.filter((p) => !/^(No due date found|No class matched)$/.test(p))];
  let confidence = fromClaude ? Math.min(input.confidence ?? 0.8, 1) : parsedRaw.confidence;

  const type: CaptureType = input.type ?? (parsedRaw.type as CaptureType);
  const when = parsedDue?.when ?? parsedRaw.when;
  const classId = parsedClass?.classId ?? parsedRaw.classId;
  const className = parsedClass?.className ?? parsedRaw.className;

  if (input.class_name && !parsedClass?.classId) {
    problems.push(`Class "${input.class_name}" isn't one of your classes`);
    confidence -= 0.2;
  }
  if (input.due_text && !parsedDue?.when) {
    problems.push(`Couldn't understand the date "${input.due_text}"`);
    confidence -= 0.3;
  }
  // Cross-check Claude's own date against ours.
  if (input.due && when && input.due.slice(0, 10) !== when.date) {
    problems.push(`Claude said ${input.due.slice(0, 10)} but "${input.due_text ?? input.raw_text}" reads as ${when.date}`);
    confidence -= 0.3;
  }
  if (type === "homework" && !classId) {
    problems.push("Which class is this for?");
    confidence -= 0.2;
  }
  if (type === "homework" && !when) {
    problems.push("No due date found");
    confidence -= 0.2;
  }
  // Food, workouts, habits and journal lines always wait in the Inbox for one tap (never auto-saved).

  const draft: InboxDraft = {
    type,
    title: (input.title || (type === "homework" || type === "task" ? parsedRaw.title : input.raw_text)).trim(),
    classId,
    className,
    dueDate: when?.date ?? null,
    dueTime: parsedDue ? timeOf(parsedDue) : timeOf(parsedRaw),
    amount: input.amount ?? parsedRaw.amount,
    category: input.category ?? parsedRaw.category,
    notes: input.notes ?? parsedRaw.notes ?? null,
    area: classId ? "school" : parsedRaw.area,
    incoming: parsedRaw.incoming,
  };

  confidence = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;
  const autoSave =
    fromClaude &&
    ctx.autoSaveTypes.includes(type) &&
    SAVEABLE_TYPES.includes(type) &&
    confidence >= AUTO_SAVE_MIN_CONFIDENCE &&
    problems.length === 0;

  return { draft, confidence, problems, autoSave };
}

/** The tasks-table row for a homework/task draft. */
export function taskRowFromDraft(draft: InboxDraft, timeZone: string, source: string) {
  const dueAt = draft.dueDate
    ? fromLocal(
        draft.dueDate,
        draft.dueTime
          ? { hour: Number(draft.dueTime.slice(0, 2)), minute: Number(draft.dueTime.slice(3, 5)) }
          : { hour: 23, minute: 59 },
        timeZone,
      ).toISOString()
    : null;
  return {
    title: draft.title || "Untitled",
    class_id: draft.classId,
    kind: draft.classId || draft.type === "homework" ? ("assignment" as const) : ("task" as const),
    due_at: dueAt,
    due_has_time: Boolean(draft.dueDate && draft.dueTime),
    notes: draft.notes,
    area: draft.classId ? ("school" as const) : (draft.area ?? (draft.type === "homework" ? "school" : "personal")),
    source,
  };
}

/**
 * The money_transactions row for an expense draft ("spent $12 gas").
 * The "due" date words mean when it was spent ("yesterday"); default today.
 */
export function moneyRowFromDraft(draft: InboxDraft, today: string) {
  const cents = Math.round(Math.abs(draft.amount ?? 0) * 100);
  const description = draft.title || draft.category || "Expense";
  return {
    occurred_on: draft.dueDate ?? today,
    amount_cents: draft.incoming ? cents : -cents,
    description,
    category: categorize(`${description} ${draft.category ?? ""}`, draft.incoming ? cents : -cents),
    source: "capture" as const,
    notes: draft.notes,
  };
}

/** Which table a saveable draft goes to. */
export function targetTable(draft: InboxDraft): "tasks" | "money_transactions" {
  return draft.type === "expense" ? "money_transactions" : "tasks";
}

/** Parses a stored draft back out of the database's JSON column. */
export function readDraft(value: unknown): InboxDraft | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Partial<InboxDraft>;
  if (!d.type || !CAPTURE_TYPES.includes(d.type)) return null;
  return {
    type: d.type,
    title: typeof d.title === "string" ? d.title : "",
    classId: d.classId ?? null,
    className: d.className ?? null,
    dueDate: d.dueDate ?? null,
    dueTime: d.dueTime ?? null,
    amount: d.amount ?? null,
    category: d.category ?? null,
    notes: d.notes ?? null,
    area: d.area === "work" || d.area === "school" || d.area === "personal" ? d.area : undefined,
    incoming: d.incoming === true,
  };
}
