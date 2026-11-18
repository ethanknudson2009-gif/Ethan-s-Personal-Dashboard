import { describe, expect, it } from "vitest";
import { jobTotals, washState } from "./jobs";

const TODAY = "2026-11-18";

describe("washState", () => {
  it("a booked job wins", () => {
    expect(washState({ repeatWeeks: 8 }, "2026-08-01", "2026-11-21", TODAY)).toEqual({ kind: "scheduled", on: "2026-11-21" });
  });

  it("due once the repeat interval has passed", () => {
    // Washed Sep 20 every 8 weeks → next Nov 15 → 3 days over.
    expect(washState({ repeatWeeks: 8 }, "2026-09-20", null, TODAY)).toEqual({ kind: "due", since: "2026-11-15", daysOver: 3 });
    expect(washState({ repeatWeeks: 8 }, "2026-10-20", null, TODAY)).toEqual({ kind: "ok", next: "2026-12-15", inDays: 27 });
  });

  it("new and one-time customers", () => {
    expect(washState({ repeatWeeks: 8 }, null, null, TODAY)).toEqual({ kind: "new" });
    expect(washState({ repeatWeeks: null }, "2026-09-20", null, TODAY)).toEqual({ kind: "one-time" });
  });
});

describe("jobTotals", () => {
  it("paid this month, owed, and booked", () => {
    const t = jobTotals(
      [
        { status: "paid", priceCents: 8000, date: "2026-11-02" },
        { status: "paid", priceCents: 6000, date: "2026-10-28" }, // last month
        { status: "done", priceCents: 5000, date: "2026-11-15" },
        { status: "scheduled", priceCents: 9000, date: "2026-11-22" },
      ],
      "2026-11",
    );
    expect(t).toEqual({ paidCents: 8000, owedCents: 5000, bookedCents: 9000, jobsDone: 1 });
  });
});
