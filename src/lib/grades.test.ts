import { describe, expect, it } from "vitest";
import { average, formatPercent, letter, neededFor, type Category, type Grade } from "./grades";

const cats: Category[] = [
  { id: "tests", weight: 50 },
  { id: "hw", weight: 30 },
  { id: "part", weight: 20 },
];

describe("average", () => {
  it("is null with nothing graded", () => {
    expect(average(cats, [])).toBeNull();
  });

  it("weights categories, scaling up when some are still empty", () => {
    const grades: Grade[] = [
      { categoryId: "tests", earned: 80, possible: 100 },
      { categoryId: "hw", earned: 50, possible: 50 },
    ];
    // (0.8*50 + 1.0*30) / 80 = 87.5%
    expect(average(cats, grades)).toBeCloseTo(87.5);
  });

  it("averages by points inside a category", () => {
    const grades: Grade[] = [
      { categoryId: "tests", earned: 45, possible: 50 },
      { categoryId: "tests", earned: 70, possible: 100 },
    ];
    expect(average(cats, grades)).toBeCloseTo((115 / 150) * 100);
  });

  it("no categories → total points", () => {
    expect(average([], [{ categoryId: null, earned: 9, possible: 10 }, { categoryId: null, earned: 18, possible: 20 }])).toBeCloseTo(90);
  });

  it("what-if grades only count when asked", () => {
    const grades: Grade[] = [
      { categoryId: "tests", earned: 80, possible: 100 },
      { categoryId: "tests", earned: 100, possible: 100, whatIf: true },
    ];
    expect(average(cats, grades)).toBeCloseTo(80);
    expect(average(cats, grades, true)).toBeCloseTo(90);
  });
});

describe("letters", () => {
  it("maps percents to letters", () => {
    expect(letter(95)).toBe("A");
    expect(letter(90)).toBe("A-");
    expect(letter(89.9)).toBe("B+");
    expect(letter(72)).toBe("C-");
    expect(letter(40)).toBe("F");
    expect(letter(null)).toBe("—");
    expect(formatPercent(87.456)).toBe("87.5%");
  });
});

describe("neededFor", () => {
  const grades: Grade[] = [
    { categoryId: "tests", earned: 80, possible: 100 },
    { categoryId: "hw", earned: 50, possible: 50 },
  ];

  it("works out the score needed on the next test", () => {
    // Want 90%: tests avg t → (t*50 + 30)/80 >= 0.9 → t >= 0.84 → (80+x)/200 >= 0.84 → x >= 88
    expect(neededFor(90, cats, grades, "tests", 100)).toBeCloseTo(88, 0);
  });

  it("0 when even a zero keeps you there, null when impossible", () => {
    // A 0 on the next test would give (0.4*50 + 30)/80 = 62.5%, still above 60.
    expect(neededFor(60, cats, grades, "tests", 100)).toBe(0);
    // Staying at 80% still needs 56.1 points, because the next test counts too.
    expect(neededFor(80, cats, grades, "tests", 100)).toBeCloseTo(56.1, 1);
    expect(neededFor(99, cats, grades, "tests", 100)).toBeNull();
  });
});
