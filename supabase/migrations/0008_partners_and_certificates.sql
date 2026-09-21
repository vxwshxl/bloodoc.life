-- Partners, partner panels, and e-certificates.
--
-- Until now a camp's collaborators were three text columns on `camps`
-- (`collaboration`, `partner_name`, `partner_note`). That was enough to print
-- "in collaboration with …" on the camp page and nothing else. It cannot
-- answer "show me every camp this blood bank received units from", it cannot
-- be logged into, and two camps naming the same body have no idea they mean
-- the same body.
--
-- So the collaborating bodies become rows. A camp links to as many as it has,
-- each body has members who sign in with their own email and see only their
-- own camps, and the whole thing is data rather than prose — a second blood
-- bank or a third NSS unit is an INSERT, not a migration.
--
-- The text columns are deliberately left in place. They are what the public
-- camp page renders today, and dropping them in the same migration that adds
-- the replacement would mean a deploy where the page is briefly wrong. 0009
-- can remove them once the page reads `camp_partners`.

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------

-- What kind of body this is. It drives permissions, not just a label: a blood
-- bank is clinically responsible for the donation and may record its outcome,
-- an organisation mobilises donors and may not.
create type partner_kind as enum ('organisation', 'blood_bank');

-- Within one partner. `owner` may invite and remove colleagues; `member` may
-- only do the partner's own work. Two values because a third ("viewer") would
-- need a reason, and read-only is already what an organisation member gets.
create type partner_member_role as enum ('owner', 'member');

-- A certificate is minted the moment a donation is recorded, but it is not
-- valid until a human confirms it. `pending` is that gap. `revoked` exists
-- because a certificate issued against a registration later found to be a
-- duplicate has to be withdrawable without deleting the audit trail.
create type certificate_status as enum ('pending', 'approved', 'revoked');

