-- The first account to sign in becomes the administrator.
--
-- Until now every profile was created with the column default, `donor`, and the
-- first admin had to be promoted by hand with SQL — which means a fresh deploy
-- has no way into its own console without someone opening the Supabase
-- dashboard. Bootstrapping it here makes the very first sign-in sufficient.
--
-- It lives in the signup trigger rather than in a server action because that is
-- the one place every account creation passes through: an invite, a seed, or a
-- future OAuth provider all land here, and none of them can skip it.
--
-- The `not exists` check is not serialisable — two people signing in for the
-- very first time in the same instant could both read an empty table and both
-- become admin. That is left as is deliberately: locking the whole table on
-- every signup forever to defend the first second of a deployment's life is a
-- bad trade, and the realistic failure (the founder and a colleague both
-- getting admin on day zero) is one row of SQL to correct.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assigned_role user_role := 'donor';
  -- The project's own addresses. Whoever holds these mailboxes runs the site,
  -- so they are admin on sight rather than after somebody remembers to promote
  -- them. Mirrored in OFFICIAL_ADMIN_EMAILS in lib/auth/actions.ts, which has
  -- to let the same addresses past the "have you registered" gate — the two
  -- lists must be changed together.
  official_admins text[] := array['bloodoclife@gmail.com', 'hello@bloodoc.life'];
begin
  -- Empty table means this is the founding account.
  if not exists (select 1 from public.profiles) then
    assigned_role := 'admin';
  end if;

  if lower(new.email) = any (official_admins) then
    assigned_role := 'admin';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    assigned_role
  )
  on conflict (id) do nothing;

  -- Claim an unclaimed donor record with the same address. Only an unclaimed
  -- one, and only an exact match: `profile_id is null` is what stops a re-used
  -- address from stealing a donor who already belongs to somebody.
  update public.donors
     set profile_id = new.id
   where lower(email) = lower(new.email)
     and profile_id is null;

  -- Same rule for a partner invite.
  update public.partner_members
     set profile_id = new.id,
         updated_at = now()
   where lower(email) = lower(new.email)
     and profile_id is null;

  -- Carry a name across so the console and the emails are not addressed to an
  -- email address.
  update public.profiles p
     set full_name = d.full_name
    from public.donors d
   where p.id = new.id
     and p.full_name is null
     and d.profile_id = new.id;

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

-- Promote the official addresses if either already signed in before this
-- migration landed. An `update` rather than a manual fix so a redeploy onto an
-- existing database ends in the same state as a fresh one.
update public.profiles
   set role = 'admin', updated_at = now()
 where lower(email) in ('bloodoclife@gmail.com', 'hello@bloodoc.life')
   and role <> 'admin';
