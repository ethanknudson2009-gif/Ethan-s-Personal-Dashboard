"use client";

/**
 * Quick add / edit sheet.
 *
 * New: one text box. As you type, our own parser (src/lib/parser) picks out
 * the class and the day, shown as chips you can tap to change. "Add" saves
 * and closes, with a small "Added ✓" toast.
 * Say (or type) a whole list and it becomes many items at once: each one is
 * shown with its title, day and notes so you can check it, then "Save all".
 * Edit: title, class, day, repeat, reminders (off / gentle / persistent)
 * and snooze, plus Delete.
 *
 * Kept deliberately simple (Ethan: "I don't want to be scared of my
 * dashboard"): no due time, estimate or priority fields.
 */
import { playToastSound } from "@/lib/sound";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { deleteTaskAction, saveTaskAction, saveTasksAction, snoozeTaskAction, type SaveTaskInput } from "@/app/(app)/tasks/actions";
import { snoozedText, type NagLevel } from "@/lib/tasks/view";
import { addMoneyAction } from "@/app/(app)/money/actions";
import { applyFixAction, logCardioAction, logSpokenWorkoutAction, previewFixAction, type FixPreview } from "@/app/(app)/gym/actions";
import { changeLabel, readFix } from "@/lib/gym-fix";
import { DEFAULT_SPLIT, readWorkout, setsSummary, type GymExercise } from "@/lib/gym-speech";
import { checkInHabitByNameAction, logFoodAction } from "@/app/(app)/life/actions";
import { dollars } from "@/lib/money/summary";
import { parse, type CaptureDraft } from "@/lib/parser";
import { parseMany, type ManyItem } from "@/lib/parser/multi";
import { addDays, toLocalDate, weekdayOf } from "@/lib/time";
import { formatLocalDate, taskDisplayTitle, WEEKDAY_SHORT } from "@/lib/format";
import { Button, Chip, ColorDot, cx, inputClass } from "@/components/ui";
import { IconCalendar, IconClose, IconMic, IconRepeat } from "@/components/icons";
import { useSpeech } from "@/lib/use-speech";
import { normalizeSpoken } from "@/lib/parser/spoken";
import { pickBestHearing } from "@/lib/parser/best";
import { focusStore } from "@/lib/focus-store";

export type SheetClass = { id: string; name: string; color: string; shortNames: string[] };

export type EditableTask = {
  id: string;
  title: string;
  classId: string | null;
  dueDate: string | null;
  dueTime: string | null;
  repeat: RepeatChoice;
  notes?: string | null;
  area?: Area;
  nagLevel?: NagLevel;
  snoozedUntil?: string | null;
};

const NAG_CHOICES: { value: NagLevel; label: string; hint: string }[] = [
  { value: "off", label: "🔕 Off", hint: "Only in the morning and evening summaries." },
  { value: "gentle", label: "🔔 Gentle", hint: "One reminder an hour before (if it has a time)." },
  { value: "persistent", label: "📣 Persistent", hint: "An hour before, at the time, then every 3 hours (9 AM–9 PM) until it's done." },
];

const SNOOZE_CHOICES = [
  { value: "1h", label: "1 hr" },
  { value: "3h", label: "3 hr" },
  { value: "tonight", label: "Tonight" },
  { value: "tomorrow", label: "Tomorrow" },
] as const;

export type Area = "school" | "work" | "personal";
const AREAS: { value: Area; label: string }[] = [
  { value: "school", label: "🎓 School" },
  { value: "work", label: "💼 PRMI Work" },
  { value: "personal", label: "🏠 Personal" },
];

type RepeatChoice = "none" | "daily" | "weekly" | "biweekly" | "monthly";

/** One of these shows while the mic listens: every kind of thing you can say. */
const VOICE_EXAMPLES = [
  "speech outline due thursday",
  "math homework due tomorrow",
  "call Mike about the Smith file by end of day",
  "spent 12 dollars on gas",
  "got paid 450",
  "bench 3x10 at 135",
  "ran 2 miles in 18 minutes",
  "ate a chicken burrito 700 calories",
  "did my reading",
  "today was great, I felt productive",
  "every monday take out the trash",
  "call Mike tomorrow, then buy milk, also english essay due friday",
  "for work: order the appraisal, send the disclosures, follow up with title",
];

