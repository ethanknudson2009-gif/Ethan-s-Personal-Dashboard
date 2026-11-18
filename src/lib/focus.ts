/**
 * Focus timer math (pure, tested). A session is stored as its end time, so
 * it keeps counting correctly even if the phone locks or the app closes.
 */

export type FocusSession = {
  taskId: string;
  title: string;
  color: string | null;
  minutes: number;
  /** When it will finish (ms since 1970). Null while paused. */
  endsAt: number | null;
  /** Milliseconds left when paused. */
  pausedLeft: number | null;
};

export function startSession(task: { id: string; title: string; color: string | null }, minutes: number, now: number): FocusSession {
  return { taskId: task.id, title: task.title, color: task.color, minutes, endsAt: now + minutes * 60_000, pausedLeft: null };
}

export function msLeft(s: FocusSession, now: number): number {
  if (s.pausedLeft !== null) return s.pausedLeft;
  return Math.max(0, (s.endsAt ?? now) - now);
}

export function pause(s: FocusSession, now: number): FocusSession {
  return s.pausedLeft !== null ? s : { ...s, pausedLeft: msLeft(s, now), endsAt: null };
}

export function resume(s: FocusSession, now: number): FocusSession {
  return s.pausedLeft === null ? s : { ...s, endsAt: now + s.pausedLeft, pausedLeft: null };
}

export function addMinutes(s: FocusSession, minutes: number, now: number): FocusSession {
  const extra = minutes * 60_000;
  return s.pausedLeft !== null
    ? { ...s, minutes: s.minutes + minutes, pausedLeft: s.pausedLeft + extra }
    : { ...s, minutes: s.minutes + minutes, endsAt: (s.endsAt ?? now) + extra };
}

/** Whole minutes actually focused so far (for logging when you stop early). */
export function minutesDone(s: FocusSession, now: number): number {
  return Math.max(0, Math.round((s.minutes * 60_000 - msLeft(s, now)) / 60_000));
}

/** 1500000 → "25:00". */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
