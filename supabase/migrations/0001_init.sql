-- BlooDoc — initial schema.
--
-- Four things live here: who a person is (profiles), who they are as a donor
-- (donors), what events exist (camps), and who signed up for which (registrations).
--
-- The split between `donors` and `registrations` is the one modelling decision
-- worth naming. A person's name, parentage, blood group and date of birth do not
-- change between camps; their weight, blood pressure, current medication and
-- donation count do. Storing vitals on the donor would mean the September camp
-- overwrote what the March camp measured, and the screening record — the only
-- reason a blood bank keeps this data at all — would be a single mutable row
-- with no history. Vitals therefore belong to the visit.

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Enums. Declared rather than left as free text because every one of these is
-- read back by a filter in the console, and a column that can hold both "O+"
-- and "O positive" cannot answer "how many O+ donors do we have".
-- --------------------------------------------------------------------------
create type user_role as enum ('admin', 'donor');
create type donor_kind as enum ('student', 'faculty', 'staff', 'other');
create type sex_type as enum ('male', 'female', 'other');
create type blood_group as enum ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown');
create type camp_status as enum ('draft', 'published', 'closed');
create type registration_status as enum ('registered', 'screened', 'donated', 'deferred', 'cancelled');

-- --------------------------------------------------------------------------
-- profiles — one row per auth user, created by a trigger on signup.
--
-- Role lives here and nowhere else. It is deliberately NOT in the JWT: a role
-- baked into a token stays valid until the token expires, so demoting an admin
-- would not take effect for up to an hour. Every policy reads this table.
-- --------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        user_role not null default 'donor',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on profiles (role);

