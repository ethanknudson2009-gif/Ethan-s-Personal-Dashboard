import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { DEFAULT_STUDY_SETTINGS, type StudySettings } from "@/lib/cushion";
import { DEFAULT_TIME_ZONE } from "@/lib/time";

/** The logged-in user's time zone and study-time settings (with safe defaults). */
export async function loadSettings(supabase: SupabaseClient<Database>): Promise<StudySettings> {
  const { data } = await supabase.from("profiles").select("timezone, study_minutes, study_end_time").maybeSingle();
  if (!data) return DEFAULT_STUDY_SETTINGS;
  const [h, m] = (data.study_end_time ?? "22:00").split(":").map(Number);
  return {
    timeZone: data.timezone || DEFAULT_TIME_ZONE,
    studyMinutes: data.study_minutes?.length === 7 ? data.study_minutes : DEFAULT_STUDY_SETTINGS.studyMinutes,
    studyEndTime: { hour: h, minute: m },
  };
}
