import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { Gallery } from "@/components/gallery";

/** Design gallery: pick a color theme, like layout ideas (roadmap: "show me ~20 of each"). */
export default async function GalleryPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("theme, liked_layouts").maybeSingle();
  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Design gallery" subtitle="Make it yours" />
      <Gallery theme={data?.theme ?? "neon-teal"} liked={data?.liked_layouts ?? []} />
    </div>
  );
}
