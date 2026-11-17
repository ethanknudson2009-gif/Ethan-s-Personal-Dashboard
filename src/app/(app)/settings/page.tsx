import { createClient } from "@/lib/supabase/server";
import { formatLocalDate } from "@/lib/format";
import { toLocalDate } from "@/lib/time";
import { loadSettings } from "@/lib/profile";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { AutoSaveSwitches, CreateToken, RevokeToken } from "@/components/settings-controls";
import { NotificationsCard } from "@/components/notifications-card";
import { signOut } from "@/app/login/actions";

/** Settings: connections for the iPhone Shortcut / Claude, and capture behavior. */
export default async function SettingsPage() {
  const supabase = await createClient();
  const [settings, { data: tokens }, { data: profile }] = await Promise.all([
    loadSettings(supabase),
    supabase.from("api_tokens").select("id, name, scope, token_hint, created_at, last_used_at").is("revoked_at", null).order("created_at"),
    supabase.from("profiles").select("auto_save_types, notify_morning, notify_evening").maybeSingle(),
  ]);
  const day = (iso: string | null) => (iso ? formatLocalDate(toLocalDate(new Date(iso), settings.timeZone)) : "never");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" />

      <div id="reminders">
        <Card title="Reminders">
          <NotificationsCard morning={profile?.notify_morning ?? "07:00"} evening={profile?.notify_evening ?? "20:00"} />
        </Card>
      </div>

      <Card title="Connections">
        <p className="mb-3 text-sm text-muted">
          A private token lets your iPhone&apos;s <b>Log It</b> Shortcut send things to your dashboard. Setup guide:{" "}
          <span className="text-ink">docs/setup/03-log-it-shortcut.md</span>.
        </p>
        {tokens && tokens.length > 0 ? (
          <ul className="mb-4 flex flex-col gap-2">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-line bg-raised/70 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="text-xs text-faint">
                    {t.scope === "capture" ? "Shortcut" : "Claude connector"} · ends in …{t.token_hint} · last used {day(t.last_used_at)}
                  </p>
                </div>
                <RevokeToken id={t.id} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-4">
            <EmptyState>No tokens yet. Create one for your iPhone below.</EmptyState>
          </div>
        )}
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted">For the iPhone Log It Shortcut</p>
            <CreateToken scope="capture" defaultName="iPhone Log It" />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted">For the Claude connector (guide: docs/setup/04-claude-connector.md)</p>
            <CreateToken scope="mcp" defaultName="Claude connector" />
          </div>
        </div>
      </Card>

      <Card title="Skip the Inbox">
        <p className="mb-3 text-sm text-muted">
          Normally everything you capture waits in the Inbox for a one-tap check. Turn these on to save straight away when Claude is confident and
          nothing looks off (your own words, without Claude, always go to the Inbox).
        </p>
        <AutoSaveSwitches enabled={profile?.auto_save_types ?? []} />
      </Card>

      <Card title="Account">
        <p className="mb-3 text-sm text-muted">Time zone: {settings.timeZone}</p>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </Card>
    </div>
  );
}
