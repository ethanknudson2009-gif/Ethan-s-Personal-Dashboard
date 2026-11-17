/**
 * Task helpers shared by the Tasks page, Today page and (later) the capture
 * API: repeat presets for forms, describing repeats in words, and working out
 * the next copy of a repeating task when one is checked off.
 */
import { nextDue, type RepeatRule } from "@/lib/repeat";

export const REPEAT_PRESETS = [
  { value: "none", label: "Doesn't repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month" },
  { value: "after_days", label: "X days after I finish it" },
] as const;

export type RepeatPreset = (typeof REPEAT_PRESETS)[number]["value"];

/** Turns the form's repeat choice into a rule (or null for "doesn't repeat"). */
export function repeatFromForm(preset: string, afterDays?: number | null): RepeatRule | null {
  switch (preset) {
    case "daily":
      return { mode: "fixed", every: 1, unit: "day" };
    case "weekly":
      return { mode: "fixed", every: 1, unit: "week" };
    case "biweekly":
      return { mode: "fixed", every: 2, unit: "week" };
    case "monthly":
      return { mode: "fixed", every: 1, unit: "month" };
    case "after_days": {
      const n = Math.round(Number(afterDays));
      if (!Number.isFinite(n) || n < 1) return null;
      return { mode: "after_completion", every: n, unit: "day" };
    }
    default:
      return null;
  }
}

/** The form preset that matches a saved rule, so the edit form shows it. */
export function presetFromRule(rule: RepeatRule | null): { preset: RepeatPreset; afterDays: number | null } {
  if (!rule) return { preset: "none", afterDays: null };
  if (rule.mode === "after_completion") {
    return { preset: "after_days", afterDays: rule.unit === "week" ? rule.every * 7 : rule.every };
  }
  if (rule.unit === "day" && rule.every === 1) return { preset: "daily", afterDays: null };
  if (rule.unit === "week" && rule.every === 1) return { preset: "weekly", afterDays: null };
  if (rule.unit === "week" && rule.every === 2) return { preset: "biweekly", afterDays: null };
  if (rule.unit === "month" && rule.every === 1) return { preset: "monthly", afterDays: null };
  return { preset: "none", afterDays: null };
}

/** "Every week", "Every 3 days", "7 days after done". */
export function describeRepeat(rule: RepeatRule | null): string | null {
  if (!rule) return null;
  const plural = rule.every === 1 ? "" : "s";
  if (rule.mode === "after_completion") return `${rule.every} ${rule.unit}${plural} after done`;
  return rule.every === 1 ? `Every ${rule.unit}` : `Every ${rule.every} ${rule.unit}s`;
}

/** Reads a repeat rule from the database's JSON column, ignoring anything malformed. */
export function parseRepeat(value: unknown): RepeatRule | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Partial<RepeatRule>;
  if (r.mode !== "fixed" && r.mode !== "after_completion") return null;
  if (r.unit !== "day" && r.unit !== "week" && r.unit !== "month") return null;
  if (typeof r.every !== "number" || r.every < 1) return null;
  return {
    mode: r.mode,
    unit: r.unit,
    every: r.every,
    ...(Array.isArray(r.weekdays) ? { weekdays: r.weekdays } : {}),
    ...(typeof r.until === "string" ? { until: r.until } : {}),
  };
}

/**
 * When a repeating task is checked off: the due time of the next copy,
 * or null if it doesn't repeat (or has no due date to repeat from).
 */
export function nextOccurrence(
  task: { due_at: string | null; repeat: unknown },
  completedAt: Date,
  timeZone: string,
): Date | null {
  const rule = parseRepeat(task.repeat);
  if (!rule || !task.due_at) return null;
  return nextDue(rule, new Date(task.due_at), completedAt, timeZone);
}
