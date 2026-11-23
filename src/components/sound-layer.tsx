"use client";

/**
 * One listener for the whole app: every button, link, tab or chip gives a
 * soft click (and a tiny buzz on phones that support it) the moment your
 * finger touches it, so taps never feel dead. Things can opt out with
 * data-silent (e.g. a button that plays its own sound).
 */
import { useEffect } from "react";
import { playSound } from "@/lib/sound";

const PRESSABLE = "button, a[href], [role=button], [role=tab], [role=switch], [role=checkbox], label, summary, select";

export function SoundLayer() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(PRESSABLE);
      if (!el || el.closest("[data-silent]")) return;
      if (el.matches(":disabled, [aria-disabled=true]")) return;
      playSound("tap");
      navigator.vibrate?.(4);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}
