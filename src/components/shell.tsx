"use client";

/**
 * The app frame: a bottom bar with a glowing center "+" on phones, and a
 * sidebar on laptops (docs/09-design-direction.md). The "+" opens quick add.
 */
import { playSound } from "@/lib/sound";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { cx } from "@/components/ui";
import { IconCalendar, IconClasses, IconGrades, IconGym, IconInbox, IconPalette, IconLife, IconMoney, IconWork, IconMic, IconPlus, IconSchool, IconSettings, IconSignOut, IconToday, IconTrash } from "@/components/icons";
import { useTaskSheet } from "@/components/task-sheet";
import { FocusOverlay } from "@/components/focus-overlay";

/** Laptop sidebar. */
const NAV = [
  { href: "/today", label: "Today", Icon: IconToday },
  { href: "/tasks", label: "School", Icon: IconSchool },
  { href: "/work", label: "Work", Icon: IconWork },
  { href: "/money", label: "Money", Icon: IconMoney },
  { href: "/life", label: "Life", Icon: IconLife },
  { href: "/gym", label: "Gym", Icon: IconGym },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/classes", label: "Classes", Icon: IconClasses },
  { href: "/grades", label: "Grades", Icon: IconGrades },
];

/**
 * Phone bottom bar: every area, with the glowing + near the middle:
 * Today · School · Work · Money · + · Gym · Life · Calendar. (Classes and Grades live inside School.)
 */
const TABS = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[5], NAV[4], NAV[6]];
/** How many tabs sit left of the "+". */
const LEFT = 4;

