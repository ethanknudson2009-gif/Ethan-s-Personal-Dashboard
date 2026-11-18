"use client";

/**
 * Quick add / edit sheet.
 *
 * New: one text box. As you type, our own parser (src/lib/parser) picks out
 * the class and the day, shown as chips you can tap to change. "Add" saves
 * and closes, with a small "Added ✓" toast.
 * Edit: title, class, day and repeat, plus Delete.
 *
 * Kept deliberately simple (Ethan: "I don't want to be scared of my
 * dashboard"): no due time, estimate or priority fields.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { deleteTaskAction, saveTaskAction } from "@/app/(app)/tasks/actions";
import { parse } from "@/lib/parser";
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
};

export type Area = "school" | "work" | "personal";
const AREAS: { value: Area; label: string }[] = [
  { value: "school", label: "🎓 School" },
  { value: "work", label: "💼 PRMI Work" },
  { value: "personal", label: "🏠 Personal" },
];

type RepeatChoice = "none" | "daily" | "weekly" | "biweekly" | "monthly";

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
  timeZone,
  children,
}: {
  classes: SheetClass[];
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
      toast: (text, action) => setToastMsg({ text, key: Date.now(), action }),
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
  timeZone,
  onClose,
  onDone,
}: {
  state: Exclude<SheetState, { mode: "closed" }>;
  classes: SheetClass[];
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
  const [repeat, setRepeat] = useState<RepeatChoice>(editing?.repeat ?? "none");
  // `undefined` = follow what the parser found in your words; a string = you edited it.
  const [notesEdit, setNotesEdit] = useState<string | undefined>(editing ? (editing.notes ?? "") : prefill?.notes != null ? prefill.notes : undefined);
  const [areaPick, setAreaPick] = useState<Area | undefined>(editing?.area ?? prefill?.area);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  // Text that came from the mic gets the "spoken" cleanup (fillers, number
  // words, misheard class names). Of the recognizer's guesses, keep the one
  // that best matches your classes and dates.
  const [spokenInput, setSpokenInput] = useState(false);
  const parseCtx = useMemo(
    () => ({ now: new Date(), timeZone, classes: classes.map((c) => ({ id: c.id, name: c.name, shortNames: c.shortNames })) }),
    [timeZone, classes],
  );
  const speech = useSpeech((heard) => {
    setSpokenInput(true);
    setText(normalizeSpoken(pickBestHearing(heard, parseCtx)));
  });
  const startVoice = speech.start;
  // Opened with "hold +": listen right away (or point to keyboard dictation).
  const wantsVoice = state.mode === "new" && Boolean(state.voice);
  const [voiceTip, setVoiceTip] = useState(wantsVoice && !speech.supported);

  function micPressed() {
    if (speech.listening) return speech.stop();
    if (!startVoice()) {
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
    return parse(text, { ...parseCtx, spoken: spokenInput });
  }, [editing, text, parseCtx, spokenInput]);

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
  const cls = classes.find((c) => c.id === classId) ?? null;
  const notes = notesEdit !== undefined ? notesEdit : (parsed?.notes ?? "");
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
      });
      if (!result.ok) return setError(result.error);
      const when = dueDate ? ` · ${dueDate === today ? "Today" : formatLocalDate(dueDate)}` : "";
      onDone(`${editing ? "Saved" : "Added"} ✓ ${taskDisplayTitle(title, cls?.name ?? null)}${when}`);
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
            save();
          }}
          className="flex flex-col gap-4"
        >
          <div className="relative">
            <input
              ref={inputRef}
              autoFocus={!wantsVoice}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={speech.listening ? "Listening…" : editing ? "Title" : "speech memorization due wed"}
              className={cx(inputClass, "w-full py-3 pr-14 text-lg sm:text-base", speech.listening && "border-accent shadow-glow")}
              enterKeyHint="done"
              maxLength={200}
            />
            {!editing && (
              <button
                type="button"
                onClick={micPressed}
                aria-label={speech.listening ? "Stop listening" : "Speak instead of typing"}
                className={cx(
                  "absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full transition active:scale-90",
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
              Listening… say it like “speech outline due thursday”
            </div>
          )}
          {!speech.listening && (speech.error || voiceTip) && (
            <p className="rounded-xl border border-electric/30 bg-electric/10 px-3 py-2 text-xs text-muted">
              {speech.error ?? "Tap the 🎤 microphone on your keyboard and speak. It types for you."}
            </p>
          )}

          {/* Live preview of what will be saved */}
          {!editing && title && (
            <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
              {cls && <ColorDot color={cls.color} />}
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {area === "work" && <span className="mr-1 text-warn">💼</span>}
                  {taskDisplayTitle(title, cls?.name ?? null)}
                </span>
                {notes.trim() && <span className="mt-0.5 line-clamp-2 block text-xs text-muted italic">{notes}</span>}
              </span>
              {dueDate && <span className="shrink-0 self-start text-muted">{dueDate === today ? "Today" : formatLocalDate(dueDate)}</span>}
            </div>
          )}

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

          {/* Notes: filled from what you said after the main part; editable */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotesEdit(e.target.value)}
              rows={notes.length > 80 ? 3 : 2}
              placeholder="Details, e.g. 3 pages, 2 sources"
              className={cx(inputClass, "resize-none text-sm")}
              maxLength={2000}
            />
          </label>

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
            <Button type="submit" disabled={pending || !title} className="flex-1 py-3 text-base">
              {pending ? "Saving…" : editing ? "Save" : "Add"}
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
