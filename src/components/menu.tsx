"use client";

/**
 * The "everything else" menu on phones. The bottom bar only holds the four
 * main places (Home, Work, School, Gym); every other page lives behind the
 * menu button in the top-right corner of each page header.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  IconCalendar,
  IconClasses,
  IconGrades,
  IconInbox,
  IconLife,
  IconMoney,
  IconMore,
  IconSettings,
  IconStats,
  IconTrash,
} from "@/components/icons";

/** Joins class names (kept here so ui.tsx can import this file). */
const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

export const MENU_TILES = [
  { href: "/money", label: "Money", Icon: IconMoney },
  { href: "/life", label: "Life", Icon: IconLife },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/stats", label: "Stats", Icon: IconStats },
  { href: "/plan", label: "Plan my day", Icon: IconCalendar },
  { href: "/inbox", label: "Inbox", Icon: IconInbox },
  { href: "/classes", label: "Classes", Icon: IconClasses },
  { href: "/grades", label: "Grades", Icon: IconGrades },
  { href: "/settings", label: "Settings", Icon: IconSettings },
  { href: "/trash", label: "Trash", Icon: IconTrash },
];

type MenuState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  badges: Record<string, number>;
};
const MenuContext = createContext<MenuState | null>(null);

export function MenuProvider({
  badges,
  children,
}: {
  badges: Record<string, number>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the menu whenever the page changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  return (
    <MenuContext.Provider value={{ open, setOpen, badges }}>
      {children}
      {open && <MenuPanel />}
    </MenuContext.Provider>
  );
}

/** The round button shown in every page header (phones only). */
export function MenuButton() {
  const menu = useContext(MenuContext);
  if (!menu) return null;
  const count = menu.badges["/inbox"] ?? 0;
  return (
    <button
      type="button"
      onClick={() => menu.setOpen(!menu.open)}
      aria-expanded={menu.open}
      aria-label="Everything else"
      className={cx(
        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition md:hidden",
        menu.open
          ? "border-accent/60 bg-accent/15 text-accent shadow-glow"
          : "border-line bg-surface/85 text-muted",
      )}
    >
      <IconMore size={22} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

function MenuPanel() {
  const menu = useContext(MenuContext)!;
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  return (
    <div
      className="fixed inset-0 z-40 md:hidden"
      role="dialog"
      aria-label="Everything else"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => menu.setOpen(false)}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="sheet-down absolute inset-x-2 top-[calc(max(1.25rem,env(safe-area-inset-top))+3.25rem)] rounded-3xl border border-line bg-surface p-3 shadow-card">
        <ul className="grid grid-cols-3 gap-2">
          {MENU_TILES.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => menu.setOpen(false)}
                className={cx(
                  "relative flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-center text-xs font-semibold",
                  isActive(href)
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : "border-line bg-raised/70 text-ink",
                )}
              >
                <Icon size={28} />
                {label}
                {menu.badges[href] ? (
                  <span className="absolute top-1.5 right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {menu.badges[href] > 9 ? "9+" : menu.badges[href]}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