/** Less-used places: sidebar on laptops; on phones they're linked from Today and School. */
const MORE = [
  { href: "/plan", label: "Plan my day", Icon: IconCalendar },
  { href: "/inbox", label: "Inbox", Icon: IconInbox },
  { href: "/gallery", label: "Design gallery", Icon: IconPalette },
  { href: "/trash", label: "Trash", Icon: IconTrash },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

export function AppShell({ children, badges }: { children: ReactNode; badges: Record<string, number> }) {
  const pathname = usePathname();
  const sheet = useTaskSheet();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // When you come back to the app (e.g. reopen it on your phone), fetch fresh
  // data so it never shows yesterday's list. At most every 20 seconds.
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 20_000) {
        last = Date.now();
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);

  // Opening the app at /today?talk=1 (or ?add=1) jumps straight into quick add.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("talk") || params.has("add")) {
      if (params.has("talk")) sheet.openVoice();
      else sheet.openNew();
      params.delete("talk");
      params.delete("add");
      const q = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
  }, [sheet]);

  // Thumb swipe left/right on a page moves to the next/previous tab
  // (Today ⇄ School ⇄ Work ⇄ Money ⇄ Gym ⇄ Life ⇄ Calendar). Things with their own
  // sideways gestures (task rows, scrolling chip rows, inputs) are left alone.
  const tabIndex = TABS.findIndex(
    (t) => isActive(t.href) || (t.href === "/tasks" && (isActive("/classes") || isActive("/grades"))),
  );
  // A page change needs a deliberate swipe: your thumb has to start moving sideways
  // (not up/down while scrolling), go about a third of the screen, and not dawdle.
  const swipeStart = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | null } | null>(null);
  const [slide, setSlide] = useState<{ dir: "left" | "right"; path: string } | null>(null);
  const swipeHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const el = e.target as HTMLElement;
      const edge = touch.clientX < 24 || touch.clientX > window.innerWidth - 24;
      if (e.touches.length > 1 || edge || el.closest("[data-own-swipe], input, textarea, select, [contenteditable], .overflow-x-auto")) {
        swipeStart.current = null;
        return;
      }
      swipeStart.current = { x: touch.clientX, y: touch.clientY, t: Date.now(), axis: null };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const start = swipeStart.current;
      if (!start || start.axis) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      // The first clear direction wins: a scroll that drifts sideways never turns the page.
      if (dy > 10 && dy >= dx) start.axis = "y";
      else if (dx > 16 && dx > dy * 1.5) start.axis = "x";
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start || tabIndex < 0) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const far = Math.max(120, window.innerWidth * 0.33);
      if (start.axis !== "x" || Math.abs(dx) < far || Math.abs(dx) < Math.abs(dy) * 3 || Date.now() - start.t > 600) return;
      const next = tabIndex + (dx < 0 ? 1 : -1);
      if (next < 0 || next >= TABS.length) return;
      navigator.vibrate?.(8);
      playSound("swipe");
      setSlide({ dir: dx < 0 ? "left" : "right", path: TABS[next].href });
      router.push(TABS[next].href);
    },
  };

  // The center "+": tap to type, press and hold to talk.
  const holdTimer = useRef<number | null>(null);
  const held = useRef(false);
  const plusHandlers = {
    onPointerDown: () => {
      held.current = false;
      holdTimer.current = window.setTimeout(() => {
        held.current = true;
        navigator.vibrate?.(15);
        sheet.openVoice();
      }, 450);
    },
    onPointerUp: () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      if (!held.current) sheet.openNew();
    },
    onPointerLeave: () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return (
    <div className="flex min-h-dvh w-full">
      {/* Laptop: sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface/60 p-4 backdrop-blur md:flex">
        <div className="mb-8 px-2 font-display text-lg font-semibold tracking-tight">
          <span className="text-accent">◆</span> Dashboard
        </div>
        <button
          type="button"
          onClick={() => sheet.openNew()}
          className="mb-6 flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-ink shadow-glow transition hover:brightness-110 active:scale-[0.98]"
        >
          <IconPlus size={18} /> Add
        </button>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive(href) ? "bg-accent/10 text-ink shadow-[inset_2px_0_0_var(--color-accent)]" : "text-muted hover:bg-raised hover:text-ink",
              )}
            >
              <Icon size={20} className={isActive(href) ? "text-accent" : ""} />
              <span className="flex-1">{label}</span>
              {badges[href] ? <Badge n={badges[href]} /> : null}
            </Link>
          ))}
        </nav>
        <nav className="mb-2 flex flex-col gap-1 border-t border-line pt-3">
          {MORE.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                isActive(href) ? "bg-accent/10 text-ink" : "text-muted hover:bg-raised hover:text-ink",
              )}
            >
              <Icon size={18} className={isActive(href) ? "text-accent" : ""} />
              <span className="flex-1">{label}</span>
              {badges[href] ? <Badge n={badges[href]} /> : null}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-faint hover:text-ink">
            <IconSignOut size={18} /> Sign out
          </button>
        </form>
      </aside>

      {/* Page */}
      <main
        key={pathname}
        {...swipeHandlers}
        className={cx(
          "mx-auto w-full max-w-3xl flex-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-32 md:px-8 md:pt-10 md:pb-12",
          slide?.path === pathname && (slide.dir === "left" ? "slide-from-right" : "slide-from-left"),
        )}
      >
        {children}
      </main>

      <FocusOverlay />

      {/* Phone: bottom bar with the center "+" */}
      <nav
        className="fixed inset-x-2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex items-center justify-around gap-0.5 rounded-[1.75rem] border border-line bg-surface/90 px-1 py-1.5 shadow-card backdrop-blur-xl md:hidden"
        aria-label="Main"
      >
        {TABS.slice(0, LEFT).map((item) => (
          <TabLink key={item.href} {...item} active={isActive(item.href) || (item.href === "/tasks" && (isActive("/classes") || isActive("/grades")))} badge={badges[item.href]} />
        ))}
        <button
          type="button"
          {...plusHandlers}
          aria-label="Add something (hold to talk)"
          className="plus-orb relative -mt-8 flex h-14 w-14 shrink-0 touch-none items-center justify-center rounded-full bg-accent text-accent-ink shadow-glow transition select-none active:scale-90"
        >
          <IconPlus size={26} strokeWidth={2.4} />
          <span className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-electric text-white">
            <IconMic size={11} strokeWidth={2.4} />
          </span>
        </button>
        {TABS.slice(LEFT).map((item) => (
          <TabLink key={item.href} {...item} active={isActive(item.href)} badge={badges[item.href]} />
        ))}
      </nav>
    </div>
  );
}

function TabLink({
  href,
  label,
  Icon,
  active,
  badge,
}: (typeof NAV)[number] & { active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-2xl transition-all duration-300",
        active ? "text-accent" : "text-muted active:scale-90",
      )}
    >
      <span
        className={cx(
          "flex h-9 w-10 items-center justify-center rounded-xl transition-all duration-300",
          active && "-translate-y-1 bg-accent/15 shadow-glow",
        )}
      >
        <Icon size={23} strokeWidth={active ? 2.1 : 1.8} />
      </span>
      <span
        className={cx(
          "absolute bottom-0 text-[10px] leading-none font-semibold tracking-wide transition-all duration-300",
          active ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        )}
      >
        {label}
      </span>
      {badge ? (
        <span className="absolute top-0 right-[calc(50%-1.4rem)]">
          <Badge n={badge} />
        </span>
      ) : null}
    </Link>
  );
}

/** Count of things that need attention (overdue + due today). */
export function Badge({ n }: { n: number }) {
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-glow-danger">
      {n > 9 ? "9+" : n}
    </span>
  );
}
