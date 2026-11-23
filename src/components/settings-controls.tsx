"use client";

/** Interactive parts of Settings: create/revoke tokens, auto-save switches. */
import { playSound, setSoundsOn, soundsOn } from "@/lib/sound";
import { useState, useSyncExternalStore, useTransition } from "react";
import { createTokenAction, revokeTokenAction, setAutoSaveAction } from "@/app/(app)/settings/actions";
import { Button, cx, inputClass } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

export function CreateToken({ scope, defaultName }: { scope: "capture" | "mcp"; defaultName: string }) {
  const sheet = useTaskSheet();
  const [name, setName] = useState(defaultName);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  if (token) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-accent/50 bg-accent/5 p-3 shadow-glow">
        <p className="text-sm font-semibold">Your new token. Copy it now: it won&apos;t be shown again.</p>
        <code className="rounded-xl border border-line bg-bg p-2 font-mono text-xs break-all select-all">{token}</code>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(token);
              setCopied(true);
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setToken(null)}>
            Done
          </Button>
        </div>
        <p className="text-xs text-faint">Paste it only into your own Shortcut. Anyone with it can add items to your Inbox. You can revoke it below anytime.</p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await createTokenAction(name, scope);
          if (r.ok) setToken(r.token);
          else sheet.toast(r.error);
        });
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} className={cx(inputClass, "min-w-0 flex-1")} aria-label="Token name" />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create token"}
      </Button>
    </form>
  );
}

export function RevokeToken({ id }: { id: string }) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="danger"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await revokeTokenAction(id);
          sheet.toast(r.ok ? "Revoked. That token no longer works." : `Couldn't revoke: ${r.error}`);
        })
      }
      className="px-3 py-1 text-xs"
    >
      Revoke
    </Button>
  );
}

const AUTO_SAVE_OPTIONS = [
  { type: "homework", label: "Homework", hint: "e.g. “anatomy lab due friday”" },
  { type: "task", label: "To-dos", hint: "e.g. “pick up prescription tomorrow”" },
  { type: "expense", label: "Expenses", hint: "e.g. “spent 12 dollars on gas” → Money" },
];

export function AutoSaveSwitches({ enabled }: { enabled: string[] }) {
  const sheet = useTaskSheet();
  const [on, setOn] = useState(new Set(enabled));
  const [, startTransition] = useTransition();

  function toggle(type: string) {
    const next = new Set(on);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setOn(next);
    startTransition(async () => {
      const r = await setAutoSaveAction([...next]);
      if (!r.ok) sheet.toast(`Couldn't save: ${r.error}`);
    });
  }

  return (
    <ul className="flex flex-col gap-2">
      {AUTO_SAVE_OPTIONS.map((o) => (
        <li key={o.type}>
          <button
            type="button"
            role="switch"
            aria-checked={on.has(o.type)}
            onClick={() => toggle(o.type)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-raised/70 px-3 py-3 text-left"
          >
            <span className="flex-1">
              <span className="block font-medium">{o.label}</span>
              <span className="text-xs text-faint">{o.hint}</span>
            </span>
            <span className={cx("relative h-6 w-11 rounded-full transition", on.has(o.type) ? "bg-accent shadow-glow" : "bg-line")}>
              <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all", on.has(o.type) ? "left-[22px]" : "left-0.5")} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Tap sounds on or off (remembered on this device). */
export function SoundSwitch() {
  const on = useSyncExternalStore(subscribeSounds, soundsOn, () => true);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-silent
      onClick={() => {
        setSoundsOn(!on);
        soundListeners.forEach((l) => l());
        if (!on) playSound("saved");
      }}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-raised/70 px-3 py-3 text-left"
    >
      <span className="flex-1">
        <span className="block font-medium">Tap sounds</span>
        <span className="text-xs text-faint">Soft clicks, dings and chimes. Your phone&apos;s silent switch mutes them too.</span>
      </span>
      <span className={cx("relative h-6 w-11 rounded-full transition", on ? "bg-accent shadow-glow" : "bg-line")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

const soundListeners = new Set<() => void>();
function subscribeSounds(l: () => void) {
  soundListeners.add(l);
  return () => soundListeners.delete(l);
}
