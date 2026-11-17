import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { daysUntil } from "@/lib/format";
import { AppShell } from "@/components/shell";
import { TaskSheetProvider } from "@/components/task-sheet";

/**
 * Wraps every page that needs a login: checks you're signed in, loads what
 * the shell needs (your classes for quick add, a count of things due), and
 * draws the bottom bar / sidebar.
 */
async function AuthedShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [settings, classRes, dueRes, inboxRes] = await Promise.all([
    loadSettings(supabase),
    supabase.from("classes").select("id, name, color, short_names").is("deleted_at", null).eq("archived", false),
    supabase.from("tasks").select("due_at").eq("status", "open").is("deleted_at", null).not("due_at", "is", null),
    supabase.from("inbox_items").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
  ]);

  const now = new Date();
  const needsAttention = (dueRes.data ?? []).filter((t) => daysUntil(new Date(t.due_at!), now, settings.timeZone) <= 0).length;
  const classes = (classRes.data ?? []).map((c) => ({ id: c.id, name: c.name, color: c.color, shortNames: c.short_names }));

  return (
    <TaskSheetProvider classes={classes} timeZone={settings.timeZone}>
      <AppShell badges={{ "/tasks": needsAttention, "/inbox": inboxRes.count ?? 0 }}>{children}</AppShell>
    </TaskSheetProvider>
  );
}

function ShellLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" aria-label="Loading" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellLoading />}>
      <AuthedShell>{children}</AuthedShell>
    </Suspense>
  );
}
