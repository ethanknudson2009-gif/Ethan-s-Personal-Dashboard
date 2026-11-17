"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { failTo } from "@/lib/form-errors";

/*
 * Server actions for the Classes page. Every query runs as the logged-in
 * user, so Row Level Security keeps each person to their own rows.
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a full date");
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 08:00");

function fail(message: string): never {
  failTo("/classes", message);
}

async function db() {
  return createClient();
}

// ── Term ────────────────────────────────────────────────────────────────────
const termSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "Give the term a name"),
  starts_on: date,
  ends_on: date,
});

export async function saveTerm(formData: FormData) {
  const parsed = termSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const t = parsed.data;
  if (t.ends_on < t.starts_on) fail("The term has to end after it starts");

  const weekdays = formData
    .getAll("school_weekdays")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  const supabase = await db();
  const { error } = await supabase.from("terms").update({ name: t.name, starts_on: t.starts_on, ends_on: t.ends_on }).eq("id", t.id);
  if (error) fail(error.message);
  const { error: e2 } = await supabase.from("schedules").update({ school_weekdays: weekdays }).eq("term_id", t.id);
  if (e2) fail(e2.message);
  refresh();
}

// ── Classes ─────────────────────────────────────────────────────────────────
type MeetingInput = { id: string | null; weekday: number; starts_at: string; ends_at: string; remove: boolean };

/** Reads meeting rows named m_0_weekday, m_0_start, … from the form. */
function readMeetings(formData: FormData): MeetingInput[] {
  const indexes = new Set<string>();
  for (const key of formData.keys()) {
    const m = /^m_(\d+)_/.exec(key);
    if (m) indexes.add(m[1]);
  }
  const meetings: MeetingInput[] = [];
  for (const i of indexes) {
    const weekdayRaw = String(formData.get(`m_${i}_weekday`) ?? "");
    const start = String(formData.get(`m_${i}_start`) ?? "");
    const end = String(formData.get(`m_${i}_end`) ?? "");
    const id = String(formData.get(`m_${i}_id`) ?? "") || null;
    const remove = formData.get(`m_${i}_remove`) === "on";
    if (!id && (weekdayRaw === "" || !start || !end)) continue; // blank "add a time" row
    const weekday = Number(weekdayRaw);
    if (!remove) {
      if (!(weekday >= 0 && weekday <= 6)) fail("Pick a day for each class time");
      if (!time.safeParse(start).success || !time.safeParse(end).success) fail("Use a time like 08:00");
      if (end <= start) fail("A class has to end after it starts");
    }
    meetings.push({ id, weekday, starts_at: start, ends_at: end, remove });
  }
  return meetings;
}

const classSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  term_id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Give the class a name").max(80),
  short_names: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
  teacher: z.string().trim().max(80).optional(),
  room: z.string().trim().max(40).optional(),
});

export async function saveClass(formData: FormData) {
  const parsed = classSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const c = parsed.data;
  const shortNames = (c.short_names ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const meetings = readMeetings(formData);

  const supabase = await db();
  const row = {
    name: c.name,
    short_names: shortNames,
    color: c.color,
    teacher: c.teacher || null,
    room: c.room || null,
  };

  let classId = c.id || null;
  if (classId) {
    const { error } = await supabase.from("classes").update(row).eq("id", classId);
    if (error) fail(error.message);
  } else {
    const { data, error } = await supabase
      .from("classes")
      .insert({ ...row, term_id: c.term_id || null })
      .select("id")
      .single();
    if (error) fail(error.message);
    classId = data.id;
  }

  for (const m of meetings) {
    if (m.id && m.remove) {
      const { error } = await supabase.from("class_meetings").delete().eq("id", m.id);
      if (error) fail(error.message);
    } else if (m.id) {
      const { error } = await supabase
        .from("class_meetings")
        .update({ weekday: m.weekday, starts_at: m.starts_at, ends_at: m.ends_at })
        .eq("id", m.id);
      if (error) fail(error.message);
    } else if (!m.remove) {
      const { error } = await supabase
        .from("class_meetings")
        .insert({ class_id: classId, weekday: m.weekday, starts_at: m.starts_at, ends_at: m.ends_at });
      if (error) fail(error.message);
    }
  }
  refresh();
}

/** Moves a class to the Trash (it can be restored for 7 days). */
export async function deleteClass(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await db();
  const { error } = await supabase.from("classes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) fail(error.message);
  refresh();
}
