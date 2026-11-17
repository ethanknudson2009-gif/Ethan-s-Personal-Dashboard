import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { planNotifications } from "@/lib/notify";
import { DEFAULT_TIME_ZONE, toLocalDate } from "@/lib/time";

/**
 * POST /api/cron/tick — called every 15 minutes by Supabase's scheduler
 * (pg_cron + pg_net, migration 0005) with the shared CRON_SECRET. Works out
 * which reminders each user should get now and sends them to their phone.
 */
function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  const given = /^Bearer (.+)$/.exec(header ?? "")?.[1];
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const time = (t: string) => ({ hour: Number(t.slice(0, 2)), minute: Number(t.slice(3, 5)) });

export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const db = createAdminClient();
  const now = new Date();

  const { data: subs, error: subsError } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
  if (subsError) {
    console.error("tick: database error", subsError.message);
    return Response.json({ ok: false, error: "database" }, { status: 500 });
  }
  const byUser = new Map<string, NonNullable<typeof subs>>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  let sent = 0;
  for (const [userId, devices] of byUser) {
    const [{ data: profile }, { data: tasks }, { data: classes }, { count: inboxCount }] = await Promise.all([
      db.from("profiles").select("timezone, notify_morning, notify_evening").eq("id", userId).maybeSingle(),
      db
        .from("tasks")
        .select("id, title, class_id, due_at, due_has_time")
        .eq("user_id", userId)
        .eq("status", "open")
        .is("deleted_at", null)
        .not("due_at", "is", null),
      db.from("classes").select("id, name").eq("user_id", userId),
      db.from("inbox_items").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending").is("deleted_at", null),
    ]);
    const timeZone = profile?.timezone || DEFAULT_TIME_ZONE;
    const today = toLocalDate(now, timeZone);
    const { data: log } = await db.from("notification_log").select("kind").eq("user_id", userId).eq("local_date", today);
    const className = new Map((classes ?? []).map((c) => [c.id, c.name]));

    const plan = planNotifications({
      now,
      timeZone,
      tasks: (tasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        className: t.class_id ? (className.get(t.class_id) ?? null) : null,
        dueAt: new Date(t.due_at!),
        dueHasTime: t.due_has_time,
      })),
      inboxCount: inboxCount ?? 0,
      alreadySent: new Set((log ?? []).map((l) => l.kind)),
      morningAt: time(profile?.notify_morning ?? "07:00"),
      eveningAt: time(profile?.notify_evening ?? "20:00"),
    });

    for (const n of plan) {
      // Record first: if two ticks overlap, the unique rule lets only one send.
      const { error } = await db.from("notification_log").insert({ user_id: userId, kind: n.kind, local_date: today });
      if (error) continue;
      for (const d of devices) {
        const result = await sendPush(d, n);
        if (result === "sent") {
          sent++;
          await db.from("push_subscriptions").update({ last_success_at: now.toISOString() }).eq("id", d.id);
        } else if (result === "gone") {
          await db.from("push_subscriptions").delete().eq("id", d.id);
        }
      }
    }
  }
  return Response.json({ ok: true, users: byUser.size, sent });
}
