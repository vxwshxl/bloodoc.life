import { redirect } from "next/navigation";

/**
 * `/me` moved into the console as `/dashboard`.
 *
 * Kept as a redirect rather than deleted: the address is in every registration
 * confirmation ever sent ("View your registration"), and those emails are in
 * people's inboxes and cannot be edited.
 */
export default function MeRedirect() {
  redirect("/dashboard");
}
