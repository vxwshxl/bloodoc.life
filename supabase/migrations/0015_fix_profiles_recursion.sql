-- Fix: infinite recursion in the profiles update policy.
--
--   ERROR 42P17: infinite recursion detected in policy for relation "profiles"
--
-- `profiles_update_self` (0001) reads `profiles` inside its own WITH CHECK:
--
--   with check (id = auth.uid()
--               and role = (select role from profiles p where p.id = auth.uid()))
--
-- Evaluating that subquery applies the policies on `profiles`, which evaluates
-- the subquery again. Postgres detects the loop and refuses the statement.
--
-- The intent was right and is kept: you may edit your own row, but you may not
-- promote yourself by putting a different value in `role`. The mistake was
-- reading the table directly instead of through a `security definer` function,
-- which is exactly what `is_admin()` already does a few lines above it and
-- exactly why that one never had this problem.
--
-- Why it surfaced only now: nothing had ever updated `profiles` through a user
-- session. Roles were changed by scripts/make-admin.mjs on the service role,
-- which bypasses RLS entirely, and by the signup trigger, which is `security
-- definer`. The console's Users page is the first caller to come through a
-- session — so the bug is as old as 0001 and was simply never reachable.

create or replace function my_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from profiles where id = auth.uid();
$$;

comment on function my_role() is
  'The caller''s own role, read without RLS so policies on `profiles` can compare against it without recursing.';

drop policy if exists profiles_update_self on profiles;

create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  -- Same rule as before — your own row, and `role` unchanged — but the
  -- comparison now goes through a definer function rather than a subquery on
  -- the table this policy guards.
  with check (id = auth.uid() and role = my_role());
