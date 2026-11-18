import Link from "next/link";
import { cx } from "@/components/ui";

export type StripDay = {
  date: string;
  weekday: string; // "Tue"
  day: number;
  isToday: boolean;
  dots: string[]; // one color per thing due that day
  hasClasses: boolean;
};

/**
 * The next 7 days at a glance: a dot for each thing due, colored by class.
 * Busy days (3+) glow amber so you can see a heavy day coming. Tap a day to
 * open it in the calendar.
 */
export function WeekStrip({ days }: { days: StripDay[] }) {
  return (
    <nav aria-label="Next 7 days" className="-mx-1 grid grid-cols-7 gap-1.5 px-1">
      {days.map((d) => {
        const busy = d.dots.length >= 3;
        return (
          <Link
            key={d.date}
            href={`/calendar?view=week&date=${d.date}`}
            className={cx(
              "flex min-w-0 flex-col items-center gap-1 rounded-2xl border py-2 transition active:scale-95",
              d.isToday
                ? "border-accent/60 bg-accent/10 shadow-glow"
                : busy
                  ? "border-warn/40 bg-warn/5 shadow-glow-warn"
                  : "border-line bg-surface/70 hover:border-muted/50",
            )}
          >
            <span className={cx("text-[10px] font-semibold tracking-wider uppercase", d.isToday ? "text-accent" : "text-muted")}>{d.weekday}</span>
            <span className={cx("font-display text-base leading-none font-semibold", !d.hasClasses && !d.isToday && "text-faint")}>{d.day}</span>
            <span className="flex h-2 items-center gap-0.5">
              {d.dots.slice(0, 3).map((c, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}` }} />
              ))}
              {d.dots.length > 3 && <span className="text-[9px] leading-none text-warn">+</span>}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
