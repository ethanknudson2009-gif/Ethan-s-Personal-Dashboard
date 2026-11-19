"use client";

/** The design gallery: 20 color themes (tap to apply) and 20 layout ideas (tap ♥ to like). */
import { useState, useTransition } from "react";
import { saveThemeAction, toggleLayoutLikeAction } from "@/app/(app)/gallery/actions";
import { THEMES, themeVars, type Theme } from "@/lib/themes";
import { LAYOUTS, type Block, type LayoutIdea } from "@/lib/layouts";
import { cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

/** Swap the colors on the page right away (the server keeps them for next time). */
function applyLive(t: Theme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v);
  root.style.colorScheme = t.light ? "light" : "dark";
}

function ThemeCard({ t, active, onPick }: { t: Theme; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cx("group flex flex-col gap-2 rounded-2xl border p-2 text-left transition active:scale-[0.97]", active ? "border-accent shadow-glow" : "border-line")}
      style={{ backgroundColor: t.surface }}
    >
      {/* A tiny screen in this theme's own colors */}
      <div className="flex aspect-[4/3] flex-col gap-1.5 overflow-hidden rounded-xl p-2" style={{ backgroundColor: t.bg }}>
        <div className="flex items-center gap-1.5 rounded-lg p-1.5" style={{ backgroundColor: t.surface, boxShadow: `0 0 0 1px ${t.accent}66, 0 0 14px -4px ${t.accent}` }}>
          <span className="h-5 w-5 shrink-0 rounded-full border-2" style={{ borderColor: t.accent }} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: t.ink }} />
            <span className="h-1 w-1/2 rounded-full" style={{ backgroundColor: t.muted }} />
          </span>
        </div>
        {[0.9, 0.7].map((w) => (
          <div key={w} className="flex items-center gap-1.5 rounded-md px-1.5 py-1" style={{ backgroundColor: t.raised, border: `1px solid ${t.line}` }}>
            <span className="h-2 w-2 rounded-full border" style={{ borderColor: t.muted }} />
            <span className="h-1 rounded-full" style={{ width: `${w * 70}%`, backgroundColor: t.muted }} />
          </div>
        ))}
        <div className="mt-auto flex gap-1">
          <span className="h-2.5 flex-1 rounded-full" style={{ backgroundColor: t.accent }} />
          <span className="h-2.5 w-6 rounded-full" style={{ backgroundColor: t.electric }} />
        </div>
      </div>
      <div className="px-1">
        <p className="text-sm font-semibold" style={{ color: t.ink }}>
          {active ? "✓ " : ""}
          {t.name}
        </p>
        <p className="text-[11px] leading-snug" style={{ color: t.muted }}>
          {t.vibe}
        </p>
      </div>
    </button>
  );
}

