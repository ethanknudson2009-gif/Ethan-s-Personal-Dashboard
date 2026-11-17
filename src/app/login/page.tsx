"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, signInAction, signingIn] = useActionState(signIn, initialState);
  const [upState, signUpAction, signingUp] = useActionState(signUp, initialState);
  const creating = mode === "up";
  const state = creating ? upState : inState;
  const pending = creating ? signingUp : signingIn;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{creating ? "Create your account" : "Dashboard"}</h1>
      <form action={creating ? signUpAction : signInAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded border border-gray-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            autoComplete={creating ? "new-password" : "current-password"}
            minLength={creating ? 8 : undefined}
            required
            className="rounded border border-gray-300 px-3 py-2 text-base"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? "One moment…" : creating ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode(creating ? "in" : "up")}
        className="text-left text-xs text-gray-500 hover:underline"
      >
        {creating ? "Already have an account? Sign in" : "First time? Create an account"}
      </button>
    </main>
  );
}
