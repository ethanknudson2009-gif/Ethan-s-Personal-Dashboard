/**
 * The gym coach: reads every set you've logged and turns patterns into
 * plain advice ("You did 3×15 on bench at 135, time for 145").
 *
 * Plain rules, no AI: each rule looks for one thing a coach would notice.
 *  - Too many reps at one weight → go heavier.
 *  - Too few reps (grinding) → drop the weight a little.
 *  - Top of the rep range two sessions in a row → add weight (double progression).
 *  - Same weight, no progress for 3+ sessions → deload or change reps.
 *  - Reps falling off a cliff across sets → rest longer.
 *  - Only 1–2 sets of something → add a set.
 *  - A muscle you haven't trained in 2+ weeks → work it in.
 *  - Way more pushing than pulling → balance it.
 *  - Long gap since the last workout → what's up next.
 *  - Real progress → say so.
 * Each tip has a score so the most useful ones show first.
 */
import { detailOf, DETAIL_LABELS, groupOf, libraryEntry, type Detail } from "./exercise-library";

export type CoachSet = { exerciseId: string; weightLb: number | null; reps: number | null; done?: boolean };
export type CoachWorkout = { date: string; day: string | null; skipped?: boolean; sets: CoachSet[] };
export type CoachExercise = { id: string; name: string; muscle: string; bodyweight?: boolean };
export type Tip = {
  id: string;
  emoji: string;
  title: string;
  why: string;
  tone: "up" | "down" | "warn" | "good" | "info";
  score: number;
};

/** The rep range most gym-goers build muscle in. */
export const REP_RANGE = { low: 6, high: 12 } as const;

/** Estimated 1-rep max (Epley). */
export const e1rm = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const fmt = (sets: { w: number; r: number }[]) => {
  const sameWeight = sets.every((s) => s.w === sets[0].w);
  if (sameWeight && sets.every((s) => s.r === sets[0].r)) return `${sets.length}×${sets[0].r} at ${sets[0].w} lb`;
  if (sameWeight) return `${sets[0].w} lb × ${sets.map((s) => s.r).join(", ")}`;
  return sets.map((s) => `${s.w}×${s.r}`).join(", ");
};

/** Big lower-body and back lifts jump 10 lb at a time; everything else 5. */
function stepFor(ex: CoachExercise): number {
  const n = ex.name.toLowerCase();
  if (/\b(squat|deadlift|leg press|hack squat|hip thrust|rack pull|belt squat|sled)\b/.test(n)) return 10;
  return 5;
}

/** One session of one exercise: the working sets (within 80% of the top weight). */
type Session = { date: string; sets: { w: number; r: number }[]; top: number; best1rm: number };

