import { levelInfo, levelTitle } from "@/lib/xp";

/** "Lv 3 · Grinder" with a glowing bar toward the next level. */
export function LevelBar({ xp }: { xp: number }) {
  const { level, into, needed, progress } = levelInfo(xp);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 px-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-electric font-display text-sm font-bold text-accent-ink shadow-glow">
        {level}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate font-semibold">
            Level {level} · <span className="text-accent">{levelTitle(level)}</span>
          </span>
          <span className="shrink-0 text-faint tabular-nums">
            {into}/{needed} XP
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-electric"
            style={{ width: `${Math.max(3, progress * 100)}%`, boxShadow: "0 0 10px var(--color-accent)" }}
          />
        </div>
      </div>
    </div>
  );
}