const REPEAT_CHOICES: { value: RepeatChoice; label: string }[] = [
  { value: "none", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/** Pre-filled values, e.g. when reviewing an Inbox item. */
export type SheetPrefill = {
  title?: string;
  classId?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  inboxId?: string;
  notes?: string | null;
  area?: Area;
};

type SheetState = { mode: "closed" } | { mode: "new"; prefill?: SheetPrefill; voice?: boolean } | { mode: "edit"; task: EditableTask };

type SheetApi = {
  openNew: (prefill?: SheetPrefill) => void;
  /** Open quick add and start listening right away (hold the + button). */
  openVoice: (prefill?: SheetPrefill) => void;
  openEdit: (task: EditableTask) => void;
  /** A short message at the bottom. With an action, it shows a button (e.g. Undo) and stays a bit longer. */
  toast: (message: string, action?: { label: string; run: () => void }) => void;
  /** Your time zone, for "today"/"tomorrow" in client-side code. */
  timeZone: string;
};

const SheetContext = createContext<SheetApi | null>(null);

/** "Tap + = start talking" setting, remembered on this device (on unless turned off). */
const AUTO_MIC_KEY = "dashboard.autoMic";
function autoMicOn(): boolean {
  try {
    return window.localStorage.getItem(AUTO_MIC_KEY) !== "off";
  } catch {
    return true;
  }
}
function setAutoMic(on: boolean) {
  try {
    window.localStorage.setItem(AUTO_MIC_KEY, on ? "on" : "off");
  } catch {
    // Private mode: the switch just won't be remembered.
  }
}

export function useTaskSheet(): SheetApi {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error("useTaskSheet must be used inside TaskSheetProvider");
  return ctx;
}

export function TaskSheetProvider({
  classes,
  habits = [],
  exercises = [],
  split = DEFAULT_SPLIT,
  timeZone,
  children,
}: {
  classes: SheetClass[];
  /** Your habit names, so "did my reading" checks in "Reading". */
  habits?: string[];
  /** Your exercise list and gym split, so a spoken workout previews exactly as it will save. */
  exercises?: GymExercise[];
  split?: string[];
  timeZone: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<SheetState>({ mode: "closed" });
  const [toastMsg, setToastMsg] = useState<{ text: string; key: number; action?: { label: string; run: () => void } } | null>(null);

  const api = useMemo<SheetApi>(
    () => ({
      // Plain "+" starts listening right away unless you turned auto-mic off.
      openNew: (prefill) => setState({ mode: "new", prefill, voice: (!prefill || !prefill.title) && autoMicOn() }),
      openVoice: (prefill) => setState({ mode: "new", prefill, voice: true }),
      openEdit: (task) => setState({ mode: "edit", task }),
      toast: (text, action) => {
        playToastSound(text);
        setToastMsg({ text, key: Date.now(), action });
      },
      timeZone,
    }),
    [timeZone],
  );

  return (
    <SheetContext.Provider value={api}>
      {children}
      {state.mode !== "closed" && (
        <Sheet
          key={state.mode === "edit" ? state.task.id : "new"}
          state={state}
          classes={classes}
          habits={habits}
          exercises={exercises}
          split={split}
          timeZone={timeZone}
          onClose={() => setState({ mode: "closed" })}
          onDone={(msg) => {
            setState({ mode: "closed" });
            api.toast(msg);
          }}
        />
      )}
      {toastMsg && (
        <div
          key={toastMsg.key}
          role="status"
          onAnimationEnd={(e) => e.target === e.currentTarget && setToastMsg(null)}
          className={cx(
            "fixed bottom-28 left-1/2 z-50 flex max-w-[92vw] items-center gap-3 rounded-full border border-accent/50 bg-surface/95 py-2 pr-2 pl-4 text-sm font-medium text-ink shadow-glow backdrop-blur md:bottom-8",
            toastMsg.action ? "toast-long" : "toast pr-4",
          )}
        >
          <span className="truncate">{toastMsg.text}</span>
          {toastMsg.action && (
            <button
              type="button"
              onClick={() => {
                toastMsg.action?.run();
                setToastMsg(null);
              }}
              className="shrink-0 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent hover:bg-accent/25"
            >
              {toastMsg.action.label}
            </button>
          )}
        </div>
      )}
    </SheetContext.Provider>
  );
}

function Sheet({
  state,
  classes,
  habits,
  exercises,
  split,
  timeZone,
  onClose,
  onDone,
}: {
  state: Exclude<SheetState, { mode: "closed" }>;
  classes: SheetClass[];
  habits: string[];
  exercises: GymExercise[];
  split: string[];
  timeZone: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const editing = state.mode === "edit" ? state.task : null;
  const prefill = state.mode === "new" ? state.prefill : undefined;
  const [text, setText] = useState(editing?.title ?? prefill?.title ?? "");
  // `undefined` = follow what the parser found; anything else = you picked it.
  const [classPick, setClassPick] = useState<string | null | undefined>(editing ? editing.classId : prefill?.classId);
  const [datePick, setDatePick] = useState<string | null | undefined>(editing ? editing.dueDate : prefill?.dueDate);
  const [repeatPick, setRepeat] = useState<RepeatChoice | undefined>(editing?.repeat);
  // A different example each time the sheet opens, so you learn everything it understands.
  const [example] = useState(() => VOICE_EXAMPLES[Math.floor(Math.random() * VOICE_EXAMPLES.length)]);
  // "Save as a task instead", for when the words were read as something else.
  const [asTask, setAsTask] = useState(false);
  // `undefined` = follow what the parser found in your words; a string = you edited it.
  const [notesEdit, setNotesEdit] = useState<string | undefined>(editing ? (editing.notes ?? "") : prefill?.notes != null ? prefill.notes : undefined);
  const [areaPick, setAreaPick] = useState<Area | undefined>(editing?.area ?? prefill?.area);
  const [nagLevel, setNagLevel] = useState<NagLevel>(editing?.nagLevel ?? "gentle");
  const [snoozed, setSnoozed] = useState<string | null>(editing?.snoozedUntil ?? null);
  // A spoken list: items you removed from it, and "keep it as one item".
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [asOne, setAsOne] = useState(false);
  // The words exactly as the recognizer wrote them (it capitalizes names like "Johnson").
  const [heardRaw, setHeardRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Text that came from the mic gets the "spoken" cleanup (fillers, number
  // words, misheard class names). Of the recognizer's guesses, keep the one
  // that best matches your classes and dates.
  const [spokenInput, setSpokenInput] = useState(false);
  const parseCtx = useMemo(
    () => ({ now: new Date(), timeZone, habits, classes: classes.map((c) => ({ id: c.id, name: c.name, shortNames: c.shortNames })) }),
    [timeZone, classes, habits],
  );
  const speech = useSpeech((heard) => {
    setSpokenInput(true);
    const best = pickBestHearing(heard, parseCtx);
    setHeardRaw(best);
    setText(normalizeSpoken(best));
  });
  const startVoice = speech.start;
  // Opened with "hold +": listen right away (or point to keyboard dictation).
  const wantsVoice = state.mode === "new" && Boolean(state.voice);
  const [voiceTip, setVoiceTip] = useState(wantsVoice && !speech.supported);

  function micPressed() {
    if (speech.listening) return speech.stop();
    // Tapping the mic again keeps going: new words are added after what's there.
    const started = text.trim() && !editing ? speech.resume(text) : startVoice();
    if (!started) {
      // No built-in recognizer here (common in iPhone home-screen apps):
      // focus the box so the keyboard's own 🎤 dictation button is one tap away.
      setVoiceTip(true);
      inputRef.current?.focus();
    }
  }

  useEffect(() => {
    if (!wantsVoice) return;
    if (speech.supported) startVoice();
    else inputRef.current?.focus();
    // Run once when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const today = toLocalDate(new Date(), timeZone);

  // Parse what was typed (new items only).
  const parsed = useMemo(() => {
    if (editing || !text.trim()) return null;
    return parse(text, { ...parseCtx, spoken: spokenInput, caseSource: heardRaw || undefined });
  }, [editing, text, parseCtx, spokenInput, heardRaw]);

  // A whole list said at once → one draft per item.
  const many = useMemo<ManyItem[]>(() => {
    if (editing || asOne || !text.trim() || readFix(text, exercises)) return [];
    const items = parseMany(text, { ...parseCtx, spoken: spokenInput, caseSource: heardRaw || undefined });
    return items.length >= 2 ? items : [];
  }, [editing, asOne, text, parseCtx, spokenInput, heardRaw, exercises]);
  const multi = many.length >= 2;
  const keptItems = many.filter((it) => !removed.has(it.text));

  const usesParsedTitle = parsed && (parsed.type === "homework" || parsed.type === "task");
  const title = editing ? text.trim() : usesParsedTitle ? parsed.title : text.trim();
  const classId = classPick !== undefined ? classPick : (parsed?.classId ?? null);
  const dueDate = datePick !== undefined ? datePick : (parsed?.when?.date ?? null);
  const parsedTime =
    datePick === undefined && parsed?.when?.hasTime && parsed.when.time
      ? `${String(parsed.when.time.hour).padStart(2, "0")}:${String(parsed.when.time.minute).padStart(2, "0")}`
      : null;
  const dueTime =
    editing && datePick === editing.dueDate
      ? editing.dueTime
      : prefill && datePick === prefill.dueDate
        ? prefill.dueTime
        : parsedTime;
  const repeat: RepeatChoice = repeatPick ?? parsed?.repeat ?? "none";
  const cls = classes.find((c) => c.id === classId) ?? null;
  const notes = notesEdit !== undefined ? notesEdit : (parsed?.notes ?? "");
  // Money said out loud: "spent $12 on gas" (out) or "got paid $400" / "paycheck $600" (in).
  const routed = !editing && !asTask && !multi ? parsed : null;
  const money =
    routed && routed.amount && routed.type === "expense"
      ? {
          cents: Math.round(routed.amount * 100) * (routed.incoming ? 1 : -1),
          label: routed.title || (routed.incoming ? "Paycheck" : "Expense"),
        }
      : null;
  // A whole workout said out loud ("chest day, bench 3x10 at 135, incline 3x8 at 50"),
  // the muscles you hit ("hit legs today"), or "skip chest day" → Gym, not a task.
  const gymTalk =
    /\b(chest|back|legs?|shoulders?|biceps|triceps|arms?|push|pull)\s+day\b|\bhit\s+(chest|back|legs|shoulders|arms|biceps|triceps)\b|\b(skip|skipping|skipped)\b.*\b(gym|day|lift|workout|chest|back|legs|shoulders)\b|\b(rest|off)\s+day\b/.test(
      text.toLowerCase(),
    );
  // "On my last back day I actually hit dumbbell row for 12 reps, not 10": fix a past workout.
  const gymFix = useMemo(() => (editing || asTask || !text.trim() ? null : readFix(text, exercises)), [editing, asTask, text, exercises]);
  const fixKey = gymFix ? JSON.stringify(gymFix) : null;
  const [fixFound, setFixFound] = useState<{ key: string; preview?: FixPreview; error?: string } | null>(null);
  useEffect(() => {
    if (!gymFix || !fixKey) return;
    let live = true;
    const t = window.setTimeout(() => {
      previewFixAction(gymFix).then((r) => {
        if (live) setFixFound(r.ok ? { key: fixKey, preview: r.preview } : { key: fixKey, error: r.error });
      });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [fixKey, gymFix]);
  const fix = gymFix && fixFound?.key === fixKey ? fixFound : null;
  const cardioOnly = routed?.type === "workout" && !routed.sets && (routed.distanceMiles !== null || routed.minutes !== null);
  const spokenWorkout = routed && !gymFix && !money && !cardioOnly && (routed.type === "workout" || gymTalk) ? readWorkout(text, exercises, split) : null;
  const lift = spokenWorkout && (spokenWorkout.entries.length > 0 || spokenWorkout.day || spokenWorkout.skip) ? spokenWorkout : null;
  // Anything else heard, and where it goes instead of becoming a task.
  const other: { emoji: string; label: string; detail: string; to: string; color: string; save: () => Promise<{ ok: boolean; error?: string; msg: string }> } | null =
    !routed || gymFix || money || lift
      ? null
      : routed.type === "workout"
        ? {
            emoji: "🏃",
            label: routed.title || "Workout",
            detail: [routed.distanceMiles !== null ? `${routed.distanceMiles} mi` : "", routed.minutes !== null ? `${routed.minutes} min` : ""].filter(Boolean).join(" · "),
            to: "Gym",
            color: "#ff6b4a",
            save: async () => {
              const r = await logCardioAction({ name: routed.title || "Workout", miles: routed.distanceMiles, minutes: routed.minutes });
              return r.ok ? { ok: true, msg: `🏃 ${r.label} → Gym ✓` } : { ok: false, error: r.error, msg: "" };
            },
          }
        : routed.type === "habit" && routed.habitName
          ? {
              emoji: "✅",
              label: routed.habitName,
              detail: "check in today",
              to: "Habits",
              color: "#2ee6c9",
              save: async () => {
                const r = await checkInHabitByNameAction(routed.habitName!);
                return r.ok ? { ok: true, msg: `${r.habit} ${r.already ? "already done today" : "checked in"} ✓` } : { ok: false, error: r.error, msg: "" };
              },
            }
          : routed.type === "food"
              ? {
                  emoji: "🍽️",
                  label: routed.title,
                  detail: [routed.calories !== null ? `${routed.calories} cal` : "", routed.proteinG !== null ? `${routed.proteinG}g protein` : ""].filter(Boolean).join(" · "),
                  to: "Food",
                  color: "#ffb547",
                  save: async () => {
                    const r = await logFoodAction({ name: routed.title, calories: routed.calories, proteinG: routed.proteinG });
                    return r.ok
                      ? { ok: true, msg: `🍽️ ${routed.title}${routed.calories !== null ? ` · ${routed.calories} cal` : ""} → Food ✓` }
                      : { ok: false, error: r.error, msg: "" };
                  },
                }
              : null;
  // A class always means school; otherwise what you picked, or what the parser heard ("at work", "PRMI").
  const area: Area = cls ? "school" : (areaPick ?? parsed?.area ?? "personal");

  // Day chips: Today, Tomorrow, then the next few weekdays by name.
  const dayChips = [
    { date: today, label: "Today" },
    { date: addDays(today, 1), label: "Tomorrow" },
    ...[2, 3, 4, 5, 6].map((n) => {
      const d = addDays(today, n);
      return { date: d, label: WEEKDAY_SHORT[weekdayOf(d)] };
    }),
  ];
  const dueIsCustom = dueDate !== null && !dayChips.some((c) => c.date === dueDate);

  function save() {
    setError(null);
    if (!title) {
      setError("Type what you need to do");
      inputRef.current?.focus();
      return;
    }
    // A fix to a past workout: only after the preview found it, and only those sets.
    if (gymFix) {
      if (!fix?.preview) return setError(fix?.error ?? "Still looking for that workout…");
      const p = fix.preview;
      startTransition(async () => {
        const result = await applyFixAction(p.changes);
        if (!result.ok) return setError(result.error);
        onDone(`✏️ Fixed ${p.exercise} · ${p.date} ✓`);
      });
      return;
    }
    // "spent $12 gas" / "got paid $400" → Money, not a task.
    if (money) {
      startTransition(async () => {
        const result = await addMoneyAction({ amountCents: money.cents, description: money.label });
        if (!result.ok) return setError(result.error);
        onDone(`${money.cents < 0 ? "Spent" : "Got"} ${dollars(money.cents)} · ${money.label} ✓`);
      });
      return;
    }
    if (other) {
      startTransition(async () => {
        const result = await other.save();
        if (!result.ok) return setError(result.error ?? "Couldn't save");
        onDone(result.msg);
      });
      return;
    }
    if (lift) {
      startTransition(async () => {
        const result = await logSpokenWorkoutAction(text);
        if (!result.ok) return setError(result.error);
        if (result.skipped) return onDone(`⏭️ ${result.note}`);
        const n = lift.entries.length;
        onDone(`🏋️ ${result.day ? `${result.day} day` : "Workout"}${n ? ` · ${n} exercise${n === 1 ? "" : "s"}` : ""} saved → Gym ✓`);
      });
      return;
    }
    startTransition(async () => {
      const result = await saveTaskAction({
        id: editing?.id,
        title,
        classId,
        dueDate,
        dueTime,
        repeat,
        inboxId: prefill?.inboxId,
        notes: notes.trim() || null,
        area,
        ...(editing ? { nagLevel } : {}),
      });
      if (!result.ok) return setError(result.error);
      const when = dueDate ? ` · ${dueDate === today ? "Today" : formatLocalDate(dueDate)}` : "";
      onDone(`${editing ? "Saved" : "Added"} ✓ ${taskDisplayTitle(title, cls?.name ?? null)}${when}`);
    });
  }

  function saveAll() {
    setError(null);
    const list = keptItems;
    if (!list.length) return setError("Nothing left to save. Tap ↩ to bring items back.");
    startTransition(async () => {
      const tasks: SaveTaskInput[] = [];
      let others = 0;
      const failed: string[] = [];
      // Money, food, workouts, habits and journal lines go to their own pages; to-dos are saved together.
      for (const { text: itemText, draft } of list) {
        const outside = await saveOutsideTasks(itemText, draft);
        if (outside === null) tasks.push(draftToTask(draft));
        else if (outside.ok) others++;
        else failed.push(`${draft.title}: ${outside.error}`);
      }
      if (tasks.length) {
        const r = await saveTasksAction(tasks);
        if (!r.ok) return setError(others ? `Saved ${others}, but the to-dos didn't save: ${r.error}` : r.error);
      }
      const saved = tasks.length + others;
      if (failed.length) return setError(`Saved ${saved}. Couldn't save ${failed.join("; ")}`);
      onDone(`Added ${saved} item${saved === 1 ? "" : "s"} ✓`);
    });
  }

  function remove() {
    if (!editing) return;
    startTransition(async () => {
      const result = await deleteTaskAction(editing.id);
      if (!result.ok) return setError(result.error);
      onDone("Moved to Trash");
    });
  }

  return (
    <div className="fade-in fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit" : "Add something"}
        onClick={(e) => e.stopPropagation()}
        className="sheet-in w-full max-w-lg rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card md:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{editing ? "Edit" : speech.listening ? "Listening…" : "What do you need to do?"}</h2>
          <div className="flex items-center gap-1">
            {!editing && <AutoMicSwitch />}
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-ink">
              <IconClose size={20} />
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (multi) saveAll();
            else save();
          }}
          className="flex flex-col gap-4"
        >
          <div className="relative">
            <textarea
              ref={inputRef}
              autoFocus={!wantsVoice}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter saves (Shift+Enter starts a new line for a typed list).
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={speech.listening ? "Listening… keep talking" : editing ? "Title" : "speech memorization due wed"}
              rows={Math.min(8, Math.max(1, Math.ceil(text.length / 34) + (text.match(/\n/g)?.length ?? 0)))}
              className={cx(inputClass, "w-full resize-none py-3 pr-14 text-lg leading-snug sm:text-base", speech.listening && "border-accent shadow-glow")}
              enterKeyHint="done"
              maxLength={editing ? 200 : 5000}
            />
            {!editing && (
              <button
                type="button"
                onClick={micPressed}
                data-silent
                aria-label={speech.listening ? "Stop listening" : text.trim() ? "Keep talking (adds to this)" : "Speak instead of typing"}
                className={cx(
                  "absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90",
                  speech.listening ? "mic-live bg-accent text-accent-ink" : "bg-raised text-accent hover:bg-accent/15",
                )}
              >
                <IconMic size={20} />
              </button>
            )}
          </div>
          {speech.listening && (
            <div className="flex items-center gap-2 text-sm text-accent" aria-live="polite">
              <span className="voice-bars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="min-w-0 flex-1">
                Listening <span className="tabular-nums">{Math.floor(speech.seconds / 60)}:{String(speech.seconds % 60).padStart(2, "0")}</span>
                <span className="block text-xs text-muted">
                  {text ? "Keep going. Say “next” or “also” between things. Tap the mic when you're done." : `Try “${example}”`}
                </span>
              </span>
              <button type="button" onClick={speech.stop} className="shrink-0 rounded-full border border-accent/50 px-3 py-1 text-xs font-semibold">
                Done
              </button>
            </div>
          )}
          {/* Mic on but no words: say so, with what the mic did (a screenshot of this helps fix it) */}
          {speech.listening && speech.seconds >= 5 && !text && (
            <p className="text-xs text-muted">
              Not hearing words yet… <span className="text-faint">Mic: {speech.log || "waiting"}</span>
            </p>
          )}
          {!speech.listening && !speech.error && speech.heardNothing && (
            <p className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-muted">
              The mic didn&apos;t hear any words. Tap it to try again, or use the 🎤 on your keyboard.
              <span className="mt-1 block text-[11px] text-faint">Mic: {speech.log || "nothing happened"}</span>
            </p>
          )}
          {!speech.listening && (speech.error || voiceTip) && (
            <p className="rounded-xl border border-electric/30 bg-electric/10 px-3 py-2 text-xs text-muted">
              {speech.error ?? "Tap the 🎤 microphone on your keyboard and speak. It types for you."}
            </p>
          )}

          {/* A whole list: every item it heard, ready to check and save together */}
          {multi && (
            <ManyPreview
              items={many}
              removed={removed}
              classes={classes}
              today={today}
              onToggle={(key) =>
                setRemoved((r) => {
                  const next = new Set(r);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              onKeepAsOne={() => setAsOne(true)}
            />
          )}
          {asOne && (
            <button type="button" onClick={() => setAsOne(false)} className="-mt-1 self-end text-xs text-faint hover:text-ink">
              ↩ Split it into separate items again
            </button>
          )}

          {/* Money preview: this will be saved to Money instead of as a task */}
          {money && (
            <div className="glow-money flex items-center gap-3 rounded-xl border border-ok/40 bg-ok/10 px-3 py-2.5 text-sm">
              <span className="text-lg">{money.cents < 0 ? "💸" : "💰"}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{money.label}</span>
              <span className={cx("shrink-0 font-display font-semibold", money.cents > 0 ? "text-ok" : "text-ink")}>{dollars(money.cents, true)}</span>
              <span className="shrink-0 text-[10px] font-bold tracking-wider text-ok uppercase">→ Money</span>
            </div>
          )}

          {/* Fixing a past workout: exactly what changes, before anything is saved */}
          {gymFix && (
            <div className="glow-gym flex flex-col gap-1.5 rounded-xl border border-[#ff6b4a]/50 bg-[#ff6b4a]/10 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">✏️</span>
                <span className="min-w-0 flex-1 font-semibold">
                  Fix {gymFix.exercise}
                  {fix?.preview ? ` · ${fix.preview.date}` : ""}
                </span>
                <span className="shrink-0 text-[10px] font-bold tracking-wider text-[#ff6b4a] uppercase">→ Gym</span>
              </div>
              {!fix && <p className="pl-7 text-xs text-muted">Finding that workout…</p>}
              {fix?.error && <p className="pl-7 text-xs text-danger">{fix.error}</p>}
              {fix?.preview && (
                <ul className="flex flex-col gap-0.5 pl-7">
                  {fix.preview.day && <li className="text-[11px] text-muted">{fix.preview.day} day</li>}
                  {fix.preview.changes.map((c) => (
                    <li key={`${c.setId}-${c.n}-${c.field}`} className="font-display text-xs font-semibold tabular-nums">
                      {changeLabel(c)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Gym preview: these sets go to today's workout */}
          {lift && (
            <div className="glow-gym flex flex-col gap-1.5 rounded-xl border border-[#ff6b4a]/50 bg-[#ff6b4a]/10 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">{lift.skip && !lift.entries.length ? "⏭️" : "🏋️"}</span>
                <span className="min-w-0 flex-1 font-semibold">
                  {lift.skip && !lift.entries.length ? "Skip today's gym day" : lift.day ? `${lift.day} day` : "Workout"}
                </span>
                <span className="shrink-0 text-[10px] font-bold tracking-wider text-[#ff6b4a] uppercase">→ Gym</span>
              </div>
              {lift.entries.length > 0 && (
                <ul className="flex flex-col gap-0.5 pl-7">
                  {lift.entries.map((e) => (
                    <li key={e.name} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {e.name}
                        {!e.exerciseId && <span className="ml-1 text-[10px] text-[#ff6b4a]">new</span>}
                      </span>
                      <span className="shrink-0 font-display text-xs font-semibold tabular-nums">{setsSummary(e.sets)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {lift.muscles.length > 0 && <p className="pl-7 text-[11px] text-muted">Muscles: {lift.muscles.join(", ")}</p>}
            </div>
          )}

          {/* Habit / journal / food / cardio preview */}
          {other && (
            <div
              className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: `${other.color}66`, backgroundColor: `${other.color}14`, boxShadow: `0 0 22px -10px ${other.color}` }}
            >
              <span className="text-lg">{other.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block font-medium">{other.label}</span>
                {other.detail && <span className="block text-xs text-muted">{other.detail}</span>}
              </span>
              <span className="shrink-0 text-[10px] font-bold tracking-wider uppercase" style={{ color: other.color }}>
                → {other.to}
              </span>
            </div>
          )}
          {(money || lift || other || gymFix) && (
            <button type="button" onClick={() => setAsTask(true)} className="-mt-1 self-end text-xs text-faint hover:text-ink">
              Not right? Save as a task instead
            </button>
          )}
          {asTask && (
            <button type="button" onClick={() => setAsTask(false)} className="-mt-1 self-end text-xs text-faint hover:text-ink">
              ↩ Undo: let it decide again
            </button>
          )}

          {/* Live preview of what will be saved */}
          {!editing && !multi && title && !money && !lift && !other && !gymFix && (
            <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
              {cls && <ColorDot color={cls.color} />}
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {area === "work" && <span className="mr-1 text-warn">💼</span>}
                  {taskDisplayTitle(title, cls?.name ?? null)}
                </span>
                {notes.trim() && <span className="mt-0.5 line-clamp-4 block text-xs whitespace-pre-line text-muted italic">{notes}</span>}
              </span>
              {dueDate && <span className="shrink-0 self-start text-muted">{dueDate === today ? "Today" : formatLocalDate(dueDate)}</span>}
            </div>
          )}

          {/* Task-only controls are hidden when it's going to Gym, Money, Food… */}
          {!multi && !money && !lift && !other && !gymFix && (
            <>
          {/* Area: school, work, personal */}
          {!cls && (
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <Chip key={a.value} active={area === a.value} onClick={() => setAreaPick(a.value)}>
                  {a.label}
                </Chip>
              ))}
            </div>
          )}

          {/* Class */}
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted">Class</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              <Chip active={classId === null} onClick={() => setClassPick(null)}>
                None
              </Chip>
              {classes.map((c) => (
                <Chip key={c.id} active={classId === c.id} color={c.color} onClick={() => setClassPick(c.id)}>
                  {c.name}
                </Chip>
              ))}
            </div>
          </div>

          {/* Day */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted">
              <IconCalendar size={14} /> Due
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              <Chip active={dueDate === null} onClick={() => setDatePick(null)}>
                No date
              </Chip>
              {dayChips.map((c) => (
                <Chip key={c.date} active={dueDate === c.date} onClick={() => setDatePick(c.date)}>
                  {c.label}
                </Chip>
              ))}
              {/* The real date input sits invisibly on top of the chip, so tapping
                  it opens the phone's own date picker. */}
              <label
                className={cx(
                  "relative flex shrink-0 cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm transition",
                  dueIsCustom ? "border-accent bg-accent/15 text-ink shadow-glow" : "border-line bg-raised text-muted hover:text-ink",
                )}
              >
                {dueIsCustom ? formatLocalDate(dueDate!) : "Pick…"}
                <input
                  type="date"
                  aria-label="Pick a date"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  value={dueDate ?? ""}
                  onChange={(e) => setDatePick(e.target.value || null)}
                />
              </label>
            </div>
          </div>

          {/* Repeat */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted">
              <IconRepeat size={14} /> Repeat
            </p>
            <div className="flex flex-wrap gap-2">
              {REPEAT_CHOICES.map((r) => (
                <Chip key={r.value} active={repeat === r.value} onClick={() => setRepeat(r.value)}>
                  {r.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Reminders: how hard this one nags, and snooze (editing only) */}
          {editing && (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted">🔔 Reminders</p>
              <div className="flex flex-wrap gap-2">
                {NAG_CHOICES.map((n) => (
                  <Chip key={n.value} active={nagLevel === n.value} onClick={() => setNagLevel(n.value)}>
                    {n.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-faint">{NAG_CHOICES.find((n) => n.value === nagLevel)?.hint}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Snooze:</span>
                {SNOOZE_CHOICES.map((s) => (
                  <Chip
                    key={s.value}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await snoozeTaskAction(editing.id, s.value);
                        if (!r.ok) return setError(r.error);
                        setSnoozed(r.until ?? null);
                      })
                    }
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
              {snoozed && snoozedText(snoozed, new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone) && (
                <p className="mt-1.5 flex items-center gap-2 text-xs text-electric">
                  Snoozed until {snoozedText(snoozed, new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)?.slice(2)}
                  <button
                    type="button"
                    className="text-muted underline"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await snoozeTaskAction(editing.id, null);
                        if (!r.ok) return setError(r.error);
                        setSnoozed(null);
                      })
                    }
                  >
                    Cancel
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Notes: filled from what you said after the main part; editable */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotesEdit(e.target.value)}
              rows={Math.min(6, Math.max(2, (notes.match(/\n/g)?.length ?? 0) + 1 + Math.floor(notes.length / 60)))}
              placeholder="Details, e.g. 3 pages, 2 sources"
              className={cx(inputClass, "resize-none text-sm")}
              maxLength={2000}
            />
          </label>
            </>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {editing && (
            <button
              type="button"
              onClick={() => {
                focusStore.start({ id: editing.id, title: taskDisplayTitle(editing.title, cls?.name ?? null), color: cls?.color ?? null });
                onClose();
              }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-electric/40 bg-electric/10 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-electric/20 active:scale-[0.98]"
            >
              ⏱ Focus on this for 25 min
            </button>
          )}

          <div className="flex gap-2 pt-1">
            {editing && (
              <Button type="button" variant="danger" onClick={remove} disabled={pending}>
                Delete
              </Button>
            )}
            <Button type="submit" disabled={pending || (multi ? keptItems.length === 0 : !title)} className="flex-1 py-3 text-base">
              {pending
                ? "Saving…"
                : editing
                  ? "Save"
                  : multi
                    ? `Save all ${keptItems.length}`
                    : gymFix
                      ? "Fix it ✏️"
                      : lift
                      ? lift.skip && !lift.entries.length
                        ? "Skip it ⏭️"
                        : "Save workout 🏋️"
                      : money
                        ? "Save to Money"
                        : other
                          ? `Save to ${other.to}`
                          : "Add"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Small switch in the sheet: should tapping + start the mic right away? */
function AutoMicSwitch() {
  const [on, setOn] = useState(autoMicOn);
  return (
    <button
      type="button"
      onClick={() => {
        setAutoMic(!on);
        setOn(!on);
      }}
      aria-pressed={on}
      title="Start listening as soon as you tap +"
      className={cx(
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
        on ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-faint",
      )}
    >
      <IconMic size={12} /> Auto-mic {on ? "on" : "off"}
    </button>
  );
}

/** A spoken-list item that's a to-do, ready for saveTasksAction. */
function draftToTask(d: CaptureDraft): SaveTaskInput {
  const t = d.when?.hasTime && d.when.time ? `${String(d.when.time.hour).padStart(2, "0")}:${String(d.when.time.minute).padStart(2, "0")}` : null;
  return {
    title: d.title.slice(0, 200),
    classId: d.classId,
    dueDate: d.when?.date ?? null,
    dueTime: t,
    repeat: d.repeat ?? "none",
    notes: d.notes?.slice(0, 2000) ?? null,
    area: d.classId ? "school" : d.area,
  };
}

type Saved = { ok: true } | { ok: false; error: string };
const asSaved = (r: { ok: boolean; error?: string }): Saved => (r.ok ? { ok: true } : { ok: false, error: r.error ?? "Couldn't save" });

/**
 * Saves a list item that isn't a to-do where it belongs (Money, Food, Gym,
 * Habits). Returns null for to-dos, which are saved together.
 */
async function saveOutsideTasks(text: string, d: CaptureDraft): Promise<Saved | null> {
  if (d.type === "expense" && d.amount) {
    const cents = Math.round(d.amount * 100) * (d.incoming ? 1 : -1);
    return asSaved(await addMoneyAction({ amountCents: cents, description: d.title || (d.incoming ? "Paycheck" : "Expense") }));
  }
  if (d.type === "workout") {
    if (!d.sets && (d.distanceMiles !== null || d.minutes !== null)) return asSaved(await logCardioAction({ name: d.title || "Workout", miles: d.distanceMiles, minutes: d.minutes }));
    return asSaved(await logSpokenWorkoutAction(text));
  }
  if (d.type === "habit" && d.habitName) return asSaved(await checkInHabitByNameAction(d.habitName));
  if (d.type === "food") return asSaved(await logFoodAction({ name: d.title, calories: d.calories, proteinG: d.proteinG }));
  return null;
}

/** Where a list item will go, as an emoji and a short label. */
function itemKind(d: CaptureDraft): { emoji: string; to: string | null } {
  if (d.type === "expense" && d.amount) return { emoji: d.incoming ? "💰" : "💸", to: `Money · ${dollars(Math.round(d.amount * 100))}` };
  if (d.type === "workout") return { emoji: "🏋️", to: "Gym" };
  if (d.type === "habit" && d.habitName) return { emoji: "✅", to: "Habits" };
  if (d.type === "food") return { emoji: "🍽️", to: d.calories !== null ? `Food · ${d.calories} cal` : "Food" };
  if (d.classId || d.type === "homework") return { emoji: "📚", to: null };
  if (d.area === "work") return { emoji: "💼", to: null };
  return { emoji: "☑️", to: null };
}

/** The list it heard: one row per item, with its day and notes. Tap ✕ to leave one out. */
function ManyPreview({
  items,
  removed,
  classes,
  today,
  onToggle,
  onKeepAsOne,
}: {
  items: ManyItem[];
  removed: Set<string>;
  classes: SheetClass[];
  today: string;
  onToggle: (key: string) => void;
  onKeepAsOne: () => void;
}) {
  const kept = items.filter((it) => !removed.has(it.text)).length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          🪄 Heard {items.length} things{kept !== items.length ? ` · saving ${kept}` : ""}
        </p>
        <button type="button" onClick={onKeepAsOne} className="text-xs text-faint hover:text-ink">
          Keep as one item
        </button>
      </div>
      <ul className="flex max-h-[42vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
        {items.map(({ text, draft: d }, i) => {
          const off = removed.has(text);
          const cls = classes.find((c) => c.id === d.classId) ?? null;
          const kind = itemKind(d);
          const day = d.when?.date ?? null;
          return (
            <li
              key={`${i}-${text}`}
              className={cx(
                "flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm transition",
                off ? "border-dashed border-line opacity-45" : "border-accent/30 bg-accent/5",
              )}
              style={cls && !off ? { borderLeftColor: cls.color, borderLeftWidth: 3 } : undefined}
            >
              <span className="mt-px text-base leading-none">{kind.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className={cx("block font-medium", off && "line-through")}>{taskDisplayTitle(d.title, cls?.name ?? null)}</span>
                {d.notes && !off && <span className="mt-0.5 line-clamp-4 block text-xs whitespace-pre-line text-muted italic">{d.notes}</span>}
                {kind.to && !off && <span className="mt-0.5 block text-[10px] font-bold tracking-wider text-accent uppercase">→ {kind.to}</span>}
              </span>
              {day && !off && (
                <span className="shrink-0 text-xs text-muted">
                  {day === today ? "Today" : formatLocalDate(day)}
                  {d.when?.hasTime && d.when.time ? ` ${d.when.time.hour % 12 || 12}${d.when.time.minute ? `:${String(d.when.time.minute).padStart(2, "0")}` : ""}${d.when.time.hour < 12 ? "a" : "p"}` : ""}
                </span>
              )}
              <button
                type="button"
                onClick={() => onToggle(text)}
                aria-label={off ? `Put back ${d.title}` : `Leave out ${d.title}`}
                className="-my-1 -mr-1 shrink-0 rounded-full p-1 text-faint hover:bg-raised hover:text-ink"
              >
                {off ? "↩" : <IconClose size={16} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
