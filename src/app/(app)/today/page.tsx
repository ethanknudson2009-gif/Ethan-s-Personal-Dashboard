import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE, toLocalDate, weekdayOf } from "@/lib/time";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Placeholder Today page. Milestone 3 fills in Do Now / Up Next / Due Soon. */
export default async function TodayPage() {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, timezone")
    .single();

  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const today = toLocalDate(new Date(), timeZone);

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Today</h1>
      <p>
        {WEEKDAYS[weekdayOf(today)]}, {today} ({timeZone})
      </p>
      {error ? (
        <p className="text-sm text-red-600">
          Couldn&apos;t load your profile: {error.message}. Did you run supabase/migrations/0001_profiles.sql?
        </p>
      ) : (
        <p className="text-sm text-gray-600">Signed in as {profile?.display_name}. ✓ Database connected.</p>
      )}
    </section>
  );
}
