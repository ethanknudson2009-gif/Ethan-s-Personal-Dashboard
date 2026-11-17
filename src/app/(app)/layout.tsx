import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/tasks", label: "Tasks" },
  { href: "/classes", label: "Classes" },
];

/** Double-checks the login on the server (src/proxy.ts already redirects most visitors). */
async function RequireUser({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return children;
}

/** Wraps every page that needs a login. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="flex items-center gap-4 border-b border-gray-200 px-4 py-3">
        <nav className="flex flex-1 gap-4">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="font-medium hover:underline">
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button type="submit" className="text-sm text-gray-500 hover:underline">
            Sign out
          </button>
        </form>
      </header>
      <main className="flex-1 p-4">
        {/* Pages read your login cookie, so they load inside a Suspense boundary. */}
        <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
          <RequireUser>{children}</RequireUser>
        </Suspense>
      </main>
    </div>
  );
}
