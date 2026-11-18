"use client";

/**
 * One task in a list.
 *  - Tap the circle to check it off: the ring pops, the check draws itself,
 *    a burst of teal light, the title is struck through, the row slides away.
 *    The "Done ✓" message has an Undo button.
 *  - Swipe right to check it off; swipe left to push it to tomorrow
 *    (phones; the colored layer underneath shows what will happen).
 *  - Tap the text to edit.
 *
 * Highlights (docs/09): overdue = red glow + wash, due today = teal glow
 * that gently pulses, tomorrow = amber edge.
 */
import { useRef, useState, useTransition } from "react";
import { completeTaskAction, reopenTaskAction, saveTaskAction } from "@/app/(app)/tasks/actions";
import type { TaskView } from "@/lib/tasks/view";
import { addDays, toLocalDate } from "@/lib/time";
import { ColorDot, cx } from "@/components/ui";
import { IconRepeat } from "@/components/icons";
import { useTaskSheet } from "@/components/task-sheet";

const TONE_STYLES: Record<TaskView["tone"], string> = {
  overdue: "wash-danger border-danger/50 shadow-glow-danger",
  today: "wash-accent border-accent/50 pulse-glow",
  tomorrow: "border-warn/40 shadow-glow-warn",
  normal: "border-line",
  done: "border-line opacity-70",
};

const DUE_STYLES: Record<TaskView["tone"], string> = {
  overdue: "text-danger font-medium",
  today: "text-accent font-medium",
  tomorrow: "text-warn",
  normal: "text-muted",
  done: "text-faint",
};

/** How far (px) a swipe must go to count. */
const SWIPE_AT = 90;

export function TaskItem({ task }: { task: TaskView }) {
  const sheet = useTaskSheet();
  const [phase, setPhase] = useState<"idle" | "checking" | "moving" | "gone">("idle");
  const [, startTransition] = useTransition();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; active: boolean; decided: boolean } | null>(null);

  function check() {
    if (phase !== "idle") return;
    setPhase("checking");
    startTransition(async () => {
      // Let the animation play before the list refreshes underneath it.
      if (!task.done) await new Promise((r) => setTimeout(r, 650));
      const result = task.done ? await reopenTaskAction(task.id) : await completeTaskAction(task.id);
      if (!result.ok) {
        setPhase("idle");
        sheet.toast(`Couldn't update: ${result.error}`);
      } else if (!task.done) {
        sheet.toast(task.repeatText ? "Done ✓ Next one is scheduled" : "Done ✓", {
          label: "Undo",
          run: () => void reopenTaskAction(task.id),
        });
      }
    });
  }

  function pushToTomorrow() {
    if (phase !== "idle") return;
    const tomorrow = addDays(toLocalDate(new Date(), sheet.timeZone), 1);
    setPhase("moving");
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 250));
      const before = task.edit;
      const result = await saveTaskAction({ ...before, dueDate: tomorrow });
      if (!result.ok) {
        setPhase("idle");
        setDx(0);
        sheet.toast(`Couldn't move: ${result.error}`);
      } else {
        sheet.toast("Moved to tomorrow", { label: "Undo", run: () => void saveTaskAction(before) });
      }
    });
  }

  // ── Swipe handling (touch or mouse drag), horizontal only ───────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (task.done || phase !== "idle" || (e.target as HTMLElement).closest("[data-no-swipe]")) return;
    drag.current = { x: e.clientX, y: e.clientY, active: false, decided: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.decided && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      d.decided = true;
      d.active = Math.abs(mx) > Math.abs(my) * 1.3; // mostly sideways = swipe; otherwise it's a scroll
      if (d.active) setDragging(true);
    }
    if (d.active) setDx(Math.max(-140, Math.min(140, mx)));
  };
  const onPointerEnd = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d?.active) return;
    if (dx >= SWIPE_AT) {
      setDx(0);
      check();
    } else if (dx <= -SWIPE_AT) {
      setDx(-400);
      pushToTomorrow();
    } else setDx(0);
  };

  if (phase === "gone") return null;
  const checking = phase === "checking";
  const showChecked = task.done !== checking; // flips the look instantly when tapped
  const swiping = dx !== 0;

  return (
    <li
      className={cx("relative rounded-2xl", checking && !task.done && "row-leaving", phase === "moving" && "row-leaving")}
      onAnimationEnd={(e) => {
        if (e.animationName === "row-out") setPhase("gone");
      }}
    >
      {/* What a swipe will do, revealed underneath the row */}
      {swiping && (
        <>
          <div className={cx("swipe-under justify-start bg-accent/20 text-accent", dx <= 0 && "opacity-0")}>
            {dx >= SWIPE_AT ? "✓ Release to finish" : "✓ Done"}
          </div>
          <div className={cx("swipe-under justify-end bg-warn/20 text-warn", dx >= 0 && "opacity-0")}>
            {dx <= -SWIPE_AT ? "Release → tomorrow" : "Tomorrow →"}
          </div>
        </>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y" }}
        className={cx(
          "group relative flex items-center gap-3 rounded-2xl border bg-raised/95 px-3 py-3",
          dragging ? "" : "transition-[transform,box-shadow,border-color] duration-300",
          TONE_STYLES[checking ? "normal" : task.tone],
        )}
      >
        {/* The check circle */}
        <button
          type="button"
          data-no-swipe
          onClick={check}
          aria-label={task.done ? "Mark as not done" : "Check off"}
          className="relative flex h-8 w-8 shrink-0 items-center justify-center"
        >
          {checking && !task.done && <span className="check-burst absolute inset-0 rounded-full bg-accent/60" />}
          <span
            className={cx(
              "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors duration-200",
              showChecked ? "check-ring-done border-accent bg-accent text-accent-ink" : "border-muted/70 group-hover:border-accent",
            )}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
              <path
                className={showChecked ? "check-path" : "hidden"}
                style={task.done && !checking ? { strokeDashoffset: 0 } : undefined}
                d="M5 12.5l4.5 4.5L19 7.5"
              />
            </svg>
          </span>
        </button>

        {/* Text: tap to edit */}
        <button
          type="button"
          onClick={() => {
            if (!swiping) sheet.openEdit(task.edit);
          }}
          className="min-w-0 flex-1 text-left select-none"
        >
          <span className="flex items-start gap-2">
            {task.classColor && (
              <span className="mt-1.5">
                <ColorDot color={task.classColor} />
              </span>
            )}
            <span className={cx("title-strike line-clamp-2 leading-snug font-medium break-words", showChecked && "title-strike-on")}>
              {task.displayTitle}
            </span>
          </span>
          {(task.dueText || task.repeatText || task.focusedText) && (
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              {task.dueText && <span className={DUE_STYLES[task.tone]}>{task.dueText}</span>}
              {task.repeatText && (
                <span className="flex items-center gap-1 text-faint">
                  <IconRepeat size={12} /> {task.repeatText}
                </span>
              )}
              {task.focusedText && <span className="text-electric">{task.focusedText}</span>}
            </span>
          )}
        </button>
      </div>
    </li>
  );
}
