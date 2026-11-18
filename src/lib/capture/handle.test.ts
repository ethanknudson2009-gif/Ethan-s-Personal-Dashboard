import { describe, expect, it } from "vitest";
import { fromLocal } from "@/lib/time";
import { generateToken, hashToken, bearerToken, tokenHint } from "@/lib/tokens";
import { handleCapture, type CaptureStore } from "./handle";

const PHX = "America/Phoenix";
const NOW = fromLocal("2026-11-17", { hour: 16, minute: 0 }, PHX);

/** An in-memory stand-in for the database. */
async function fakeStore(opts: { autoSaveTypes?: string[] } = {}) {
  const token = generateToken("capture");
  const hash = await hashToken(token);
  const tasks: unknown[] = [];
  const money: { amount_cents: number; category: string }[] = [];
  const inbox: { client_id: string | null; id: string }[] = [];
  let touched = 0;
  const store: CaptureStore = {
    async findTokenUser(h, scope) {
      return h === hash && scope === "capture" ? { userId: "u1", tokenId: "t1" } : null;
    },
    async touchToken() {
      touched++;
    },
    async loadContext() {
      return {
        timeZone: PHX,
        classes: [{ id: "speech", name: "Speech" }, { id: "anat", name: "Human Anatomy", shortNames: ["anatomy"] }],
        autoSaveTypes: opts.autoSaveTypes ?? [],
      };
    },
    async findByClientId(_u, clientId) {
      const hit = inbox.find((i) => i.client_id === clientId);
      return hit ? { id: hit.id, status: "pending" } : null;
    },
    async insertTask(_u, row) {
      tasks.push(row);
      return `task-${tasks.length}`;
    },
    async insertMoney(_u, row) {
      money.push(row);
      return `money-${money.length}`;
    },
    async insertInbox(_u, item) {
      const id = `inbox-${inbox.length + 1}`;
      inbox.push({ client_id: item.client_id, id });
      return id;
    },
  };
  return { token, store, tasks, money, inbox, touched: () => touched };
}

const call = (token: string | null, body: unknown, store: CaptureStore) =>
  handleCapture({ authorization: token ? `Bearer ${token}` : null, bodyText: typeof body === "string" ? body : JSON.stringify(body), now: NOW }, store);

describe("tokens", () => {
  it("look right and hash consistently", async () => {
    const t = generateToken("capture");
    expect(t).toMatch(/^dshc_[A-Za-z0-9_-]{43}$/);
    expect(await hashToken(t)).toBe(await hashToken(t));
    expect(await hashToken(t)).toHaveLength(64);
    expect(tokenHint(t)).toBe(t.slice(-4));
    expect(bearerToken(`Bearer ${t}`)).toBe(t);
    expect(bearerToken("Bearer nope")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe("POST /api/capture", () => {
  it("rejects missing, malformed and unknown tokens", async () => {
    const { store } = await fakeStore();
    expect((await call(null, { raw_text: "x" }, store)).status).toBe(401);
    expect((await call("dshc_" + "a".repeat(43), { raw_text: "x" }, store)).status).toBe(401);
    expect((await call(generateToken("mcp"), { raw_text: "x" }, store)).status).toBe(401); // wrong kind of token
  });

  it("rejects bad bodies", async () => {
    const { token, store } = await fakeStore();
    expect((await call(token, "not json", store)).status).toBe(400);
    expect((await call(token, {}, store)).status).toBe(400);
    expect((await call(token, { raw_text: "x".repeat(40_000) }, store)).status).toBe(413);
  });

  it("raw text only → Inbox, with a message for the Shortcut", async () => {
    const { token, store, inbox, touched } = await fakeStore({ autoSaveTypes: ["homework"] });
    const r = await call(token, { raw_text: "speech outline due thursday" }, store);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ok: true, status: "inbox", message: "📥 To review: Speech: Outline · Thu, Nov 19" });
    expect(inbox).toHaveLength(1);
    expect(touched()).toBe(1);
  });

  it("confident Claude JSON saves straight away only when allowed", async () => {
    const body = { raw_text: "anatomy lab due fri 3pm", type: "homework", title: "Lab", due_text: "fri 3pm", class_name: "anatomy", confidence: 0.95 };
    const off = await fakeStore();
    expect((await call(off.token, body, off.store)).body).toMatchObject({ status: "inbox" });
    const on = await fakeStore({ autoSaveTypes: ["homework"] });
    const r = await call(on.token, body, on.store);
    expect(r.body).toMatchObject({ status: "saved", message: "Saved ✓ Human Anatomy: Lab · Fri, Nov 20 · 3:00 PM" });
    expect(on.tasks).toHaveLength(1);
  });

  it("a confident expense saves straight to Money when allowed", async () => {
    const on = await fakeStore({ autoSaveTypes: ["expense"] });
    const r = await call(on.token, { raw_text: "spent 12 dollars on gas", type: "expense", title: "Gas", amount: 12, confidence: 0.95 }, on.store);
    expect(r.body).toMatchObject({ status: "saved", message: "Saved ✓ $12 · Gas" });
    expect(on.money[0]).toMatchObject({ amount_cents: -1200, category: "Gas" });
    expect(on.tasks).toHaveLength(0);
  });

  it("a retried send with the same client_id isn't saved twice", async () => {
    const { token, store, inbox } = await fakeStore();
    await call(token, { raw_text: "call mom", client_id: "abc" }, store);
    const again = await call(token, { raw_text: "call mom", client_id: "abc" }, store);
    expect(again.body).toMatchObject({ status: "duplicate" });
    expect(inbox).toHaveLength(1);
  });
});
