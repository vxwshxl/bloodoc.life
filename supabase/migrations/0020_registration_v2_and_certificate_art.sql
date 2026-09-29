-- --------------------------------------------------------------------------
-- Registration form, second pass, and per-camp certificate artwork.
--
-- Donors gain four columns, all nullable because rows written before this
-- migration have none of them. "Required" is enforced by the form's Zod
-- schema, which is the only public writer (lib/donors/actions.ts); making them
-- `not null` here would need a value invented for every existing donor.
--
--   father_title / mother_title — "Mr." / "Mrs." / "Lt." (late) before a
--       parent's name. Kept apart from the name rather than prefixed into it,
--       so the name column still sorts and searches on the name, and a title
--       that changes (a parent who has since died) is one field, not a string
--       edit.
--   permanent_address — `address` stays and now means the residential one.
--       Renaming it would break every query and export that already reads it.
--   school — the RGU school, stored as its display name. `department` keeps
--       holding the department within it.
--
-- `donors` and `camps` already have RLS and their policies (0001, 0008); new
-- columns are covered by them and need nothing here.
-- --------------------------------------------------------------------------
alter table donors
  add column father_title text
    constraint donors_father_title_known check (father_title in ('mr', 'late')),
  add column mother_title text
    constraint donors_mother_title_known check (mother_title in ('mrs', 'late')),
  add column permanent_address text,
  add column school text;

-- --------------------------------------------------------------------------
-- Which certificate design a camp's donors receive.
--
-- A key into `CERTIFICATE_ART` in lib/certificates/artwork.ts, which holds the
-- image and where the donor's name is printed on it. Null is the standard
-- design drawn from the camp's own data. Not a check constraint: adding a
-- design is a file and a code entry, and should not also need a migration.
-- --------------------------------------------------------------------------
alter table camps add column certificate_art text;

-- The organisers' artwork for the 6 October 2026 drive at RGU. Matches nothing
-- on a database that does not have that camp, which is the intended no-op.
update camps
   set certificate_art = 'rgu-mega-drive-2026'
 where title ilike '%mega blood donation drive%'
   and (starts_at at time zone 'Asia/Kolkata')::date = date '2026-10-06';