/** One block of a layout sketch, drawn small with the current theme. */
function Sketch({ b, cards }: { b: Block; cards: LayoutIdea["cards"] }) {
  const card = cx(
    "rounded-md",
    cards === "glass" && "bg-surface/80 border border-line",
    cards === "solid" && "bg-raised",
    cards === "outline" && "border border-muted/50",
    cards === "neon" && "bg-surface border border-accent/70 shadow-[0_0_8px_-2px_var(--color-accent)]",
  );
  const line = (w: string, c = "bg-muted/60") => <span className={cx("block h-1 rounded-full", c)} style={{ width: w }} />;
  switch (b) {
    case "greet":
      return (
        <div className="flex flex-col gap-0.5 py-0.5">
          {line("40%", "bg-accent")}
          {line("65%", "bg-ink/80")}
        </div>
      );
    case "hero-ring":
      return (
        <div className={cx(card, "flex items-center gap-1.5 p-1.5")}>
          <span className="flex flex-1 flex-col gap-1">
            {line("80%", "bg-ink/80")}
            {line("50%")}
          </span>
          <span className="h-5 w-5 rounded-full border-2 border-accent" />
        </div>
      );
    case "stats3":
      return (
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cx(card, "flex flex-col gap-0.5 p-1")}>
              <span className="h-2 w-3/4 rounded-sm bg-ink/80" />
              {line("50%")}
            </div>
          ))}
        </div>
      );
    case "list":
    case "list-compact":
      return (
        <div className="flex flex-col gap-0.5">
          {(b === "list" ? [85, 70, 60] : [80, 65, 75, 55]).map((w, i) => (
            <div key={i} className={cx(card, "flex items-center gap-1", b === "list" ? "p-1" : "px-1 py-0.5")}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-accent" />
              {line(`${w}%`)}
            </div>
          ))}
        </div>
      );
    case "grid2":
      return (
        <div className="grid grid-cols-2 gap-1">
          {["bg-accent", "bg-warn", "bg-ok", "bg-electric"].map((c) => (
            <div key={c} className={cx(card, "flex h-6 flex-col justify-end gap-0.5 p-1")}>
              {line("40%", c)}
              {line("70%", "bg-ink/70")}
            </div>
          ))}
        </div>
      );
    case "grid3":
      return (
        <div className="grid grid-cols-3 gap-1">
          {["bg-accent", "bg-warn", "bg-ok"].map((c) => (
            <div key={c} className={cx(card, "flex h-5 items-end p-1")}>
              {line("60%", c)}
            </div>
          ))}
        </div>
      );
    case "chips":
      return (
        <div className="flex gap-0.5">
          {[30, 22, 26, 18].map((w, i) => (
            <span key={i} className={cx("h-2.5 rounded-full", i === 0 ? "bg-accent" : "bg-raised border border-line")} style={{ width: `${w}%` }} />
          ))}
        </div>
      );
    case "timeline":
      return (
        <div className="flex flex-col gap-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="w-3 text-[5px] text-faint">{8 + i * 2}</span>
              <div className={cx(card, "flex-1 p-1", i === 1 && "border-l-2 border-l-accent")}>{line(`${70 - i * 10}%`)}</div>
            </div>
          ))}
        </div>
      );
    case "week":
      return (
        <div className="flex justify-between gap-0.5">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} className={cx("h-4 flex-1 rounded-md", i === 2 ? "bg-accent/80" : "bg-raised border border-line")} />
          ))}
        </div>
      );
    case "kanban":
      return (
        <div className="grid grid-cols-3 gap-1">
          {[3, 2, 1].map((n, c) => (
            <div key={c} className="flex flex-col gap-0.5 rounded-md bg-raised/50 p-0.5">
              {line("60%", c === 2 ? "bg-ok" : "bg-accent")}
              {Array.from({ length: n }, (_, i) => (
                <div key={i} className={cx(card, "h-3")} />
              ))}
            </div>
          ))}
        </div>
      );
    case "big-number":
      return (
        <div className="flex items-end gap-1 py-0.5">
          <span className="h-5 w-10 rounded-sm bg-ink/90" />
          {line("30%", "bg-accent")}
        </div>
      );
    case "carousel":
      return (
        <div className="flex gap-1 overflow-hidden">
          {["bg-accent", "bg-warn", "bg-ok"].map((c) => (
            <div key={c} className={cx(card, "flex h-8 w-[45%] shrink-0 flex-col justify-end gap-0.5 p-1")}>
              {line("50%", c)}
              {line("80%", "bg-ink/70")}
            </div>
          ))}
        </div>
      );
    case "focus":
      return (
        <div className={cx(card, "flex h-12 flex-col justify-center gap-1 border-accent/60 p-1.5")}>
          {line("30%", "bg-accent")}
          {line("85%", "bg-ink/90")}
          {line("60%")}
        </div>
      );
    case "bars":
      return (
        <div className="flex flex-col gap-0.5">
          {[80, 55, 35].map((w, i) => (
            <span key={i} className="block h-1.5 rounded-full bg-raised">
              <span className={cx("block h-full rounded-full", ["bg-accent", "bg-warn", "bg-ok"][i])} style={{ width: `${w}%` }} />
            </span>
          ))}
        </div>
      );
    case "month":
      return (
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className={cx("h-2 rounded-[2px]", i === 17 ? "bg-accent" : i % 5 === 0 ? "bg-electric/50" : "bg-raised")} />
          ))}
        </div>
      );
    case "search":
      return (
        <div className={cx(card, "flex items-center gap-1 rounded-full px-1.5 py-1")}>
          <span className="h-2 w-2 rounded-full bg-accent" />
          {line("55%")}
        </div>
      );
    case "feed":
      return (
        <div className={cx(card, "flex flex-col gap-1 p-1")}>
          <span className="h-4 rounded-sm bg-gradient-to-r from-accent/50 to-electric/50" />
          {line("75%", "bg-ink/80")}
          {line("45%")}
        </div>
      );
  }
}