function sessionsOf(workouts: CoachWorkout[], exerciseId: string): Session[] {
  const out: Session[] = [];
  for (const w of workouts) {
    if (w.skipped) continue;
    const raw = w.sets.filter((s) => s.exerciseId === exerciseId && s.done !== false && s.reps && s.reps > 0);
    if (!raw.length) continue;
    const top = Math.max(...raw.map((s) => s.weightLb ?? 0));
    const sets = raw
      .map((s) => ({ w: s.weightLb ?? 0, r: s.reps! }))
      .filter((s) => top === 0 || s.w >= top * 0.8);
    out.push({ date: w.date, sets, top, best1rm: Math.max(...sets.map((s) => e1rm(s.w, s.r))) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const PUSH: Detail[] = ["chest", "front delts", "lateral delts", "triceps"];
const PULL: Detail[] = ["lats", "upper back", "rear delts", "biceps", "traps"];
/** Parts worth a nudge when they go untrained (not every tiny one). */
const WATCHED: Detail[] = ["chest", "lats", "upper back", "front delts", "lateral delts", "rear delts", "biceps", "triceps", "quads", "hamstrings", "calves", "upper abs", "lower abs", "obliques"];
const SUGGEST: Partial<Record<Detail, string>> = {
  chest: "bench or incline press",
  lats: "pulldowns or pull-ups",
  "upper back": "rows",
  "front delts": "an overhead press",
  "lateral delts": "lateral raises",
  "rear delts": "reverse pec deck or face pulls",
  biceps: "curls",
  triceps: "pushdowns or skull crushers",
  quads: "squats, leg press or leg extensions",
  hamstrings: "RDLs or leg curls",
  calves: "calf raises",
  "upper abs": "cable crunches",
  "lower abs": "hanging leg raises",
  obliques: "Russian twists or Pallof press",
};

export function coachTips(
  workouts: CoachWorkout[],
  exercises: CoachExercise[],
  today: string,
  opts: { split?: string[]; nextDay?: string | null } = {},
): Tip[] {
  const tips: Tip[] = [];
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const trained = workouts.filter((w) => !w.skipped && w.sets.some((s) => s.done !== false && s.reps));
  if (!trained.length) return [];

  const usedIds = [...new Set(trained.flatMap((w) => w.sets.map((s) => s.exerciseId)))];
  for (const id of usedIds) {
    const ex = byId.get(id);
    if (!ex) continue;
    const lib = libraryEntry(ex.name);
    const bodyweight = ex.bodyweight ?? lib?.bodyweight ?? false;
    const cardio = (lib?.muscle ?? ex.muscle) === "cardio" || /\(seconds\)/.test(ex.name);
    if (cardio) continue;
    const ss = sessionsOf(trained, id);
    if (!ss.length) continue;
    const last = ss[ss.length - 1];
    const fresh = daysBetween(last.date, today) <= 21;
    if (!fresh) continue;
    const minReps = Math.min(...last.sets.map((s) => s.r));
    const maxReps = Math.max(...last.sets.map((s) => s.r));
    const step = stepFor(ex);
    const weighted = last.top > 0 && !bodyweight;

    // 0) A set that's probably a typo or a mic mistake ("170 reps at 50 lb"):
    // say so instead of coaching off a wrong number.
    const odd = last.sets.find((s) => (s.w > 0 && s.r > 60) || s.r > 150);
    if (odd) {
      tips.push({
        id: `check-${id}`,
        emoji: "🤔",
        title: `Check your ${ex.name} set`,
        why: `${odd.r} reps${odd.w ? ` at ${odd.w} lb` : ""} on ${last.date.slice(5).replace("-", "/")} looks off. If it's a typo, open that workout in History and tap Edit, or say "fix my last ${ex.name.toLowerCase()} set to 20 reps" (with the right number).`,
        tone: "warn",
        score: 95,
      });
      continue;
    }

    // 1) Way past the rep range: the weight is too light.
    if (weighted && minReps >= 15) {
      const next = round5(last.top * (1 + Math.min(0.25, (minReps - 10) * 0.025)));
      tips.push({
        id: `heavier-${id}`,
        emoji: "⬆️",
        tone: "up",
        title: `Go heavier on ${ex.name}`,
        why: `Last time: ${fmt(last.sets)}. ${minReps}+ reps every set means it's too light to build much strength. Try ${next} lb and aim for ${REP_RANGE.low}–${REP_RANGE.high} reps.`,
        score: 90 + Math.min(10, minReps - 15),
      });
      continue;
    }
    // 2) Double progression: top of the range on every set, twice in a row.
    const prev = ss[ss.length - 2];
    const topped = (s: Session) => s.sets.length >= 2 && s.sets.every((x) => x.r >= REP_RANGE.high);
    if (weighted && topped(last) && prev && topped(prev) && prev.top === last.top) {
      tips.push({
        id: `progress-${id}`,
        emoji: "⬆️",
        tone: "up",
        title: `Add ${step} lb to ${ex.name}`,
        why: `You hit ${REP_RANGE.high}+ reps on every set two sessions in a row at ${last.top} lb. Go to ${last.top + step} lb; it's fine if reps drop to ${REP_RANGE.low}–8 at first.`,
        score: 85,
      });
      continue;
    }
    if (weighted && topped(last) && minReps < 15) {
      tips.push({
        id: `ready-${id}`,
        emoji: "🎯",
        tone: "up",
        title: `${ex.name}: ready to move up soon`,
        why: `${fmt(last.sets)}: every set hit ${REP_RANGE.high}+. One more session like that, then add ${step} lb.`,
        score: 55,
      });
    }
    // 3) Grinding: every set at 1–4 reps (unless it's clearly a strength day on a big lift).
    if (weighted && maxReps <= 4 && last.sets.length >= 2 && step === 5) {
      tips.push({
        id: `lighter-${id}`,
        emoji: "⬇️",
        tone: "down",
        title: `Drop the weight on ${ex.name}`,
        why: `Last time: ${fmt(last.sets)}. That's too heavy to get much growth from an accessory lift. Try ${round5(last.top * 0.85)} lb for ${REP_RANGE.low}–10 clean reps.`,
        score: 70,
      });
    }
    // 4) Stuck: no new best in the last 3+ sessions over 3+ weeks.
    if (ss.length >= 4) {
      const recent = ss.slice(-3);
      const before = Math.max(...ss.slice(0, -3).map((s) => s.best1rm));
      const now = Math.max(...recent.map((s) => s.best1rm));
      const span = daysBetween(recent[0].date, last.date);
      if (weighted && now <= before * 1.005 && span >= 14) {
        tips.push({
          id: `stall-${id}`,
          emoji: "🧱",
          tone: "warn",
          title: `${ex.name} has stalled`,
          why: `No new best in your last ${recent.length} sessions (${span} days). Try one lighter week at ${round5(last.top * 0.9)} lb, or switch the rep range (e.g. 4×6 heavier or 3×12 lighter) for a few weeks.`,
          score: 75,
        });
      } else if (now > before * 1.05 && span <= 42) {
        const pct = Math.round((now / before - 1) * 100);
        tips.push({
          id: `gain-${id}`,
          emoji: "📈",
          tone: "good",
          title: `${ex.name} is up ${pct}%`,
          why: `Your estimated max went from ${Math.round(before)} to ${Math.round(now)} lb. Whatever you're doing is working; keep it.`,
          score: 40 + Math.min(20, pct),
        });
      }
    }
    // 5) Reps fall off a cliff across sets: rest is too short.
    if (last.sets.length >= 3) {
      const first = last.sets[0].r;
      const end = last.sets[last.sets.length - 1].r;
      const sameWeight = last.sets.every((s) => s.w === last.sets[0].w);
      if (sameWeight && first >= 8 && end <= first * 0.55) {
        tips.push({
          id: `rest-${id}`,
          emoji: "⏱️",
          tone: "info",
          title: `Rest longer between ${ex.name} sets`,
          why: `Your reps dropped from ${first} to ${end} at the same weight. Rest 2–3 minutes between sets so every set counts.`,
          score: 50,
        });
      }
    }
    // 6) Only one set, again and again.
    const recentSessions = ss.slice(-3);
    if (recentSessions.length >= 2 && recentSessions.every((s) => s.sets.length === 1) && !bodyweight) {
      tips.push({
        id: `sets-${id}`,
        emoji: "➕",
        tone: "info",
        title: `Add a set to ${ex.name}`,
        why: `You've done just 1 set the last ${recentSessions.length} times. 2–4 sets builds a lot more.`,
        score: 35,
      });
    }
  }

  // 7) Muscles you haven't touched in a while (only once you train regularly).
  const recent14 = trained.filter((w) => daysBetween(w.date, today) <= 14);
  if (recent14.length >= 3) {
    const lastHit = new Map<Detail, string>();
    for (const w of trained) {
      for (const s of w.sets) {
        const ex = byId.get(s.exerciseId);
        if (!ex || s.done === false || !s.reps) continue;
        const part = detailOf(ex.name, ex.muscle);
        if (!lastHit.has(part) || lastHit.get(part)! < w.date) lastHit.set(part, w.date);
      }
    }
    const missing = WATCHED.filter((p) => !lastHit.has(p) || daysBetween(lastHit.get(p)!, today) > 14);
    for (const p of missing.slice(0, 3)) {
      const when = lastHit.get(p);
      tips.push({
        id: `miss-${p}`,
        emoji: "🫥",
        tone: "warn",
        title: `No ${DETAIL_LABELS[p].toLowerCase()} in ${when ? `${daysBetween(when, today)} days` : "your log yet"}`,
        why: `Add ${SUGGEST[p] ?? "something for them"} to your ${groupOf(p).label.toLowerCase()} day.`,
        score: 60 + (when ? Math.min(15, daysBetween(when, today) - 14) : 5),
      });
    }

    // 8) Push vs pull balance over the last 4 weeks (sets).
    let push = 0;
    let pull = 0;
    for (const w of trained.filter((x) => daysBetween(x.date, today) <= 28)) {
      for (const s of w.sets) {
        const ex = byId.get(s.exerciseId);
        if (!ex || s.done === false || !s.reps) continue;
        const part = detailOf(ex.name, ex.muscle);
        if (PUSH.includes(part)) push++;
        if (PULL.includes(part)) pull++;
      }
    }
    if (push >= 12 && push > pull * 1.5) {
      tips.push({
        id: "balance-pull",
        emoji: "⚖️",
        tone: "warn",
        title: "More pulling, less pushing",
        why: `Last 4 weeks: ${push} pushing sets vs ${pull} pulling. Even it out with rows, pulldowns and rear delts; it keeps your shoulders healthy.`,
        score: 65,
      });
    } else if (pull >= 12 && pull > push * 1.5) {
      tips.push({
        id: "balance-push",
        emoji: "⚖️",
        tone: "info",
        title: "Your pushing is behind your pulling",
        why: `Last 4 weeks: ${pull} pulling sets vs ${push} pushing. Add some presses to balance it.`,
        score: 45,
      });
    }
  }

  // 9) Long gap since the last workout.
  const lastDate = trained.map((w) => w.date).sort().at(-1)!;
  const gap = daysBetween(lastDate, today);
  if (gap >= 4) {
    tips.push({
      id: "gap",
      emoji: "📅",
      tone: "info",
      title: `${gap} days since your last workout`,
      why: opts.nextDay ? `${opts.nextDay} is up next. Even a short session keeps the streak going.` : "Even a short session keeps the habit going.",
      score: 70 + Math.min(20, gap),
    });
  }

  // 10) Weekly frequency compared with your usual.
  const weeksBack = [1, 2, 3, 4].map((k) => trained.filter((w) => { const d = daysBetween(w.date, today); return d >= 7 * k && d < 7 * (k + 1); }).length);
  const usual = weeksBack.reduce((a, b) => a + b, 0) / 4;
  const thisWeek = trained.filter((w) => daysBetween(w.date, today) < 7).length;
  if (usual >= 2 && thisWeek >= usual + 1) {
    tips.push({
      id: "streak",
      emoji: "🔥",
      tone: "good",
      title: `${thisWeek} workouts in 7 days`,
      why: `That's more than your usual ${usual.toFixed(1)} a week. Sleep and protein matter more than ever this week.`,
      score: 30,
    });
  }

  return tips.sort((a, b) => b.score - a.score);
}
