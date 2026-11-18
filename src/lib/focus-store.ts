"use client";

/**
 * The running focus session, shared by the whole app and saved on this
 * device (so it survives closing the app or locking the phone).
 */
import { useSyncExternalStore } from "react";
import { addMinutes, pause, resume, startSession, type FocusSession } from "@/lib/focus";

const KEY = "dashboard.focus";
const listeners = new Set<() => void>();
let current: FocusSession | null = null;
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as FocusSession) : null;
  } catch {
    current = null;
  }
}

function set(next: FocusSession | null) {
  current = next;
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private mode etc.: the timer still works, it just won't survive a reload.
  }
  listeners.forEach((l) => l());
}

export const focusStore = {
  start: (task: { id: string; title: string; color: string | null }, minutes = 25) => set(startSession(task, minutes, Date.now())),
  pause: () => current && set(pause(current, Date.now())),
  resume: () => current && set(resume(current, Date.now())),
  add: (minutes: number) => current && set(addMinutes(current, minutes, Date.now())),
  clear: () => set(null),
  get: () => {
    load();
    return current;
  },
};

export function useFocusSession(): FocusSession | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    focusStore.get,
    () => null,
  );
}
