"use client";

/**
 * The app frame: a bottom bar with a glowing center "+" on phones, and a
 * sidebar on laptops (docs/09-design-direction.md). The "+" opens quick add.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { cx } from "@/components/ui";
import { IconCalendar, IconClasses, IconInbox, IconPlus, IconSchool, IconSignOut, IconToday, IconTrash } from "@/components/icons";
import { useTaskSheet } from "@/components/task-sheet";

const NAV = [
  { href: "/today", label: "Today", Icon: IconToday },
  { href: "/tasks", label: "School", Icon: IconSchool },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/classes", label: "Classes", Icon: IconClasses },
];

/** Less-used places: sidebar on laptops; on phones they're linked from Today and School. */
const MORE = [
  { href: "/inbox", label: "Inbox", Icon: IconInbox },
  { href: "/trash", label: "Trash", Icon: IconTrash },
];

export function AppShell({ children, badges }: { children: ReactNode; badges: Record<string, number> }) {
  const pathname = usePathname();
  const sheet = useTaskSheet();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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

      {/* Phone: bottom bar with the center "+" */}
      <nav
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex items-center justify-around rounded-3xl border border-line bg-surface/90 px-2 py-2 shadow-card backdrop-blur-xl md:hidden"
        aria-label="Main"
      >
        {NAV.slice(0, 2).map((item) => (
          <TabLink key={item.href} {...item} active={isActive(item.href)} badge={badges[item.href]} />
        ))}
        <button
          type="button"
          onClick={() => sheet.openNew()}
          aria-label="Add something"
          className="-mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-glow transition active:scale-90"
        >
          <IconPlus size={26} strokeWidth={2.4} />
        </button>
        {NAV.slice(2).map((item) => (
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
      className={cx("relative flex w-14 flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition", active ? "text-accent" : "text-muted")}
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
