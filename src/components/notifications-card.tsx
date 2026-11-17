"use client";

/**
 * "Turn on reminders": asks iPhone for notification permission and saves
 * this phone's subscription. On iPhone this only works inside the installed
 * app (Add to Home Screen), so we explain that when needed.
 */
import { useEffect, useState, useTransition } from "react";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
  setReminderTimesAction,
} from "@/app/(app)/settings/actions";
import { Button, cx, inputClass } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

type State = "checking" | "unsupported" | "install-first" | "off" | "on" | "blocked";

/** Converts the public key text into the bytes the browser wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function useReminderState() {
  const [state, setState] = useState<State>("checking");
  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !isInstalled() ? "install-first" : "unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);
  return [state, setState] as const;
}

export function NotificationsCard({ morning, evening }: { morning: string; evening: string }) {
  const sheet = useTaskSheet();
  const [state, setState] = useReminderState();
  const [pending, startTransition] = useTransition();
  const [times, setTimes] = useState({ morning: morning.slice(0, 5), evening: evening.slice(0, 5) });

  function turnOn() {
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
      });
      const r = await savePushSubscriptionAction(sub.toJSON(), isIos() ? "iPhone" : "Computer");
      if (r.ok) {
        setState("on");
        sheet.toast("Reminders on ✓");
      } else sheet.toast(`Couldn't turn on: ${r.error}`);
    });
  }

  function turnOff() {
    startTransition(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      sheet.toast("Reminders off on this device");
    });
  }

  function test() {
    startTransition(async () => {
      const r = await sendTestPushAction();
      sheet.toast(r.ok ? "Sent! Check your notifications." : (r.error ?? "Couldn't send"));
    });
  }

  function saveTimes() {
    startTransition(async () => {
      const r = await setReminderTimesAction(times.morning, times.evening);
      sheet.toast(r.ok ? "Reminder times saved ✓" : (r.error ?? "Couldn't save"));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {state === "checking" && <p className="text-sm text-muted">Checking this device…</p>}
      {state === "install-first" && (
        <div className="rounded-2xl border border-warn/40 bg-warn/10 p-3 text-sm">
          <p className="font-semibold text-warn">Install the app first</p>
          <p className="mt-1 text-muted">
            iPhone only allows notifications from the installed app: in Safari tap <b>Share</b> → <b>Add to Home Screen</b>, open the dashboard from its
            new icon, and come back here.
          </p>
        </div>
      )}
      {state === "unsupported" && <p className="text-sm text-muted">This browser can&apos;t receive notifications.</p>}
      {state === "blocked" && (
        <p className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-muted">
          Notifications are blocked. On iPhone: <b>Settings → Notifications → Dashboard</b> → turn on <b>Allow Notifications</b>.
        </p>
      )}
      {state === "off" && (
        <Button type="button" onClick={turnOn} disabled={pending} className="py-3 text-base">
          {pending ? "Asking…" : "🔔 Turn on reminders"}
        </Button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-ok/40 bg-ok/10 px-3 py-1.5 text-sm font-semibold text-ok">Reminders on ✓</span>
          <Button type="button" variant="secondary" onClick={test} disabled={pending}>
            Send me a test
          </Button>
          <Button type="button" variant="ghost" onClick={turnOff} disabled={pending}>
            Turn off
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Morning summary
          <input type="time" value={times.morning} onChange={(e) => setTimes({ ...times, morning: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Tomorrow preview
          <input type="time" value={times.evening} onChange={(e) => setTimes({ ...times, evening: e.target.value })} className={inputClass} />
        </label>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={saveTimes}
        disabled={pending || (times.morning === morning.slice(0, 5) && times.evening === evening.slice(0, 5))}
        className={cx("self-start")}
      >
        Save times
      </Button>
      <p className="text-xs text-faint">
        You&apos;ll get: a morning summary of what&apos;s due today and tomorrow, a heads-up in the evening for tomorrow, and a reminder an hour before
        anything with an exact time.
      </p>
    </div>
  );
}

/** Small nudge for the Today page when reminders aren't on yet. */
export function RemindersNudge() {
  const [state] = useReminderState();
  if (state !== "off" && state !== "install-first") return null;
  return (
    <a
      href="/settings#reminders"
      className="flex items-center gap-3 rounded-2xl border border-electric/40 bg-electric/10 px-4 py-3 text-sm transition hover:bg-electric/15"
    >
      <span className="text-lg">🔔</span>
      <span className="flex-1">
        <span className="block font-semibold">Get reminded before things are due</span>
        <span className="text-muted">{state === "install-first" ? "Add the app to your Home Screen, then turn on reminders." : "Tap to turn on reminders."}</span>
      </span>
    </a>
  );
}
