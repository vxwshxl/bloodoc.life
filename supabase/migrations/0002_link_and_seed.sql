-- Two things: make a donor record find its account, and put the first camp in.

-- --------------------------------------------------------------------------
-- A donor who filled the public form before ever signing in has a `donors` row
-- with no `profile_id`. When they later sign in with the same address, the two
-- have to meet — otherwise /me shows them nothing and they fill the form again.
--
-- This happens in the same trigger that creates the profile, because doing it
-- in the sign-in action would leave anyone who was created another way (an
-- admin invite, a seed) permanently unlinked.
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

  -- Only an unclaimed record, and only an exact address match. `profile_id is
  -- null` is what stops a re-used address from stealing a linked donor.
  update public.donors
     set profile_id = new.id
   where lower(email) = lower(new.email)
     and profile_id is null;

  -- If that donor gave a name and the account has none, carry it across so the
  -- console and the emails are not addressed to an email address.
  update public.profiles p
     set full_name = d.full_name
    from public.donors d
   where p.id = new.id
     and p.full_name is null
     and d.profile_id = new.id;

  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- The first camp. Idempotent on the slug so re-running the migration set on a
-- fresh database does not create a second one.
-- --------------------------------------------------------------------------
insert into camps (slug, title, summary, venue, city, starts_at, ends_at, capacity, organiser, status)
values (
  'world-blood-camp-2026',
  'BlooDoc Blood Donation Camp 2026',
  'One morning. One unit of blood. Up to three lives. Walk in, give, and be out inside the hour — screening, donation and refreshments are all on site.',
  'University Auditorium, Central Campus',
  'Guwahati',
  -- 25 September 2026, 9:00am–4:00pm IST, stored as UTC.
  '2026-09-25T03:30:00Z',
  '2026-09-25T10:30:00Z',
  300,
  'BlooDoc, with the District Blood Centre',
  'published'
)
on conflict (slug) do nothing;
