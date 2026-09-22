"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireConsoleUser } from "@/lib/auth/dal";

export type DeleteState = { ok?: boolean; error?: string; message?: string };

/**
 * The tables a row may be deleted from, and what one row is called.
 *
 * A whitelist and not a parameter. The posted table name is a string from a
 * browser, and `from(table).delete()` with an unchecked one is the whole
 * database behind a form field — RLS would refuse most of it, but "most" is not
 * a boundary. Nothing reaches PostgREST that is not a key of this object.
 *
 * `revalidate` is where the row was showing. Deleting a registration changes
 * the roster, the desk, the overview counts and the partner's own list, and a
 * page that still shows it is a page somebody will try to delete it from again.
 */
const DELETABLE = {
  registrations: {
    label: "Registration",
    revalidate: ["/admin/registrations", "/admin", "/desk/roster", "/partner/registrations"],
  },
  donors: {
    label: "Donor",
    revalidate: ["/admin/donors", "/admin"],
  },
  certificates: {
    label: "Certificate",
    revalidate: ["/admin/certificates", "/partner/certificates", "/dashboard/certificates"],
  },
  partners: {
    label: "Partner",
    revalidate: ["/admin/partners", "/admin/partners/organisations", "/admin/partners/blood-banks"],
  },
  partner_members: {
    label: "Member",
    revalidate: ["/admin/partners"],
  },
  email_log: {
    label: "Email",
    revalidate: ["/admin/email"],
  },
} as const;

export type DeletableTable = keyof typeof DELETABLE;

const schema = z.object({
  table: z.enum(Object.keys(DELETABLE) as [DeletableTable, ...DeletableTable[]]),
  id: z.string().min(1).max(64),
});

/**
 * Delete one row.
 *
 * Runs on the *session* client, never the service role, and that is the entire
 * security design. This function does not decide who may delete what — it asks
 * the database, which answers with the delete policies in 0001, 0008 and 0017.
 * An administrator's delete succeeds; a verifier's succeeds only for a
 * registration and only while `delete_scope` is `delegated`; a donor's matches
 * no policy and removes nothing.
 *
 * `requireConsoleUser()` above it is a convenience, not the boundary: it sends
 * somebody with no business here to their own page instead of making them wait
 * for a delete that was never going to affect a row.
 *
 * A delete that matches no policy is not an error in PostgREST — it removes
 * zero rows and reports success. That is why the result is counted rather than
 * merely checked for an error: "nothing happened" must not be reported as
 * "deleted".
 */
export async function deleteRecord(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  await requireConsoleUser();

  const parsed = schema.safeParse({
    table: formData.get("table"),
    id: formData.get("id"),
  });
  if (!parsed.success) return { error: "That is not something that can be deleted." };
  const { table, id } = parsed.data;
  const meta = DELETABLE[table];

  const supabase = await createClient();
  const { data, error } = await supabase.from(table).delete().eq("id", id).select("id");

  if (error) return { error: `Could not delete that ${meta.label.toLowerCase()}.` };
  if (!data?.length) {
    return {
      error: `You do not have permission to delete that ${meta.label.toLowerCase()}.`,
    };
  }

  for (const path of meta.revalidate) revalidatePath(path);
  return { ok: true, message: `${meta.label} deleted.` };
}

const scopeSchema = z.object({ scope: z.enum(["admin_only", "delegated"]) });

/**
 * Who may delete records.
 *
 * Administrator-only, and the database agrees independently:
 * `app_settings_admin_write` is what refuses this if the check above is ever
 * removed. Writing the row is the whole action — the policies in 0017 read it
 * on every delete, so there is nothing to propagate and no cache to clear
 * beyond the pages that draw the button.
 */
export async function setDeleteScope(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const me = await requireAdmin();

  const parsed = scopeSchema.safeParse({ scope: formData.get("scope") });
  if (!parsed.success) return { error: "Unknown setting." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ value: parsed.data.scope, updated_by: me.id })
    .eq("key", "delete_scope");

  if (error) return { error: "Could not change that setting." };

  // Every console page draws a delete button or does not, so all of them are
  // now stale. The layout paths cover their children.
  revalidatePath("/admin", "layout");
  revalidatePath("/desk", "layout");
  revalidatePath("/partner", "layout");
  return {
    ok: true,
    message:
      parsed.data.scope === "admin_only"
        ? "Only administrators can delete records now."
        : "Desk and blood bank staff can now delete registrations.",
  };
}
