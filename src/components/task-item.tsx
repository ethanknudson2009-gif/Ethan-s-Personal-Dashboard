"use client";

/**
 * One task in a list. Tap the circle to check it off: the ring pops, the
 * check draws itself, a burst of teal light, the title gets struck through,
 * then the row slides away. Tap the text to edit.
 *
 * Highlights (docs/09): overdue = red glow, due today = teal glow that
 * gently pulses, tomorrow = amber edge.
 */
import { useState, useTransition } from "react";
import { completeTaskAction, reopenTaskAction } from "@/app/(app)/tasks/actions";
import type { TaskView } from "@/lib/tasks/view";
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

export function TaskItem({ task }: { task: TaskView }) {
  const sheet = useTaskSheet();
  const [phase, setPhase] = useState<"idle" | "checking" | "gone">("idle");
  const [, startTransition] = useTransition();

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
        sheet.toast(task.repeatText ? "Done ✓ Next one is scheduled" : "Done ✓");
      }
    });
  }

  if (phase === "gone") return null;
  const checking = phase === "checking";
  const showChecked = task.done !== checking; // flips the look instantly when tapped

  return (
    <li
      className={cx(
        "group relative flex items-center gap-3 rounded-2xl border bg-raised/70 px-3 py-3 transition",
        TONE_STYLES[checking ? "normal" : task.tone],
        checking && !task.done && "row-leaving",
      )}
      onAnimationEnd={(e) => {
        if (e.animationName === "row-out") setPhase("gone");
      }}
    >
      {/* The check circle */}
      <button
        type="button"
        onClick={check}
        aria-label={task.done ? "Mark as not done" : "Check off"}
        className="relative flex h-7 w-7 shrink-0 items-center justify-center"
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
      <button type="button" onClick={() => sheet.openEdit(task.edit)} className="min-w-0 flex-1 text-left">
        <span className="flex items-start gap-2">
          {task.classColor && (
            <span className="mt-1.5">
              <ColorDot color={task.classColor} />
            </span>
          )}
          <span className={cx("title-strike line-clamp-2 leading-snug font-medium break-words", showChecked && "title-strike-on")}>{task.displayTitle}</span>
        </span>
        {(task.dueText || task.repeatText) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            {task.dueText && <span className={DUE_STYLES[task.tone]}>{task.dueText}</span>}
            {task.repeatText && (
              <span className="flex items-center gap-1 text-faint">
                <IconRepeat size={12} /> {task.repeatText}
              </span>
            )}
          </span>
        )}
      </button>
    </li>
  );
}