-- --------------------------------------------------------------------------
-- donors — the identity half of the registration form.
--
-- `profile_id` is nullable on purpose: a camp volunteer entering a walk-in
-- donor from a paper slip has a person with no account, and refusing to record
-- them would push that data back onto paper, which is the thing this replaces.
-- --------------------------------------------------------------------------
create table donors (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid unique references profiles (id) on delete set null,

  full_name     text not null,
  sex           sex_type not null,
  date_of_birth date,
  -- Age as stated on the form. Kept alongside the date of birth rather than
  -- derived from it, because a walk-in often gives an age and no birth date,
  -- and a computed column would then read 0.
  age           smallint check (age is null or (age between 12 and 120)),

  father_name   text,
  mother_name   text,

  kind          donor_kind not null default 'other',
  occupation    text,
  -- Department for a student, faculty for a teacher. One column: the form has
  -- one box, and two nullable columns of which exactly one is ever filled is a
  -- worse shape to query than one column plus `kind`.
  department    text,

  email         text not null,
  phone         text not null,
  alt_phone     text,
  address       text,

  blood_group   blood_group not null default 'unknown',
  -- Lifetime count as last stated. The authoritative count is
  -- `select count(*) from registrations where status = 'donated'`; this is what
  -- the donor reported on their first form, including donations made elsewhere.
  prior_donations smallint not null default 0 check (prior_donations >= 0),

  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index donors_email_idx      on donors (lower(email));
create index donors_phone_idx      on donors (phone);
create index donors_blood_idx      on donors (blood_group);
create index donors_kind_idx       on donors (kind);
create index donors_profile_idx    on donors (profile_id);

-- --------------------------------------------------------------------------
-- camps — the events. The landing hero reads the next published one.
-- --------------------------------------------------------------------------
create table camps (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  summary     text,
  venue       text not null,
  city        text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  capacity    integer check (capacity is null or capacity > 0),
  organiser   text,
  contact_phone text,
  status      camp_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index camps_status_starts_idx on camps (status, starts_at);

-- --------------------------------------------------------------------------
-- registrations — one person at one camp, with the vitals taken that day.
-- --------------------------------------------------------------------------
create table registrations (
  id            uuid primary key default gen_random_uuid(),
  camp_id       uuid not null references camps (id) on delete cascade,
  donor_id      uuid not null references donors (id) on delete cascade,

  status        registration_status not null default 'registered',
  -- The form's "First time donor — Yes / No". Recorded as the donor answered
  -- it, not inferred: someone who has donated at another bank is not a first
  -- timer even though this is their first row here.
  first_time    boolean not null default false,

  height_cm     numeric(5,1) check (height_cm is null or height_cm between 100 and 250),
  weight_kg     numeric(5,1) check (weight_kg is null or weight_kg between 30 and 300),
  bp_systolic   smallint check (bp_systolic is null or bp_systolic between 60 and 260),
  bp_diastolic  smallint check (bp_diastolic is null or bp_diastolic between 30 and 160),
  medications   text,

  -- Why a donor was turned away. Free text, because the reasons are clinical
  -- and an enum written by a developer would be wrong within a month.
  deferral_reason text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One registration per person per camp. Without this a double-submitted form
  -- puts the same donor on the roster twice and the capacity count lies.
  unique (camp_id, donor_id)
);

create index registrations_camp_idx   on registrations (camp_id);
create index registrations_donor_idx  on registrations (donor_id);
create index registrations_status_idx on registrations (camp_id, status);

-- --------------------------------------------------------------------------
-- email_otps — sign-in codes.
--
-- Only the hash is stored. RLS is enabled with no policies at all, so the table
-- is unreachable from any browser session at the database floor; every read and
-- write goes through the service-role client in lib/auth/otp.ts.
-- --------------------------------------------------------------------------
create table email_otps (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,
  purpose     text not null default 'signin',
  attempts    smallint not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index email_otps_lookup_idx on email_otps (email, purpose, created_at desc);

-- --------------------------------------------------------------------------
-- email_log — what was sent, to whom, and whether the provider took it.
-- --------------------------------------------------------------------------
create table email_log (
  id          uuid primary key default gen_random_uuid(),
  to_email    text not null,
  subject     text not null,
  template    text,
  ok          boolean not null,
  provider_id text,
  error       text,
  created_at  timestamptz not null default now()
);

create index email_log_created_idx on email_log (created_at desc);

-- --------------------------------------------------------------------------
-- Helpers
-- --------------------------------------------------------------------------

-- `security definer` so the policies below can read `profiles` without needing
-- a select policy on it that would itself have to call this function. Search
-- path is pinned: a definer function that resolves `profiles` through a
-- caller-controlled search_path is a privilege-escalation hole.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- The donor row belonging to the caller, for the policies below.
create or replace function my_donor_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from donors where profile_id = auth.uid();
$$;

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch      before update on profiles      for each row execute function touch_updated_at();
create trigger donors_touch        before update on donors        for each row execute function touch_updated_at();
create trigger camps_touch         before update on camps         for each row execute function touch_updated_at();
create trigger registrations_touch before update on registrations for each row execute function touch_updated_at();

-- A profile for every new auth user. Without this, the first thing a freshly
-- signed-in donor hits is a policy that reads a row that does not exist yet.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- --------------------------------------------------------------------------
-- Row level security. Enabled on every table, with policies written as the
-- table is created — retrofitting RLS onto a live schema is the single most
-- painful thing to do in this stack.
-- --------------------------------------------------------------------------
alter table profiles      enable row level security;
alter table donors        enable row level security;
alter table camps         enable row level security;
alter table registrations enable row level security;
alter table email_otps    enable row level security;  -- no policies: service role only
alter table email_log     enable row level security;

-- profiles: you, or an admin.
create policy profiles_select_self on profiles for select
  using (id = auth.uid() or is_admin());
create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));
create policy profiles_admin_all on profiles for all
  using (is_admin()) with check (is_admin());

-- donors: your own record, or an admin's view of everyone.
create policy donors_select_self on donors for select
  using (profile_id = auth.uid() or is_admin());
create policy donors_insert_self on donors for insert
  with check (profile_id = auth.uid() or is_admin());
create policy donors_update_self on donors for update
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());
create policy donors_delete_admin on donors for delete using (is_admin());

-- camps: a published camp is public, including to anonymous visitors — the
-- landing page reads the next one before anybody has signed in. Drafts are
-- admin-only, which is what makes "draft" mean anything.
create policy camps_select_published on camps for select
  using (status = 'published' or is_admin());
create policy camps_write_admin on camps for all
  using (is_admin()) with check (is_admin());

-- registrations: your own, or an admin's. A roster names who is coming to give
-- blood and what medication they are on; it is never readable donor-to-donor.
create policy registrations_select_self on registrations for select
  using (donor_id = my_donor_id() or is_admin());
create policy registrations_insert_self on registrations for insert
  with check (donor_id = my_donor_id() or is_admin());
create policy registrations_update_self on registrations for update
  using (donor_id = my_donor_id() or is_admin())
  with check (donor_id = my_donor_id() or is_admin());
create policy registrations_delete_admin on registrations for delete using (is_admin());

-- email_log: admins read it; only the service role writes it.
create policy email_log_select_admin on email_log for select using (is_admin());
