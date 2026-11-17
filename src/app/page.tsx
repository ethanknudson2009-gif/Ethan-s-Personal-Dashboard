import { redirect } from "next/navigation";

/** The home address just opens Today. */
export default function Home() {
  redirect("/today");
}
