/**
 * Fill the database with a plausible history, for looking at the console
 * before a real camp exists.
 *
 * Everything it writes is tagged so it can be taken out again:
 *   - donors carry `notes = 'DEMO'` and an @demo.bloodoc.life address
 *   - camps carry a slug starting `demo-`
 *   - partner members carry an @demo.bloodoc.life address
 *
 *   node scripts/seed-demo.mjs --yes      # write it
 *   node scripts/seed-demo.mjs --clean    # take it all out again
 *
 * Registrations are spread across the last thirty days on purpose: the
 * overview's trend chart is a line over that window, and forty rows all
 * stamped "today" draws a single spike that tells you nothing about whether
 * the chart works.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const CLEAN = process.argv.includes("--clean");
if (!CLEAN && !process.argv.includes("--yes")) {
  console.error("This writes demo rows into the linked project. Re-run with --yes, or --clean to remove them.");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const DEMO_DOMAIN = "demo.bloodoc.life";

// --------------------------------------------------------------------------
// Cleanup. Registrations and certificates go by cascade from the donor and the
// camp, so only the two roots need deleting.
// --------------------------------------------------------------------------
if (CLEAN) {
  const { count: d } = await admin.from("donors").delete({ count: "exact" }).like("email", `%@${DEMO_DOMAIN}`);
  const { count: m } = await admin.from("partner_members").delete({ count: "exact" }).like("email", `%@${DEMO_DOMAIN}`);
  const { count: c } = await admin.from("camps").delete({ count: "exact" }).like("slug", "demo-%");
  console.log(`Removed ${d ?? 0} donors, ${m ?? 0} partner members, ${c ?? 0} camps.`);
  process.exit(0);
}

const FIRST = ["Anjali", "Rahul", "Priya", "Imran", "Nikita", "Bikash", "Meera", "Sanjay", "Ritu", "Arnab", "Kabita", "Dipak", "Sweety", "Hemanta", "Jyoti", "Pranab", "Tarun", "Lakhi", "Rupam", "Nayan"];
const LAST = ["Deka", "Boro", "Sarma", "Ahmed", "Das", "Nath", "Kalita", "Choudhury", "Bez", "Gogoi", "Rabha", "Basumatary", "Saikia", "Hazarika"];
// Weighted to roughly match Indian donor-registry frequencies, so the blood
// group chart has a believable shape rather than eight equal bars.
const GROUPS = ["O+", "O+", "O+", "O+", "B+", "B+", "B+", "A+", "A+", "AB+", "O-", "A-", "B-", "AB-", "unknown"];
const DEPTS = ["Physics", "Chemistry", "Botany", "Zoology", "Commerce", "English", "Maths", "Library", "Estate"];
const KINDS = ["student", "student", "student", "student", "faculty", "staff", "other"];
const DEFERRALS = ["Haemoglobin below 12.5 g/dL", "Blood pressure high on the day", "Under weight (45kg minimum)", "Recent fever", "Donated within the last 56 days"];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const int = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const iso = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(int(8, 18), int(0, 59), 0, 0);
  return d.toISOString();
};

// --------------------------------------------------------------------------
// Camps. One already run, one upcoming — the console looks wrong with a single
// camp because every "across every camp" figure equals the one camp's figure.
// --------------------------------------------------------------------------
const campSpecs = [
  {
    slug: "demo-winter-drive-2025",
    title: "Winter Blood Drive 2025",
    venue: "RGU Central Auditorium",
    city: "Guwahati",
    daysAgo: 24,
    status: "closed",
    listed: false,
  },
  {
    slug: "demo-republic-day-2026",
    title: "Republic Day Donation Camp 2026",
    venue: "DEF Block, 6th Floor",
    city: "Guwahati",
    daysAgo: -95,
    status: "draft",
    listed: false,
  },
];

const camps = [];

// The real published camp leads, if there is one.
const { data: live } = await admin
  .from("camps")
  .select("id, title")
  .eq("status", "published")
  .order("starts_at", { ascending: true })
  .limit(1)
  .maybeSingle();
if (live) camps.push(live);

for (const spec of campSpecs) {
  const starts = new Date();
  starts.setDate(starts.getDate() - spec.daysAgo);
  starts.setHours(11, 0, 0, 0);
  const ends = new Date(starts);
  ends.setHours(16, 0, 0, 0);

  const { data, error } = await admin
    .from("camps")
    .upsert(
      {
        slug: spec.slug,
        title: spec.title,
        summary: "Demo camp, created by scripts/seed-demo.mjs.",
        venue: spec.venue,
        city: spec.city,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: spec.status,
        listed: spec.listed,
      },
      { onConflict: "slug" },
    )
    .select("id, title")
    .single();
  if (error) {
    console.error(`camp ${spec.slug}:`, error.message);
    continue;
  }
  camps.push(data);
}

if (camps.length === 0) {
  console.error("No camp to register anybody for. Create one in the console first.");
  process.exit(1);
}

// Attach the demo camps to whatever partners exist, so the partner panels and
// the partner detail pages have more than one camp on them.
const { data: partners } = await admin.from("partners").select("id, kind, slug");
for (const camp of camps) {
  for (const [i, p] of (partners ?? []).entries()) {
    await admin
      .from("camp_partners")
      .upsert(
        { camp_id: camp.id, partner_id: p.id, role: p.kind, is_host: i === 0, sort_order: i },
        { onConflict: "camp_id,partner_id" },
      );
  }
}

// --------------------------------------------------------------------------
// Partner access, so the partner panel can actually be signed into.
// --------------------------------------------------------------------------
for (const p of partners ?? []) {
  // A plain insert, with the duplicate tolerated. Not an upsert: the uniqueness
  // rule is the expression index `(partner_id, lower(email))` from 0008, and
  // PostgREST's `on_conflict` can only name plain columns — so an upsert
  // against it fails the request outright instead of doing nothing, which is
  // how this silently seeded zero members the first time.
  const { error } = await admin.from("partner_members").insert({
    partner_id: p.id,
    email: `${p.slug}@${DEMO_DOMAIN}`,
    full_name: "Demo Coordinator",
    title: p.kind === "blood_bank" ? "Blood Bank Officer" : "Camp Coordinator",
    role: "owner",
  });
  if (error && error.code !== "23505") console.error(`partner_member ${p.slug}:`, error.message);
}

// --------------------------------------------------------------------------
// Donors and their registrations.
// --------------------------------------------------------------------------
let donors = 0;
let regs = 0;

for (let i = 0; i < 70; i++) {
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  const email = `${name.toLowerCase().replace(/\W/g, ".")}.${i}@${DEMO_DOMAIN}`;
  const kind = pick(KINDS);
  const group = pick(GROUPS);
  const prior = Math.random() < 0.35 ? 0 : int(1, 12);
  const createdDaysAgo = int(0, 29);

  const { data: donor, error } = await admin
    .from("donors")
    .insert({
      full_name: name,
      sex: Math.random() < 0.52 ? "male" : "female",
      age: int(18, 58),
      kind,
      department: kind === "other" ? null : pick(DEPTS),
      occupation: kind === "other" ? "Shopkeeper" : null,
      email,
      phone: `9${int(100000000, 899999999)}`,
      blood_group: group,
      prior_donations: prior,
      notes: "DEMO",
      created_at: iso(createdDaysAgo),
    })
    .select("id")
    .single();
  if (error) continue;
  donors++;

  // Most people attend one camp; a few are repeat donors across two.
  const attend = Math.random() < 0.25 ? camps.slice(0, 2) : [pick(camps)];
  for (const camp of attend) {
    const status = pick(["registered", "screened", "donated", "donated", "donated", "deferred", "cancelled"]);
    const donated = status === "donated";
    const { error: regErr } = await admin.from("registrations").insert({
      camp_id: camp.id,
      donor_id: donor.id,
      status,
      first_time: prior === 0,
      // Vitals only where somebody actually reached the desk. A registered-
      // but-not-screened row with a haemoglobin reading is a lie the console
      // would then display as fact.
      height_cm: status === "registered" ? null : int(150, 185),
      weight_kg: status === "registered" ? null : int(46, 92),
      bp_systolic: status === "registered" ? null : int(105, 138),
      bp_diastolic: status === "registered" ? null : int(68, 88),
      hemoglobin_gdl: status === "registered" ? null : (donated ? int(125, 165) : int(110, 124)) / 10,
      deferral_reason: status === "deferred" ? pick(DEFERRALS) : null,
      created_at: iso(createdDaysAgo),
    });
    if (!regErr) regs++;
  }
}

// Certificates are not created here. The `registrations_mint_certificate`
// trigger from 0008 writes one for every row that lands on `donated`, which is
// the whole point of it being a trigger — a seed that inserted its own would
// be testing the seed rather than the system.
const { count: certs } = await admin
  .from("certificates")
  .select("id", { count: "exact", head: true });

console.log(`Seeded ${donors} donors, ${regs} registrations across ${camps.length} camps.`);
console.log(`Certificates now in the table: ${certs ?? 0}.`);
console.log(`Partner sign-ins: <partner-slug>@${DEMO_DOMAIN}`);
console.log(`Remove it all with: node scripts/seed-demo.mjs --clean`);