function LayoutCard({ l, liked, onLike }: { l: LayoutIdea; liked: boolean; onLike: () => void }) {
  return (
    <div className={cx("flex flex-col gap-2 rounded-2xl border p-2", liked ? "border-accent shadow-glow" : "border-line bg-surface/60")}>
      {/* The phone */}
      <div className="relative mx-auto flex aspect-[9/16] w-full max-w-[150px] gap-1 overflow-hidden rounded-[14px] border-2 border-line bg-bg p-1.5">
        {l.nav === "rail" && (
          <div className="flex w-2.5 shrink-0 flex-col items-center gap-1 rounded-md bg-surface py-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cx("h-1.5 w-1.5 rounded-sm", i === 0 ? "bg-accent" : "bg-muted/50")} />
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {l.nav === "top" && (
            <div className="flex gap-0.5 border-b border-line pb-0.5">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cx("h-1.5 flex-1 rounded-full", i === 0 ? "bg-accent" : "bg-raised")} />
              ))}
            </div>
          )}
          {l.blocks.map((b, i) => (
            <Sketch key={i} b={b} cards={l.cards} />
          ))}
        </div>
        {l.nav === "bottom" && (
          <div className="absolute inset-x-1 bottom-1 flex items-center justify-around rounded-lg border border-line bg-surface/95 py-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={cx("rounded-full", i === 2 ? "h-3 w-3 bg-accent" : "h-1.5 w-1.5 bg-muted/60")} />
            ))}
          </div>
        )}
        {l.nav === "pill" && <div className="absolute bottom-1.5 left-1/2 h-3 w-16 -translate-x-1/2 rounded-full border border-line bg-surface/95" />}
        {l.nav === "dock" && (
          <div className="absolute inset-x-3 bottom-1 flex justify-center gap-1 rounded-xl bg-raised/95 p-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cx("h-3 w-3 rounded-md", i === 0 ? "bg-accent" : "bg-muted/40")} />
            ))}
          </div>
        )}
        {l.nav === "fab" && <span className="absolute right-1.5 bottom-1.5 h-4 w-4 rounded-full bg-accent shadow-glow" />}
      </div>
      <div className="flex items-start gap-1 px-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{l.name}</p>
          <p className="text-[11px] leading-snug text-muted">{l.idea}</p>
        </div>
        <button type="button" onClick={onLike} aria-label={liked ? `Unlike ${l.name}` : `Like ${l.name}`} className={cx("text-lg transition active:scale-125", liked ? "text-danger" : "text-faint")}>
          {liked ? "♥" : "♡"}
        </button>
      </div>
    </div>
  );
}

export function Gallery({ theme, liked }: { theme: string; liked: string[] }) {
  const sheet = useTaskSheet();
  const [tab, setTab] = useState<"colors" | "layouts">("colors");
  const [current, setCurrent] = useState(theme);
  const [likes, setLikes] = useState<string[]>(liked);
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex self-start rounded-xl border border-line bg-surface p-1">
        {(["colors", "layouts"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cx("rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition", tab === t ? "bg-accent/15 text-accent shadow-glow" : "text-muted hover:text-ink")}
          >
            {t === "colors" ? `🎨 ${THEMES.length} colors` : `📱 ${LAYOUTS.length} layouts`}
          </button>
        ))}
      </div>

      {tab === "colors" ? (
        <>
          <p className="text-sm text-muted">Tap one: the whole app changes right away, on every device you use.</p>
          <div className="rows grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEMES.map((t) => (
              <ThemeCard
                key={t.id}
                t={t}
                active={current === t.id}
                onPick={() => {
                  applyLive(t);
                  setCurrent(t.id);
                  startTransition(async () => {
                    const r = await saveThemeAction(t.id);
                    sheet.toast(r.ok ? `${t.name} ✓` : r.error);
                  });
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            Ideas for how the home screen could be arranged. Tap ♥ on the ones you like ({likes.length} liked). Your favorites get built next.
          </p>
          <div className="rows grid grid-cols-2 gap-3 sm:grid-cols-3">
            {LAYOUTS.map((l) => (
              <LayoutCard
                key={l.id}
                l={l}
                liked={likes.includes(l.id)}
                onLike={() => {
                  setLikes((x) => (x.includes(l.id) ? x.filter((y) => y !== l.id) : [...x, l.id]));
                  startTransition(async () => {
                    const r = await toggleLayoutLikeAction(l.id);
                    if (!r.ok) sheet.toast(r.error);
                  });
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
