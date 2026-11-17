import { describe, expect, it } from "vitest";
import { monthGrid, monthTitle, safeDate, shiftMonth, weekDays, weekStart } from "./calendar";

describe("calendar", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-17")).toBe("2026-11-16"); // Tue → Mon
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // Mon stays
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sun → previous Mon
    expect(weekDays("2026-11-17")).toEqual([
      "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22",
    ]);
  });

  it("month grid is 6 whole weeks covering the month", () => {
    const grid = monthGrid("2026-11-17");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ date: "2026-10-26", inMonth: false }); // Nov 1, 2026 is a Sunday
    expect(grid.filter((d) => d.inMonth)).toHaveLength(30);
    expect(grid.find((d) => d.inMonth)?.date).toBe("2026-11-01");
  });

  it("titles and month arrows", () => {
    expect(monthTitle("2026-11-17")).toBe("November 2026");
    expect(shiftMonth("2026-11-17", 1)).toBe("2026-12-01");
    expect(shiftMonth("2026-12-05", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-31", -1)).toBe("2025-12-01");
  });

  it("only accepts real dates from the address bar", () => {
    expect(safeDate("2026-11-20", "2026-01-01")).toBe("2026-11-20");
    expect(safeDate("2026-02-30", "2026-01-01")).toBe("2026-01-01");
    expect(safeDate(undefined, "2026-01-01")).toBe("2026-01-01");
  });
});
