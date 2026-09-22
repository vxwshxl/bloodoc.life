-- Row deletion, and the switch that governs who may do it.
--
-- Deleting was already possible — `donors_delete_admin` and
-- `registrations_delete_admin` have been there since 0001 — but only from the
-- camp page, and only for a whole camp. This adds a delete to every row, which
-- makes the question of *who* urgent in a way it was not when the only way to
-- lose a record was to delete the camp it belonged to.
--
-- The answer is a setting rather than a hardcoded rule, because the two camps
-- this runs are staffed differently: one has an administrator at the table all
-- morning, the other has a volunteer with a laptop who needs to remove the
-- duplicate somebody created by submitting the form twice.

-- ---------------------------------------------------------------------------
-- The settings table
-- ---------------------------------------------------------------------------
--
-- Key/value rather than one row of typed columns. A settings table with a
-- column per setting needs a migration for every new one, and the alternative —
-- a single row with a `jsonb` blob — has no way to say what the valid keys are.
-- This is the middle: a row per setting, so a new one is an insert, with a
-- check constraint naming what may be stored.
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

comment on table app_settings is
  'Console-wide switches an administrator can change. Read by RLS, so the value is the enforcement and not a hint to the UI.';

-- Dropped first so the whole migration stays re-runnable; `create trigger`
-- has no `if not exists` form.
drop trigger if exists app_settings_touch on app_settings;
create trigger app_settings_touch
  before update on app_settings
  for each row execute function touch_updated_at();

alter table app_settings enable row level security;

-- Readable by anybody signed in, because the console has to draw the delete
-- button (or not) for a verifier as well as for an administrator, and a
-- verifier cannot be asked to take on trust that the button they cannot see is
-- the same rule the database is applying. Writable only by administrators —
-- this is the row that decides who may destroy records.
create policy app_settings_read on app_settings for select
  to authenticated using (true);

create policy app_settings_admin_write on app_settings for all
  to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- The setting itself
-- ---------------------------------------------------------------------------
--
-- `admin_only` is the default, and deliberately the one that changes nothing:
-- applying this migration leaves every existing permission exactly as it was.
-- A destructive capability that switches itself on during a deploy is how an
-- upgrade becomes an incident.
insert into app_settings (key, value)
values ('delete_scope', 'admin_only')
on conflict (key) do nothing;

alter table app_settings drop constraint if exists app_settings_known_keys;
alter table app_settings add constraint app_settings_known_keys check (
  case key
    when 'delete_scope' then value in ('admin_only', 'delegated')
    else false
  end
);

/**
 * May the caller delete records they can otherwise act on?
 *
 * Administrators always. Everybody else only while `delete_scope` is
 * `delegated` — and even then the *policies* below still decide which rows,
 * because this function answers "is deletion switched on for you", not "may you
 * delete this one".
 *
 * `security definer` so a verifier can read a settings row the policy above
 * already lets them read — kept consistent with the other helpers rather than
 * relying on that, since a later tightening of `app_settings_read` would
 * otherwise silently revoke every delegated delete.
 */
create or replace function delete_delegated()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select value = 'delegated' from app_settings where key = 'delete_scope'),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Delegated delete policies
-- ---------------------------------------------------------------------------
--
-- Added as *separate* policies rather than by widening the admin ones. Postgres
-- ORs permissive policies together, so `registrations_delete_admin` keeps
-- working untouched and the delegated rule can be read, reasoned about and
-- dropped on its own.
--
-- Registrations only. A verifier removing a duplicate on the roster is the
-- case this exists for; a verifier deleting a donor, a camp or an account is
-- not, and no amount of flipping this setting will let them, because there is
-- no policy here that would.

drop policy if exists registrations_delete_verifier on registrations;
create policy registrations_delete_verifier on registrations for delete
  to authenticated
  using (is_verifier() and delete_delegated());

drop policy if exists registrations_delete_bloodbank on registrations;
create policy registrations_delete_bloodbank on registrations for delete
  to authenticated
  using (is_camp_bloodbank(camp_id) and delete_delegated());

-- The audit trigger already covers `registrations`, so a delegated delete is
-- recorded with the actor's email exactly as an administrator's is. That is
-- most of what makes delegating it acceptable: it is reversible as knowledge,
-- even where the row itself is not.
