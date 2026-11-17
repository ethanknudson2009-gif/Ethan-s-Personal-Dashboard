"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { Button, Field, Input } from "@/components/ui";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 p-6">
      <div>
        <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">◆ Dashboard</p>
        <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in once and this device stays signed in.</p>
      </div>
      <form action={formAction} className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/90 p-5 shadow-card">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="py-3 text-base">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
