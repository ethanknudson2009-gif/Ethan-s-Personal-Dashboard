import { describe, expect, it } from "vitest";
import { classesOn, dayInfo, schoolDaysFromAnchor, type ScheduleContext } from "./index";

// Ethan's week: school Monday–Thursday.
const term = { startsOn: "2026-08-10", endsOn: "2026-12-18" };

const weekly: ScheduleContext = {
  term,
  schedule: { kind: "weekly", schoolWeekdays: [1, 2, 3, 4], dayLabels: [], anchorDate: "2026-11-09", anchorLabel: "" },
  noSchoolDays: ["2026-11-26"], // Thanksgiving (a Thursday)
};

// Same week, but as an A/B rotation. Mon Nov 9, 2026 is an A day.
const ab: ScheduleContext = {
  ...weekly,
  schedule: { kind: "rotating", schoolWeekdays: [1, 2, 3, 4], dayLabels: ["A", "B"], anchorDate: "2026-11-09", anchorLabel: "A" },
};

describe("dayInfo (weekly, Mon–Thu)", () => {
  it("Mon–Thu are school days, Fri–Sun are not", () => {
    expect(dayInfo("2026-11-09", weekly)).toEqual({ isSchoolDay: true, label: null }); // Mon
    expect(dayInfo("2026-11-12", weekly).isSchoolDay).toBe(true); // Thu
    expect(dayInfo("2026-11-13", weekly).isSchoolDay).toBe(false); // Fri
    expect(dayInfo("2026-11-15", weekly).isSchoolDay).toBe(false); // Sun
  });

  it("holidays and days outside the term are not school days", () => {
    expect(dayInfo("2026-11-26", weekly).isSchoolDay).toBe(false); // Thanksgiving
    expect(dayInfo("2027-01-04", weekly).isSchoolDay).toBe(false); // after the term
  });
});

describe("dayInfo (A/B rotation)", () => {
  it("alternates across a 4-day school week and continues after the weekend", () => {
    const labels = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-16", "2026-11-17"].map(
      (d) => dayInfo(d, ab).label,
    );
    expect(labels).toEqual(["A", "B", "A", "B", "A", "B"]);
    expect(dayInfo("2026-11-13", ab)).toEqual({ isSchoolDay: false, label: null }); // Friday off
  });

  it("a holiday doesn't eat a rotation day", () => {
    // Week of Thanksgiving: Mon A, Tue B, Wed A, Thu holiday, next Mon is B.
    expect(dayInfo("2026-11-23", ab).label).toBe("A");
    expect(dayInfo("2026-11-25", ab).label).toBe("A");
    expect(dayInfo("2026-11-26", ab).isSchoolDay).toBe(false);
    expect(dayInfo("2026-11-30", ab).label).toBe("B");
  });

  it("works backward from the anchor too", () => {
    // Thu Nov 5 is the school day right before Mon Nov 9 (the "A" anchor), so it's B.
    expect(schoolDaysFromAnchor("2026-11-05", ab)).toBe(-1);
    expect(schoolDaysFromAnchor("2026-11-04", ab)).toBe(-2);
    expect(dayInfo("2026-11-05", ab).label).toBe("B");
    expect(dayInfo("2026-11-04", ab).label).toBe("A");
  });

  it("supports longer cycles like a 6-day rotation", () => {
    const six: ScheduleContext = {
      ...ab,
      schedule: { ...ab.schedule, dayLabels: ["1", "2", "3", "4", "5", "6"], anchorLabel: "5" },
    };
    const labels = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-16"].map((d) => dayInfo(d, six).label);
    expect(labels).toEqual(["5", "6", "1", "2", "3"]);
  });

  it("overrides: cancel a day, or force a label for one day only", () => {
    const ctx: ScheduleContext = {
      ...ab,
      overrides: [
        { date: "2026-11-10", noSchool: true }, // snow day
        { date: "2026-11-13", label: "B" }, // make-up Friday
      ],
    };
    expect(dayInfo("2026-11-10", ctx).isSchoolDay).toBe(false);
    expect(dayInfo("2026-11-11", ctx).label).toBe("B"); // snow day didn't use up B
    expect(dayInfo("2026-11-13", ctx)).toEqual({ isSchoolDay: true, label: "B" });
    expect(dayInfo("2026-11-16", ctx).label).toBe("B"); // forced day doesn't shift the rotation
  });
});

describe("classesOn", () => {
  const meetings = [
    { classId: "bio", dayLabel: "A", startsAt: "09:30", endsAt: "11:00" },
    { classId: "math", dayLabel: "A", startsAt: "08:00", endsAt: "09:20" },
    { classId: "eng", dayLabel: "B", startsAt: "08:00", endsAt: "09:20" },
  ];

  it("returns that day's classes in time order", () => {
    expect(classesOn("2026-11-09", ab, meetings).map((m) => m.classId)).toEqual(["math", "bio"]);
    expect(classesOn("2026-11-10", ab, meetings).map((m) => m.classId)).toEqual(["eng"]);
    expect(classesOn("2026-11-13", ab, meetings)).toEqual([]);
  });

  it("uses weekdays for weekly schedules", () => {
    const weeklyMeetings = [{ classId: "pe", weekday: 1, startsAt: "13:00", endsAt: "14:00" }];
    expect(classesOn("2026-11-09", weekly, weeklyMeetings)).toHaveLength(1);
    expect(classesOn("2026-11-10", weekly, weeklyMeetings)).toHaveLength(0);
  });
});
