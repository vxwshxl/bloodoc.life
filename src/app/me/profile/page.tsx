import { redirect } from "next/navigation";

/** Moved into the console. See the note in ../page.tsx. */
export default function ProfileRedirect() {
  redirect("/dashboard/profile");
}
