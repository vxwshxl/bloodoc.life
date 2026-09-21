/**
 * Fill the database with a plausible camp roster, for looking at the console
 * before a real camp exists.
 *
 * Refuses to run against anything but a local or explicitly-confirmed project:
 * a seed script that quietly invents forty donors in production is a seed
 * script that will, once.
 *
 *   node scripts/seed-demo.mjs --yes
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

if (!process.argv.includes("--yes")) {
  console.error("This writes demo donors into the linked project. Re-run with --yes if you mean it.");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const FIRST = ["Anjali", "Rahul", "Priya", "Imran", "Nikita", "Bikash", "Meera", "Sanjay", "Ritu", "Arnab", "Kabita", "Dipak", "Sweety", "Hemanta", "Jyoti", "Pranab"];
const LAST = ["Deka", "Boro", "Sarma", "Ahmed", "Das", "Nath", "Kalita", "Choudhury", "Bez", "Gogoi", "Rabha", "Basumatary"];
const GROUPS = ["O+", "O+", "O+", "A+", "A+", "B+", "B+", "AB+", "O-", "A-", "B-", "AB-", "unknown"];
const DEPTS = ["Physics", "Chemistry", "Botany", "Zoology", "Commerce", "English", "Maths", "Library", "Estate"];
const KINDS = ["student", "student", "student", "faculty", "staff"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const int = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

const { data: camp } = await admin
  .from("camps")
  .select("id")
  .eq("status", "published")
  .order("starts_at", { ascending: true })
  .limit(1)
  .maybeSingle();

if (!camp) {
  console.error("No published camp to register anybody for. Create one in the console first.");
  process.exit(1);
}

for (let i = 0; i < 40; i++) {
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  const email = `${name.toLowerCase().replace(/\W/g, ".")}.${i}@example.com`;
  const kind = pick(KINDS);
  const prior = Math.random() < 0.3 ? 0 : int(1, 12);

  const { data: donor } = await admin
    .from("donors")
    .insert({
      full_name: name,
      sex: Math.random() < 0.5 ? "male" : "female",
      age: int(18, 58),
      kind,
      department: kind === "other" ? null : pick(DEPTS),
      email,
      phone: `9${int(100000000, 999999999)}`,
      blood_group: pick(GROUPS),
      prior_donations: prior,
    })
    .select("id")
    .single();

  if (!donor) continue;

  await admin.from("registrations").insert({
    camp_id: camp.id,
    donor_id: donor.id,
    first_time: prior === 0,
    height_cm: int(150, 185),
    weight_kg: int(48, 92),
    bp_systolic: int(105, 135),
    bp_diastolic: int(65, 88),
    status: pick(["registered", "screened", "donated", "donated", "donated", "deferred"]),
  });
}

console.log("Seeded 40 demo donors onto the next camp.");
