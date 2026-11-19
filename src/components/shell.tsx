"use client";

/**
 * The app frame: a bottom bar with a glowing center "+" on phones, and a
 * sidebar on laptops (docs/09-design-direction.md). The "+" opens quick add.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { cx } from "@/components/ui";
import { IconCalendar, IconClasses, IconGrades, IconGym, IconInbox, IconLife, IconMoney, IconWork, IconMic, IconPlus, IconSchool, IconSettings, IconSignOut, IconToday, IconTrash } from "@/components/icons";
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
 * Phone bottom bar: every area, with the glowing + in the middle:
 * Today · School · Work · + · Money · Life · Calendar. (Classes and Grades live inside School; Gym lives inside Life.)
 */
const TABS = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[4], NAV[6]];

/** Less-used places: sidebar on laptops; on phones they're linked from Today and School. */
const MORE = [
  { href: "/inbox", label: "Inbox", Icon: IconInbox },
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-32 md:px-8 md:pt-10 md:pb-12">
        {children}
      </main>

      <FocusOverlay />

      {/* Phone: bottom bar with the center "+" */}
      <nav
        className="fixed inset-x-2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex items-center justify-around gap-0.5 rounded-3xl border border-line bg-surface/90 px-1.5 py-2 shadow-card backdrop-blur-xl md:hidden"
        aria-label="Main"
      >
        {TABS.slice(0, 3).map((item) => (
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
        {TABS.slice(3).map((item) => (
          <TabLink key={item.href} {...item} active={isActive(item.href) || (item.href === "/life" && isActive("/gym"))} badge={badges[item.href]} />
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
      className={cx(
        "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium transition-all duration-300",
        active ? "bg-accent/10 text-accent" : "text-muted active:scale-95",
      )}
    >
      <Icon size={22} />
      {label}
      {badge ? (
        <span className="absolute -top-0.5 right-3">
          <Badge n={badge} />
        </span>
      ) : null}
      {active && <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-accent shadow-glow" />}
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
