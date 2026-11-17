/**
 * The core of POST /api/capture, kept separate from the web route and the
 * database so it can be tested with a fake store. See docs/07 §6.
 */
import { bearerToken, hashToken, scopeOf } from "@/lib/tokens";
import { formatLocalDate, formatTimeOfDay, taskDisplayTitle } from "@/lib/format";
import type { ClassRef } from "@/lib/parser";
import { captureSchema, decide, SAVEABLE_TYPES, taskRowFromDraft, type InboxDraft } from "./index";

export const MAX_BODY_BYTES = 32 * 1024;

/** Everything the handler needs from the database, for one user at a time. */
export interface CaptureStore {
  findTokenUser(tokenHash: string, scope: "capture" | "mcp"): Promise<{ userId: string; tokenId: string } | null>;
  touchToken(tokenId: string): Promise<void>;
  loadContext(userId: string): Promise<{ timeZone: string; classes: ClassRef[]; autoSaveTypes: string[] }>;
  findByClientId(userId: string, clientId: string): Promise<{ id: string; status: string } | null>;
  insertTask(userId: string, row: ReturnType<typeof taskRowFromDraft>): Promise<string>;
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

  // 4. Decide: save straight away, or Inbox for review.
  const ctx = await store.loadContext(owner.userId);
  const decision = decide(input, { now: req.now, ...ctx });
  const what = describeDraft(decision.draft);

  if (decision.autoSave && SAVEABLE_TYPES.includes(decision.draft.type)) {
    const id = await store.insertTask(owner.userId, taskRowFromDraft(decision.draft, ctx.timeZone, "shortcut"));
    return { status: 201, body: { ok: true, status: "saved", id, message: `Saved ✓ ${what}` } };
  }

  const id = await store.insertInbox(owner.userId, {
    raw_text: input.raw_text,
    draft: decision.draft,
    type: decision.draft.type,
    confidence: decision.confidence,
    problems: decision.problems,
    source: "shortcut",
    client_id: input.client_id ?? null,
  });
  return { status: 201, body: { ok: true, status: "inbox", id, message: `📥 To review: ${what}` } };
}
