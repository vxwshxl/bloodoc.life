# BlooDoc

Blood donation camps, end to end. Single Next.js 16 app, Supabase, Tailwind v4.
Read [README.md](README.md) for what it is and how to run it; this file is the
things that will bite you.

## Non-obvious

- **Vitals belong to the registration, not the donor.** `weight_kg`,
  `bp_systolic`, `bp_diastolic` and `medications` are on `registrations`
  because a screening record is a snapshot of one day. Do not "tidy" them onto
  `donors`.
- **`donors.prior_donations` is what the donor said, not what we counted.** The
  count we have watched happen is
  `select count(*) from registrations where status = 'donated'`. `/me` adds the
  two; neither alone is the lifetime figure.
- **`profile_id` on `donors` is nullable on purpose** — a walk-in entered from a
  paper slip has no account. The `on_auth_user_created` trigger links them by
  email the first time they sign in.
- **Public registration runs on the service-role client** (`lib/donors/actions.ts`)
  and is the *only* place that should. It exists so the RLS write policy can
  stay strict. It re-reads the camp rather than trusting the posted id.
- **Role is read from `profiles`, never from the JWT.** See the README.
- **Times are IST.** `datetime-local` posts a zoneless string; `istToIso` in
  `lib/admin/actions.ts` reads it as +05:30. Every display format pins
  `Asia/Kolkata`, or the server and the browser render different days.
- **`donors.address` is the residential address.** It predates
  `permanent_address` (0020) and kept its name. Parents' titles
  (`father_title` / `mother_title`: `mr` / `mrs` / `late`, printed "Lt.") are
  separate from the names; display through `parentName()`. **The form asks
  for one name** — father's, mother's or spouse's (`RelationInput`, posting
  `relation` / `relationTitle` / `relationName`). `finishPerson` writes that
  relation's columns and clears the other two; show it with `relationLine()`.
- **Pulse** (`registrations.pulse_bpm`, 0024) is a desk reading like BP, never
  asked on the public form.
- **Admins edit a registration's form answers** from the registration dialog
  ("Edit form", `adminUpdateDonor`). It writes the donor record through the
  same `donorProfileSchema` and `DonorFields` the donor's /me editor uses. The
  email is editable there (never on /me): an address another donor has is
  refused, and for a donor with an account `moveSignIn` moves the auth user and
  `profiles.email` with it, so the address stays the account.
- **Age is derived, never posted.** The form shows it; `finishPerson` in
  `lib/validations/donor.ts` recomputes it from the date of birth in IST.
- **RGU schools and departments live in `lib/rgu.ts`**, copied from rgu.ac.
  Not constrained in the database. A school with no departments stores its
  own plain name as `department`.
- **Certificates:** issued `approved` by a trigger the moment a registration
  reaches `donated` (0021), then emailed by `emailCertificateFor`, which every
  action that can record a donation calls. `claim_certificate_email` sends at
  most once per certificate; call it freely. A camp's `certificate_art` picks organiser artwork from
  `lib/certificates/artwork.ts` (name printed at measured percentages);
  null gets the standard design drawn from the camp's data.
- **Spouse's name** (`husband_title` / `husband_name`, 0022; Mrs. allowed 0023)
  is the third choice of that one name.
- **Renaming a camp** re-translates `title_as` / `title_hi` (Sarvam, on
  `SARVAM_API_KEY`) unless the organiser edited them, in the form and again in
  `saveCamp`. Organiser artwork has the camp's name baked in; `printed` in
  `artwork.ts` says what it says, and the certificate paints the current name
  over it when they differ.
- **Every certificate carries a QR** to `bloodoc.life/verify/<code>`
  (`certificate-qr.tsx`) and "Powered by BLOODOC" in its code line.
- **WhatsApp is optional** (`lib/whatsapp/send.ts`, Meta Cloud API, approved
  templates only). When set, certificates go out on it alongside email and
  `/signin` offers phone sign-in: the number must belong to exactly one donor
  address, and the session is that address's account. Sends are logged in
  `email_log` as "WhatsApp +91…".
- **Camp report** is `GET /admin/camps/:id/export` — Excel
  (`lib/reports/camp-workbook.ts`), or PDF with `?format=pdf`
  (`lib/reports/camp-pdf.ts`), both from `loadCampReport`: three lists (All
  donors, Faculty, Students; `?list=all|faculty|students` for one, which is
  what the `ReportDownload` menus offer first) under one letterhead — RGU's
  logo on top when `isRguCamp`, then "Powered by" BlooDoc's mark and name
  centred (both PNGs kept in `lib/reports/images.ts`, never fetched), then the
  collaborators (those with a logo in the first row, names-only under it:
  `partnerRows`). Excel images are placed with `placeImage` in native EMU;
  ExcelJS's fractional `{ col, row }` anchors land in the wrong place. Partner logos come from `partners.logo_url`, uploaded on the
  partner page into the `partner-logos` bucket as PNG. **No sharp in the
  reports**: its libvips was missing from the Vercel function and took the
  route down. Logos are used as PNG/JPEG as they are.
- **Vote of thanks** is `GET /admin/camps/:id/thanks` (`lib/reports/thanks-pdf.ts`,
  "Vote of thanks" beside the report downloads): A4, one page per
  collaborator, under the same letterhead as the camp PDF. That letterhead
  lives in `lib/reports/letterhead-pdf.ts`; change it there, not per document.
  The camp's totals are printed only once a donation is recorded.
- **Users page roles** include Organisation and Blood bank (`ACCESS_OPTIONS`
  in `lib/roles.ts`). They are `partner_members` rows, not `profiles.role`:
  choosing one adds a membership (`grantPartnerAccess`) and sets the role to
  donor; choosing Donor removes the memberships.
- **"Deferred" is not offered** as an outcome anywhere in the console. The
  enum value stays in the database so an older row still reads.
- **/verify downloads the PDF** in the browser (`VerifyDownload`, the same
  `downloadCertificatePdf` the console uses), for valid certificates only.
- **Camp slugs are never updated on edit.** They are in public URLs and in
  confirmation emails already sent.

## Rules

- Schema changes are **migration files** in `supabase/migrations`, applied with
  `supabase db push`. Never a dashboard click.
- Every new table gets `enable row level security` and its policies **in the
  same migration**. Retrofitting RLS is the most painful thing in this stack.
- Every foreign key gets an index.
- Server Actions are Zod-validated and start with `requireAdmin()` where they
  touch the console.
- `SUPABASE_SECRET_KEY` and `ZEPTOMAIL_TOKEN` are server-only. Nothing that
  reads them may be imported by a client component — `import "server-only"` is
  at the top of each for that reason.
- Marketing motion lives in `components/marketing`. Nothing under `(console)`
  imports GSAP or Lenis.
- Reduced motion is a different layout, not a disabled one. Check the
  `motion-safe:` / `motion-reduce:` pairs when touching the hero.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm build
```

## Medical copy

Nothing on this site clears anyone to donate, and no page may imply it does.
Eligibility figures (age, weight, the three-month interval, deferral periods)
are general Indian guidelines and are always hedged to "the medical officer at
the camp decides". If you change one, change it in
`components/marketing/eligibility-band.tsx`, `app/eligibility/page.tsx`,
`lib/faq.ts` and `app/llms.txt/route.ts` together — they are four surfaces
stating the same facts, and the one that goes stale is the one nobody
remembers.