-- --------------------------------------------------------------------------
-- partners — the collaborating bodies.
-- --------------------------------------------------------------------------
create table partners (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  -- What fits in a table cell and a certificate footer. "NSS, RGU" rather than
  -- "National Service Scheme, The Royal Global University".
  short_name         text,
  kind               partner_kind not null,
  -- "Gauhati Medical College & Hospital" for a blood centre inside a hospital,
  -- "The Royal Global University" for a campus NSS unit. Printed under the
  -- name wherever the name alone would be ambiguous.
  parent_institution text,
  city               text,
  address            text,
  contact_email      text,
  contact_phone      text,
  website            text,
  logo_url           text,
  -- A partner that has stopped collaborating. Not deleted: their past camps
  -- and the certificates naming them must keep resolving.
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index partners_kind_idx   on partners (kind, active);
create index partners_active_idx on partners (active);

-- --------------------------------------------------------------------------
-- partner_members — who may sign into a partner's panel.
--
-- `email` is the invite and `profile_id` is the claim. An admin adds a row with
-- an address and nothing else; when that person signs in with it, the signup
-- trigger fills `profile_id` and the panel appears. This is what "they get
-- their own panel if their email is provided" means, and it is the same
-- unclaimed-row pattern `donors` already uses.
-- --------------------------------------------------------------------------
create table partner_members (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners (id) on delete cascade,
  profile_id uuid references profiles (id) on delete set null,
  email      text not null,
  full_name  text,
  title      text,                    -- "Camp Coordinator", "Blood Bank Officer"
  role       partner_member_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One invite per address per partner, case-insensitively. Expression unique, so
-- it cannot be a table constraint.
create unique index partner_members_unique_email
  on partner_members (partner_id, lower(email));

-- The lookup every RLS helper below makes.
create index partner_members_profile_idx on partner_members (profile_id);
create index partner_members_email_idx   on partner_members (lower(email));

-- --------------------------------------------------------------------------
-- camp_partners — which bodies ran which camp.
--
-- `role` is stored per camp rather than read from `partners.kind` because the
-- same body can appear in different capacities: a hospital blood centre is the
-- blood bank at its own drive and a collaborating organisation at someone
-- else's awareness camp. The check keeps it honest anyway — a body may only
-- act as a blood bank if it is one.
-- --------------------------------------------------------------------------
create table camp_partners (
  camp_id    uuid not null references camps (id) on delete cascade,
  partner_id uuid not null references partners (id) on delete cascade,
  role       partner_kind not null,
  -- The body whose name leads. Exactly one per camp is the intent; not a
  -- constraint, because a genuinely equal two-host drive should not be blocked
  -- at 2am by a rule nobody remembers writing.
  is_host    boolean not null default false,
  -- Ordering on the public camp page, lowest first.
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (camp_id, partner_id)
);

create index camp_partners_partner_idx on camp_partners (partner_id);

-- --------------------------------------------------------------------------
-- certificates — one per donation.
--
-- Keyed on the registration, not the donor: a donor who gives at three camps
-- has three certificates, and the registration is the only thing that knows
-- which camp, which date and which blood bank.
-- --------------------------------------------------------------------------
create table certificates (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references registrations (id) on delete cascade,
  -- The public handle, printed on the certificate and typed into /verify.
  -- Unique and non-sequential: a sequential code lets anyone enumerate every
  -- donor who ever gave.
  code            text not null unique,
  status          certificate_status not null default 'pending',
  issued_at       timestamptz,
  issued_by       uuid references profiles (id) on delete set null,
  revoked_at      timestamptz,
  revoked_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index certificates_status_idx on certificates (status);

-- --------------------------------------------------------------------------
-- Certificate codes and auto-minting.
-- --------------------------------------------------------------------------

-- BD-2026-9F3A7C. Year so a code reads as belonging to a drive; six hex
-- characters (16.7M) so it cannot be guessed or walked. The unique index is
-- the real guarantee — this only has to avoid collisions often enough that
-- the retry loop below terminates.
create or replace function mint_certificate_code()
returns text
language sql
volatile
as $$
  select 'BD-' || to_char(now(), 'YYYY') || '-' ||
         upper(encode(gen_random_bytes(3), 'hex'));
$$;

-- A donation recorded is a certificate owed. Doing it here rather than in the
-- server action means a unit entered from a paper slip, by an import, or by an
-- admin fixing a status all produce one — there is no path that records a
-- donation and forgets the certificate.
--
-- It is minted `pending`. Someone still has to approve it.
create or replace function handle_registration_donated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt int := 0;
begin
  if new.status = 'donated' then
    loop
      begin
        insert into public.certificates (registration_id, code)
        values (new.id, mint_certificate_code())
        on conflict (registration_id) do nothing;
        exit;
      exception when unique_violation then
        -- A code collision, not a duplicate registration. Try another.
        attempt := attempt + 1;
        if attempt >= 5 then raise; end if;
      end;
    end loop;
  end if;
  return new;
end;
$$;

create trigger registrations_mint_certificate
  after insert or update of status on registrations
  for each row execute function handle_registration_donated();

-- --------------------------------------------------------------------------
-- Claiming an invite on signup.
--
-- Extends the existing trigger rather than adding a second one on the same
-- table: two triggers on auth.users with an undefined order, both writing
-- profiles, is a race waiting to be debugged at the worst moment.
-- --------------------------------------------------------------------------
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

  update public.donors
     set profile_id = new.id
   where lower(email) = lower(new.email)
     and profile_id is null;

  -- The partner invite. Same rule as the donor link: only an unclaimed row,
  -- only an exact address match. A member row already pointing at somebody is
  -- never re-pointed by a re-used address.
  update public.partner_members
     set profile_id = new.id,
         updated_at = now()
   where lower(email) = lower(new.email)
     and profile_id is null;

  update public.profiles p
     set full_name = d.full_name
    from public.donors d
   where p.id = new.id
     and p.full_name is null
     and d.profile_id = new.id;

  -- A partner member who is not a donor still has a name worth having.
  update public.profiles p
     set full_name = m.full_name
    from public.partner_members m
   where p.id = new.id
     and p.full_name is null
     and m.full_name is not null
     and m.profile_id = new.id;

  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- RLS helpers.
--
-- All `security definer` with a pinned search_path, for the same two reasons
-- as `is_admin()`: a policy on partner_members that had to SELECT
-- partner_members to evaluate itself is infinite recursion, and a definer
-- function resolving its tables through a caller-controlled search_path is a
-- privilege-escalation hole.
-- --------------------------------------------------------------------------

-- Every partner the caller belongs to.
create or replace function my_partner_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select partner_id from partner_members where profile_id = auth.uid();
$$;

-- Partners the caller owns — the ones whose membership list they may edit.
create or replace function my_owned_partner_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select partner_id from partner_members
   where profile_id = auth.uid() and role = 'owner';
$$;

-- Is the caller on the roster of any body attached to this camp, in any
-- capacity? This is the read gate.
create or replace function is_camp_partner(target_camp uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from camp_partners cp
      join partner_members pm on pm.partner_id = cp.partner_id
     where cp.camp_id = target_camp
       and pm.profile_id = auth.uid()
  );
$$;

-- Is the caller there as the blood bank? This is the write gate: recording a
-- screening result or a donation is a clinical act, and the organisation that
-- mobilised the donors is not the body that performs it.
create or replace function is_camp_bloodbank(target_camp uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from camp_partners cp
      join partner_members pm on pm.partner_id = cp.partner_id
     where cp.camp_id = target_camp
       and cp.role = 'blood_bank'
       and pm.profile_id = auth.uid()
  );
$$;

-- Does the caller partner any camp this donor is registered for?
--
-- Donor rows are shared with partners in full, contact details included: the
-- blood bank calls donors back for results and the organisation runs the
-- reminder list, and a masked roster would push both onto a WhatsApp
-- spreadsheet that has no policies at all. The scope is the camp — a partner
-- sees a donor because that donor came to their drive, never otherwise.
create or replace function shares_camp_with_donor(target_donor uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from registrations r
      join camp_partners cp on cp.camp_id = r.camp_id
      join partner_members pm on pm.partner_id = cp.partner_id
     where r.donor_id = target_donor
       and pm.profile_id = auth.uid()
  );
$$;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
alter table partners        enable row level security;
alter table partner_members enable row level security;
alter table camp_partners   enable row level security;
alter table certificates    enable row level security;

-- partners: the name, city and parent institution of an active body are
-- printed on a public camp page, so the row is public. Contact details are on
-- the same row and are also the ones already published on a letterhead.
create policy partners_select_public on partners for select
  using (active or is_admin() or id in (select my_partner_ids()));
create policy partners_admin_all on partners for all
  using (is_admin()) with check (is_admin());
-- An owner keeps their own contact details current without an admin.
create policy partners_update_own on partners for update
  using (id in (select my_owned_partner_ids()))
  with check (id in (select my_owned_partner_ids()));

-- partner_members: never public. A member sees their colleagues; an owner
-- manages them.
create policy partner_members_select_own on partner_members for select
  using (is_admin() or partner_id in (select my_partner_ids()));
create policy partner_members_owner_write on partner_members for all
  using (partner_id in (select my_owned_partner_ids()))
  with check (partner_id in (select my_owned_partner_ids()));
create policy partner_members_admin_all on partner_members for all
  using (is_admin()) with check (is_admin());

-- camp_partners: public, for the same reason as `partners`. Who ran a drive is
-- the first thing a donor checks before turning up.
create policy camp_partners_select_public on camp_partners for select
  using (
    is_admin()
    or partner_id in (select my_partner_ids())
    or exists (select 1 from camps c where c.id = camp_id and c.status = 'published')
  );
create policy camp_partners_admin_all on camp_partners for all
  using (is_admin()) with check (is_admin());

-- certificates: the donor's own, the partners of the camp it was earned at,
-- and admins. The public /verify page does NOT read through this policy — it
-- goes through the service role, because a stranger holding a code has no
-- session and is shown only what the printed certificate already says.
create policy certificates_select_scoped on certificates for select
  using (
    is_admin()
    or exists (
      select 1 from registrations r
       where r.id = registration_id
         and (r.donor_id = my_donor_id() or is_camp_partner(r.camp_id))
    )
  );
-- Approving and revoking is the blood bank's call, or an admin's.
create policy certificates_bloodbank_write on certificates for update
  using (
    is_admin()
    or exists (select 1 from registrations r
                where r.id = registration_id and is_camp_bloodbank(r.camp_id))
  )
  with check (
    is_admin()
    or exists (select 1 from registrations r
                where r.id = registration_id and is_camp_bloodbank(r.camp_id))
  );
create policy certificates_admin_all on certificates for all
  using (is_admin()) with check (is_admin());

-- --------------------------------------------------------------------------
-- Widening the existing policies.
--
-- These four tables already had policies written for a two-role world. Each
-- gets one additional policy rather than a rewrite of the existing one:
-- policies are OR-ed, so an added policy can only widen, and the donor-facing
-- rules stay literally unchanged and re-readable in 0001.
-- --------------------------------------------------------------------------

-- A partner reads the roster of their own camps.
create policy registrations_select_partner on registrations for select
  using (is_camp_partner(camp_id));

-- The blood bank records what happened at the desk: status, vitals,
-- hemoglobin, deferral reason. `with check` repeats the condition so a row
-- cannot be updated out of the caller's own camp.
create policy registrations_update_bloodbank on registrations for update
  using (is_camp_bloodbank(camp_id))
  with check (is_camp_bloodbank(camp_id));

-- Walk-ins. A blood bank desk entering a paper slip needs the row to exist.
create policy registrations_insert_bloodbank on registrations for insert
  with check (is_camp_bloodbank(camp_id));

-- Donor records, scoped to the camps the caller partners.
create policy donors_select_partner on donors for select
  using (shares_camp_with_donor(id));

-- The desk also has to be able to create and correct the donor behind a
-- walk-in. Insert is unscoped by necessity — the donor has no registration yet
-- at the moment the row is written, so there is nothing to scope against.
create policy donors_insert_bloodbank on donors for insert
  with check (exists (select 1 from camp_partners cp
                       join partner_members pm on pm.partner_id = cp.partner_id
                      where cp.role = 'blood_bank' and pm.profile_id = auth.uid()));
create policy donors_update_partner on donors for update
  using (shares_camp_with_donor(id))
  with check (shares_camp_with_donor(id));

-- A partner member needs to read the profile behind a colleague's membership
-- row, or the panel shows an email address where a name belongs.
create policy profiles_select_partner_colleague on profiles for select
  using (exists (
    select 1 from partner_members a
     where a.profile_id = profiles.id
       and a.partner_id in (select my_partner_ids())
  ));

-- --------------------------------------------------------------------------
-- Seed: the two bodies behind the 2026 drive, and the camp they share.
--
-- Idempotent on the slug throughout, so the migration set replays onto a fresh
-- database without duplicating either body.
-- --------------------------------------------------------------------------
insert into partners (slug, name, short_name, kind, parent_institution, city, active)
values
  ('soa-model-blood-centre',
   'State of the Art Model Blood Centre',
   'SoA Model Blood Centre',
   'blood_bank',
   'Gauhati Medical College & Hospital',
   'Guwahati',
   true),
  ('terapanth-yuvak-parishad-guwahati',
   'Terapanth Yuvak Parishad, Guwahati',
   'Terapanth Yuvak Parishad',
   'organisation',
   null,
   'Guwahati',
   true),
  ('nss-royal-global-university',
   'NSS, Royal Global University',
   'NSS, RGU',
   'organisation',
   'The Royal Global University',
   'Guwahati',
   true)
on conflict (slug) do nothing;

-- The drive itself.
update camps
   set title = 'Mega Blood Donation Drive Camp 2026'
 where slug = 'world-blood-camp-2026';

-- NSS hosts, Terapanth collaborates, the blood centre receives the units.
insert into camp_partners (camp_id, partner_id, role, is_host, sort_order)
select c.id, p.id, p.kind, p.slug = 'nss-royal-global-university', s.ord
  from camps c
  join (values
          ('nss-royal-global-university', 0::smallint),
          ('terapanth-yuvak-parishad-guwahati', 1::smallint),
          ('soa-model-blood-centre', 2::smallint)
       ) as s(slug, ord) on true
  join partners p on p.slug = s.slug
 where c.slug = 'world-blood-camp-2026'
on conflict (camp_id, partner_id) do nothing;

-- --------------------------------------------------------------------------
-- Backfill: certificates for donations already recorded before the trigger
-- existed. Without this, everyone who gave at an earlier camp has no
-- certificate and no way to get one.
-- --------------------------------------------------------------------------
insert into certificates (registration_id, code)
select r.id, mint_certificate_code()
  from registrations r
 where r.status = 'donated'
on conflict (registration_id) do nothing;
