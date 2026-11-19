import { describe, expect, it } from "vitest";
import { fromLocal } from "@/lib/time";
import { captureSchema, decide, readDraft, taskRowFromDraft } from "./index";

const PHX = "America/Phoenix";
const classes = [
  { id: "speech", name: "Speech" },
  { id: "anat", name: "Human Anatomy", shortNames: ["anatomy"] },
  { id: "wh", name: "World History" },
  { id: "ch", name: "Church History" },
];
const ctx = {
  now: fromLocal("2026-11-17", { hour: 16, minute: 0 }, PHX), // Tue 4 PM
  timeZone: PHX,
  classes,
  autoSaveTypes: [] as string[],
};
const input = (o: Record<string, unknown>) => captureSchema.parse(o);

describe("decide: raw text only (Claude unavailable)", () => {
  it("parses it ourselves and always sends it to the Inbox", () => {
    const d = decide(input({ raw_text: "speech outline due thursday" }), { ...ctx, autoSaveTypes: ["homework"] });
    expect(d.draft).toMatchObject({ type: "homework", title: "Outline", classId: "speech", dueDate: "2026-11-19" });
    expect(d.autoSave).toBe(false);
  });
});

describe("decide: Claude's JSON", () => {
  const good = { raw_text: "anatomy lab report due friday", type: "homework", title: "Lab report", due_text: "friday", class_name: "anatomy", confidence: 0.95 };

  it("goes to the Inbox by default (nothing is auto-saved until you allow it)", () => {
    const d = decide(input(good), ctx);
    expect(d.draft).toMatchObject({ title: "Lab report", classId: "anat", dueDate: "2026-11-20" });
    expect(d.problems).toEqual([]);
    expect(d.autoSave).toBe(false);
  });

  it("auto-saves when that type is allowed, confident, and problem-free", () => {
    expect(decide(input(good), { ...ctx, autoSaveTypes: ["homework"] }).autoSave).toBe(true);
  });

  it("our parser decides the date; a disagreeing Claude date is flagged", () => {
    const d = decide(input({ ...good, due: "2026-11-21" }), { ...ctx, autoSaveTypes: ["homework"] });
    expect(d.draft.dueDate).toBe("2026-11-20");
    expect(d.problems.join(" ")).toMatch(/Claude said 2026-11-21/);
    expect(d.autoSave).toBe(false);
  });

  it("unknown class or ambiguous 'history' → asks", () => {
    const d = decide(input({ ...good, class_name: "chemistry" }), { ...ctx, autoSaveTypes: ["homework"] });
    expect(d.problems.join(" ")).toMatch(/chemistry/);
    expect(d.autoSave).toBe(false);
    const h = decide(input({ raw_text: "history essay due fri" }), ctx);
    expect(h.draft.classId).toBeNull();
    expect(h.problems.join(" ")).toMatch(/Which class/);
  });

  it("food, workouts, habits and notes wait in the Inbox for one tap", () => {
    const d = decide(input({ raw_text: "ate 2 eggs 140 calories", type: "food", confidence: 0.99 }), { ...ctx, autoSaveTypes: ["food"] });
    expect(d.draft).toMatchObject({ type: "food", title: "ate 2 eggs 140 calories" });
    expect(d.autoSave).toBe(false);
    expect(d.problems.join(" ")).not.toMatch(/built yet/);
  });

  it("expenses can be saved now (to Money)", () => {
    const d = decide(input({ raw_text: "spent $12 gas", type: "expense", amount: 12, confidence: 0.99 }), { ...ctx, autoSaveTypes: ["expense"] });
    expect(d).toMatchObject({ autoSave: true, draft: { type: "expense", amount: 12 } });
  });
});

describe("drafts", () => {
  it("turn into task rows (end of day when no time)", () => {
    const row = taskRowFromDraft(
      { type: "homework", title: "Outline", classId: "speech", className: "Speech", dueDate: "2026-11-19", dueTime: null, amount: null, category: null, notes: null },
      PHX,
      "shortcut",
    );
    expect(row).toMatchObject({ kind: "assignment", due_at: "2026-11-20T06:59:00.000Z", due_has_time: false, source: "shortcut" });
  });

  it("read back safely from storage", () => {
    expect(readDraft({ type: "task", title: "Call mom" })).toMatchObject({ type: "task", title: "Call mom", classId: null });
    expect(readDraft({ type: "weird" })).toBeNull();
    expect(readDraft(null)).toBeNull();
  });

  it("the schema rejects missing raw_text and bad dates", () => {
    expect(captureSchema.safeParse({}).success).toBe(false);
    expect(captureSchema.safeParse({ raw_text: "x", due: "next friday" }).success).toBe(false);
  });
});
