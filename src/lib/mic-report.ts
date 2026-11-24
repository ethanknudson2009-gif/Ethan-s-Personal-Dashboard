"use server";

/**
 * After a mic session, the phone sends what the mic did (event names and
 * timings like "start 0.1s · audio 0.3s · end 6.0s", never the words you
 * said) to the server log, so a mic problem on a phone can be looked at
 * without screenshots. Only for signed-in users; nothing is saved to the
 * database.
 */
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  log: z.string().max(600),
  heardWords: z.boolean(),
  standalone: z.boolean(),
  sounds: z.boolean(),
  session: z.string().max(30),
  agent: z.string().max(300),
});

export async function reportMicAction(input: z.input<typeof schema>): Promise<void> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // Only event names and timings: anything that isn't a plain log word is dropped.
  const log = parsed.data.log.replace(/[^\w#:.· -]/g, "");
  console.log(`[mic] ${JSON.stringify({ ...parsed.data, log })}`);
}
