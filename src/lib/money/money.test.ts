import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { categorize } from "./categories";
import { moneyToCents, readCashAppCsv, toIsoDate } from "./cashapp";

describe("parseCsv", () => {
  it("handles quotes, commas and line breaks inside quotes", () => {
    expect(parseCsv('a,b,c\r\n"1,000","say ""hi""","line\nbreak"\n')).toEqual([
      ["a", "b", "c"],
      ["1,000", 'say "hi"', "line\nbreak"],
    ]);
  });
});

describe("amounts and dates", () => {
  it("reads money in all the usual shapes", () => {
    expect(moneyToCents("-$12.50")).toBe(-1250);
    expect(moneyToCents("$1,234.00")).toBe(123400);
    expect(moneyToCents("(8.00)")).toBe(-800);
    expect(moneyToCents("- $3")).toBe(-300);
    expect(moneyToCents("")).toBeNull();
  });

  it("reads dates", () => {
    expect(toIsoDate("2026-11-15 14:23:01 MST")).toBe("2026-11-15");
    expect(toIsoDate("11/5/2026")).toBe("2026-11-05");
    expect(toIsoDate("nope")).toBeNull();
  });
});

describe("categorize", () => {
  it("sorts by keywords and direction", () => {
    expect(categorize("Chipotle", -1200)).toBe("Food");
    expect(categorize("Circle K #123", -4000)).toBe("Gas");
    expect(categorize("Spotify", -1199)).toBe("Subscriptions");
    expect(categorize("PRMI payroll", 85000)).toBe("Paycheck");
    expect(categorize("Windows for the Lopez house", 8000)).toBe("Window washing");
    expect(categorize("Cash Out", -5000)).toBe("Transfers");
    expect(categorize("Sent · Jake", -2000)).toBe("Sent");
    expect(categorize("from Mom", 2500)).toBe("Received");
    expect(categorize("random thing", -100)).toBe("Other");
  });
});

describe("readCashAppCsv", () => {
  const csv = [
    "Transaction ID,Date,Transaction Type,Currency,Amount,Fee,Net Amount,Asset Type,Asset Price,Asset Amount,Status,Notes,Name of sender/receiver,Account",
    "abc1,2026-11-15 12:01:00 MST,Cash Card Debit,USD,-$11.42,$0,-$11.42,,,,CARD CHARGED,Chipotle,Chipotle Mexican Grill,Visa Debit 1234",
    "abc2,2026-11-14 09:00:00 MST,P2P,USD,$80,$0,$80,,,,PAYMENT DEPOSITED,windows,Mrs Lopez,Your Cash",
    "abc3,2026-11-13 18:30:00 MST,P2P,USD,-$20,$0,-$20,,,,PAYMENT FAILED,pizza,Jake,Your Cash",
    "abc4,2026-11-12 08:00:00 MST,Cash Card Debit,USD,-$45.10,$0,-$45.10,,,,CARD CHARGED,,QuikTrip 456,Visa Debit 1234",
  ].join("\n");

  it("reads completed transactions, skips failed ones, and categorizes", () => {
    const r = readCashAppCsv(csv);
    expect(r.error).toBeNull();
    expect(r.skipped).toBe(1);
    expect(r.transactions).toHaveLength(3);
    expect(r.transactions[0]).toMatchObject({ externalId: "abc1", occurredOn: "2026-11-15", amountCents: -1142, category: "Food", counterparty: "Chipotle Mexican Grill" });
    expect(r.transactions[1]).toMatchObject({ amountCents: 8000, category: "Window washing" });
    expect(r.transactions[2]).toMatchObject({ amountCents: -4510, category: "Gas" });
  });

  it("explains files that aren't statements", () => {
    expect(readCashAppCsv("hello,world\n1,2").error).toMatch(/doesn't look like/);
    expect(readCashAppCsv("").error).toMatch(/no transactions/);
  });
});

describe("summary", async () => {
  const { monthTotals, lastMonths, dollars, shiftMonthKey } = await import("./summary");
  const txs = [
    { occurredOn: "2026-11-15", amountCents: -1142, category: "Food" },
    { occurredOn: "2026-11-14", amountCents: 8000, category: "Window washing" },
    { occurredOn: "2026-11-12", amountCents: -4510, category: "Gas" },
    { occurredOn: "2026-11-10", amountCents: -5000, category: "Transfers" },
    { occurredOn: "2026-10-03", amountCents: -2000, category: "Food" },
  ];

  it("totals a month, ignoring transfers of your own money", () => {
    const t = monthTotals(txs, "2026-11");
    expect(t).toMatchObject({ inCents: 8000, outCents: 5652, netCents: 2348 });
    expect(t.categories[0]).toEqual({ name: "Gas", cents: 4510 });
  });

  it("months for the chart and formatting", () => {
    expect(lastMonths(txs, "2026-11", 2)).toEqual([
      { key: "2026-10", inCents: 0, outCents: 2000 },
      { key: "2026-11", inCents: 8000, outCents: 5652 },
    ]);
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(dollars(123450)).toBe("$1,234.50");
    expect(dollars(-2000, true)).toBe("−$20");
    expect(dollars(2348, true)).toBe("+$23.48");
  });
});
