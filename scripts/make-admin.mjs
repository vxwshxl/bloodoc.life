/**
 * Promote an email address to `admin`.
 *
 * There is deliberately no way to do this from inside the app. A console that
 * can mint its own admins is one compromised session away from a permanent
 * second administrator, so the first one — and every one after it — is created
 * from a shell with the service-role key in hand.
 *
 *   node scripts/make-admin.mjs someone@example.com
 *
 * The person must have signed in at least once, so that their auth user and
 * profile row exist. Run it before they sign in and it tells you so.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// .env.local, parsed by hand: this runs outside Next, which is what would
// normally load it, and adding dotenv for four lines is not worth a dependency.
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/make-admin.mjs <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await admin
  .from("profiles")
  .update({ role: "admin" })
  .eq("email", email)
  .select("id, email, role");

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}
if (!data?.length) {
  console.error(
    `No profile for ${email}. Ask them to sign in once at /signin, then run this again.`,
  );
  process.exit(1);
}

console.log(`${email} is now an admin.`);
