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
import { IconCalendar, IconClose, IconRepeat } from "@/components/icons";

export type SheetClass = { id: string; name: string; color: string; shortNames: string[] };

export type EditableTask = {
  id: string;
  title: string;
  classId: string | null;
  dueDate: string | null;
  dueTime: string | null;
  repeat: RepeatChoice;
};

type RepeatChoice = "none" | "daily" | "weekly" | "biweekly" | "monthly";

const REPEAT_CHOICES: { value: RepeatChoice; label: string }[] = [
  { value: "none", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/** Pre-filled values, e.g. when reviewing an Inbox item. */
export type SheetPrefill = {
  title: string;
  classId: string | null;
  dueDate: string | null;
  dueTime: string | null;
  inboxId?: string;
};

type SheetState = { mode: "closed" } | { mode: "new"; prefill?: SheetPrefill } | { mode: "edit"; task: EditableTask };

type SheetApi = {
  openNew: (prefill?: SheetPrefill) => void;
  openEdit: (task: EditableTask) => void;
  toast: (message: string) => void;
};

const SheetContext = createContext<SheetApi | null>(null);

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
  const [toastMsg, setToastMsg] = useState<{ text: string; key: number } | null>(null);

  const api = useMemo<SheetApi>(
    () => ({
      openNew: (prefill) => setState({ mode: "new", prefill }),
      openEdit: (task) => setState({ mode: "edit", task }),
      toast: (text) => setToastMsg({ text, key: Date.now() }),
    }),
    [],
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
          onAnimationEnd={() => setToastMsg(null)}
          className="toast fixed bottom-28 left-1/2 z-50 rounded-full border border-accent/50 bg-surface px-4 py-2 text-sm font-medium text-ink shadow-glow md:bottom-8"
        >
          {toastMsg.text}
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
  const [classPick, setClassPick] = useState<string | null | undefined>(editing ? editing.classId : prefill ? prefill.classId : undefined);
  const [datePick, setDatePick] = useState<string | null | undefined>(editing ? editing.dueDate : prefill ? prefill.dueDate : undefined);
  const [repeat, setRepeat] = useState<RepeatChoice>(editing?.repeat ?? "none");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

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
    return parse(text, {
      now: new Date(),
      timeZone,
      classes: classes.map((c) => ({ id: c.id, name: c.name, shortNames: c.shortNames })),
    });
  }, [editing, text, timeZone, classes]);

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
          <h2 className="font-display text-lg font-semibold">{editing ? "Edit" : "What do you need to do?"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-ink">
            <IconClose size={20} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-col gap-4"
        >
          <input
            ref={inputRef}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={editing ? "Title" : "speech memorization due wed"}
            className={cx(inputClass, "py-3 text-lg sm:text-base")}
            enterKeyHint="done"
            maxLength={200}
          />

          {/* Live preview of what will be saved */}
          {!editing && title && (
            <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
              {cls && <ColorDot color={cls.color} />}
              <span className="font-medium">{taskDisplayTitle(title, cls?.name ?? null)}</span>
              {dueDate && <span className="ml-auto shrink-0 text-muted">{dueDate === today ? "Today" : formatLocalDate(dueDate)}</span>}
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

          {error && <p className="text-sm text-danger">{error}</p>}

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
