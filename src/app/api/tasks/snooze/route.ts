import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { snoozeUntil } from "@/lib/notify";
import { DEFAULT_TIME_ZONE } from "@/lib/time";

/**
 * POST /api/tasks/snooze { id, preset } — used by the "Snooze 1 hr" button
 * on a notification (phones and laptops that show notification buttons).
 * The service worker sends your normal login cookie, so this only ever
 * touches your own tasks (Row Level Security).
 */
const body = z.object({
  id: z.string().uuid(),
  preset: z.enum(["15m", "1h", "3h", "tonight", "tomorrow"]).default("1h"),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "bad request" }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ ok: false }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("timezone, notify_morning").maybeSingle();
  const morning = profile?.notify_morning ?? "07:00";
  const until = snoozeUntil(parsed.data.preset, new Date(), profile?.timezone || DEFAULT_TIME_ZONE, {
    hour: Number(morning.slice(0, 2)),
    minute: Number(morning.slice(3, 5)),
  });
  const { error } = await supabase.from("tasks").update({ snoozed_until: until.toISOString() }).eq("id", parsed.data.id);
  if (error) return Response.json({ ok: false }, { status: 500 });
  return Response.json({ ok: true, until: until.toISOString() });
}
