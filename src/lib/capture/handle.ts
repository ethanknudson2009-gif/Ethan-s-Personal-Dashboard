/**
 * The core of POST /api/capture, kept separate from the web route and the
 * database so it can be tested with a fake store. See docs/07 §6.
 */
import { bearerToken, hashToken, scopeOf } from "@/lib/tokens";
import { formatLocalDate, formatTimeOfDay, taskDisplayTitle } from "@/lib/format";
import type { ClassRef } from "@/lib/parser";
import { captureSchema, decide, moneyRowFromDraft, SAVEABLE_TYPES, taskRowFromDraft, type InboxDraft } from "./index";
import { toLocalDate } from "@/lib/time";
import { splitItems } from "@/lib/parser/multi";

export const MAX_BODY_BYTES = 32 * 1024;

/** Everything the handler needs from the database, for one user at a time. */
export interface CaptureStore {
  findTokenUser(tokenHash: string, scope: "capture" | "mcp"): Promise<{ userId: string; tokenId: string } | null>;
  touchToken(tokenId: string): Promise<void>;
  loadContext(userId: string): Promise<{ timeZone: string; classes: ClassRef[]; autoSaveTypes: string[] }>;
  findByClientId(userId: string, clientId: string): Promise<{ id: string; status: string } | null>;
  insertTask(userId: string, row: ReturnType<typeof taskRowFromDraft>): Promise<string>;
  insertMoney(userId: string, row: ReturnType<typeof moneyRowFromDraft>): Promise<string>;
  insertInbox(
    userId: string,
    item: { raw_text: string; draft: InboxDraft; type: string; confidence: number; problems: string[]; source: string; client_id: string | null },
  ): Promise<string>;
}

export type CaptureResponse = {
  status: number;
  body: { ok: true; status: "saved" | "inbox" | "duplicate"; id: string; message: string } | { ok: false; error: string };
};

const fail = (status: number, error: string): CaptureResponse => ({ status, body: { ok: false, error } });

/** "Speech: Outline · Thu, Nov 19 · 3:00 PM" — what the Shortcut shows. */
export function describeDraft(draft: InboxDraft): string {
  if (draft.type === "expense") {
    const amount = draft.amount != null ? "$" + draft.amount.toFixed(2).replace(/\.00$/, "") + " · " : "";
    return amount + (draft.title || draft.category || "Expense");
  }
  const title = taskDisplayTitle(draft.title, draft.className);
  const when = draft.dueDate ? ` · ${formatLocalDate(draft.dueDate)}${draft.dueTime ? ` · ${formatTimeOfDay(draft.dueTime)}` : ""}` : "";
  return `${title}${when}`;
}

export async function handleCapture(
  req: { authorization: string | null; bodyText: string; now: Date },
  store: CaptureStore,
): Promise<CaptureResponse> {
  // 1. Who is this? (A private token from Settings, never a password.)
  const token = bearerToken(req.authorization);
  if (!token || scopeOf(token) !== "capture") return fail(401, "Missing or invalid token. Create one in Settings → Connections.");
  const owner = await store.findTokenUser(await hashToken(token), "capture");
  if (!owner) return fail(401, "That token isn't valid (it may have been revoked).");

  // 2. Is the request sensible?
  if (new TextEncoder().encode(req.bodyText).length > MAX_BODY_BYTES) return fail(413, "Too much text in one capture.");
  let json: unknown;
  try {
    json = JSON.parse(req.bodyText);
  } catch {
    return fail(400, "The body must be JSON, like {\"raw_text\": \"bio lab due friday\"}.");
  }
  const parsed = captureSchema.safeParse(json);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const input = parsed.data;

  await store.touchToken(owner.tokenId);

  // 3. Already received? (The Shortcut may retry on a bad connection.)
  if (input.client_id) {
    const existing = await store.findByClientId(owner.userId, input.client_id);
    if (existing) return { status: 200, body: { ok: true, status: "duplicate", id: existing.id, message: "Already saved ✓" } };
  }

  const ctx = await store.loadContext(owner.userId);

  // 4. A whole list said at once ("call Mike tomorrow, then buy milk, also…")
  //    becomes one item each. (Only when Claude didn't already pick one title.)
  if (!input.title && !input.type) {
    const { items } = splitItems(input.raw_text, { now: req.now, timeZone: ctx.timeZone, classes: ctx.classes, spoken: true, caseSource: input.raw_text });
    if (items.length >= 2) {
      const results: { id: string; saved: boolean; what: string }[] = [];
      for (const [i, text] of items.entries()) {
        // Only the first keeps the Shortcut's id, so a retry is still caught as a duplicate.
        const one = { ...input, raw_text: text, due_text: null, due: null, class_name: null, notes: null, client_id: input.client_id ? (i === 0 ? input.client_id : `${input.client_id}#${i + 1}`) : null };
        results.push(await saveOne(one, req.now, ctx, owner.userId, store));
      }
      const saved = results.filter((r) => r.saved).length;
      const review = results.length - saved;
      const message = [saved ? `Saved ${saved} ✓` : "", review ? `📥 ${review} to review` : ""].filter(Boolean).join(", ") + `: ${results.map((r) => r.what).join(" · ")}`;
      return { status: 201, body: { ok: true, status: saved ? "saved" : "inbox", id: results[0].id, message } };
    }
  }

  // 5. One thing: save straight away, or Inbox for review.
  const r = await saveOne(input, req.now, ctx, owner.userId, store);
  return { status: 201, body: { ok: true, status: r.saved ? "saved" : "inbox", id: r.id, message: r.saved ? `Saved ✓ ${r.what}` : `📥 To review: ${r.what}` } };
}

/** Decide on one item and store it: saved for real, or in the Inbox to review. */
async function saveOne(
  input: ReturnType<typeof captureSchema.parse>,
  now: Date,
  ctx: { timeZone: string; classes: ClassRef[]; autoSaveTypes: string[] },
  userId: string,
  store: CaptureStore,
): Promise<{ id: string; saved: boolean; what: string }> {
  const decision = decide(input, { now, ...ctx });
  const what = describeDraft(decision.draft);
  if (decision.autoSave && SAVEABLE_TYPES.includes(decision.draft.type)) {
    const id =
      decision.draft.type === "expense"
        ? await store.insertMoney(userId, moneyRowFromDraft(decision.draft, toLocalDate(now, ctx.timeZone)))
        : await store.insertTask(userId, taskRowFromDraft(decision.draft, ctx.timeZone, "shortcut"));
    return { id, saved: true, what };
  }
  const id = await store.insertInbox(userId, {
    raw_text: input.raw_text,
    draft: decision.draft,
    type: decision.draft.type,
    confidence: decision.confidence,
    problems: decision.problems,
    source: "shortcut",
    client_id: input.client_id ?? null,
  });
  return { id, saved: false, what };
}
