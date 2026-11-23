/**
 * Home's gym card: which split day is up next, the muscles it hits, what you
 * did last time, and one button that starts it and takes you to the Gym.
 */
import Link from "next/link";
import { StartWorkout } from "@/components/gym-parts";

const FIRE = "#ff6b4a";

export type UpNext =
  | { state: "ready"; day: string; muscles: string[]; lastDone: string | null; lastExercises: string[]; tip: string | null }
  | { state: "open"; day: string | null; sets: number }
  | { state: "done"; trained: string | null; next: string };

export function GymUpNext({ up }: { up: UpNext }) {
  if (up.state === "open") {
    return (
      <Link
        href="/gym"
        className="glow-gym flex items-center gap-3 rounded-2xl border px-4 py-3 transition active:scale-[0.99]"
        style={{ borderColor: `${FIRE}80`, backgroundColor: `${FIRE}14` }}
      >
        <span className="text-2xl">🔥</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{up.day ? `${up.day} day in progress` : "Workout in progress"}</span>
          <span className="block text-xs text-muted">
            {up.sets} set{up.sets === 1 ? "" : "s"} done · tap to keep going
          </span>
        </span>
        <span className="font-semibold" style={{ color: FIRE }}>
          Continue ›
        </span>
      </Link>
    );
  }
  if (up.state === "done") {
    return (
      <Link href="/gym" className="flex items-center gap-3 rounded-2xl border border-line bg-surface/80 px-4 py-3 transition active:scale-[0.99]">
        <span className="text-2xl">💪</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Trained today{up.trained ? `: ${up.trained}` : ""}</span>
          <span className="block text-xs text-muted">Next up: {up.next} day</span>
        </span>
        <span className="text-muted">›</span>
      </Link>
    );
  }
  return (
    <section className="hero-gym rounded-3xl border p-4" style={{ borderColor: `${FIRE}66`, backgroundColor: `${FIRE}0d` }}>
      <Link href="/gym" className="block">
        <p className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: FIRE }}>
          🏋️ Gym · up next
        </p>
        <p className="font-display text-2xl font-semibold">{up.day} day</p>
        <p className="mt-0.5 text-xs text-muted">
          {up.muscles.length ? up.muscles.join(" · ") : "Your split"}
          {up.lastDone ? ` · last time ${up.lastDone}` : " · first time"}
        </p>
        {up.lastExercises.length > 0 && <p className="mt-1.5 line-clamp-2 text-xs text-faint">{up.lastExercises.join(" · ")}</p>}
        {up.tip && <p className="mt-1.5 text-xs text-ink">🧠 {up.tip}</p>}
      </Link>
      <div className="mt-3">
        <StartWorkout day={up.day} label={`Start ${up.day} day`} goTo="/gym" />
      </div>
    </section>
  );
}
