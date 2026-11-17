import { describe, expect, it } from "vitest";
import { fromLocal } from "@/lib/time";
import { repeatFromForm } from "./index";
import { toneFor, toTaskView } from "./view";

const PHX = "America/Phoenix";
const at = (date: string, hour: number, minute = 0) => fromLocal(date, { hour, minute }, PHX).toISOString();
const NOW = fromLocal("2026-11-17", { hour: 14, minute: 0 }, PHX); // Tue 2 PM

describe("toneFor", () => {
  it("highlights by urgency", () => {
    expect(toneFor({ due_at: at("2026-11-16", 23, 59), status: "open" }, NOW, PHX)).toBe("overdue");
    expect(toneFor({ due_at: at("2026-11-17", 9), status: "open" }, NOW, PHX)).toBe("overdue"); // earlier today
    expect(toneFor({ due_at: at("2026-11-17", 23, 59), status: "open" }, NOW, PHX)).toBe("today");
    expect(toneFor({ due_at: at("2026-11-18", 23, 59), status: "open" }, NOW, PHX)).toBe("tomorrow");
    expect(toneFor({ due_at: at("2026-11-20", 23, 59), status: "open" }, NOW, PHX)).toBe("normal");
    expect(toneFor({ due_at: null, status: "open" }, NOW, PHX)).toBe("normal");
    expect(toneFor({ due_at: at("2026-11-16", 9), status: "done" }, NOW, PHX)).toBe("done");
  });
});

describe("toTaskView", () => {
  it("builds the class-first title and edit values", () => {
    const v = toTaskView(
      {
        id: "t1",
        title: "Joseph Smith Memorization",
        class_id: "speech",
        due_at: at("2026-11-18", 23, 59),
        due_has_time: false,
        status: "open",
        repeat: repeatFromForm("weekly"),
      },
      { name: "Speech", color: "#ea580c" },
      NOW,
      PHX,
    );
    expect(v).toMatchObject({
      displayTitle: "Speech: Joseph Smith Memorization",
      dueText: "Tomorrow",
      tone: "tomorrow",
      repeatText: "Every week",
      edit: { classId: "speech", dueDate: "2026-11-18", dueTime: null, repeat: "weekly" },
    });
  });

  it("keeps a typed due time for editing", () => {
    const v = toTaskView(
      { id: "t2", title: "Quiz", class_id: null, due_at: at("2026-11-20", 15), due_has_time: true, status: "open", repeat: null },
      null,
      NOW,
      PHX,
    );
    expect(v.edit.dueTime).toBe("15:00");
    expect(v.dueText).toBe("Fri, Nov 20 · 3:00 PM");
  });
});
