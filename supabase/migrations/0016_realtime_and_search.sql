-- Live updates, and a search that does not scan the table.
--
-- Two unrelated-looking changes in one migration because they answer the same
-- complaint: the console feels slow. One half is why a result takes time to
-- come back; the other is why you have to ask for it at all.

-- ---------------------------------------------------------------------------
-- 1. Realtime
-- ---------------------------------------------------------------------------
--
-- Supabase streams row changes over a websocket to any client subscribed to
-- the `supabase_realtime` publication. A table not in the publication emits
-- nothing at all — no error, no rows, just silence — which is the failure this
-- migration exists to prevent.
--
-- What this does NOT do is widen what anybody can read. Realtime checks the
-- same SELECT policies as an ordinary query, per subscriber: a donor
-- subscribed to `registrations` is told about their own rows and nobody
-- else's, because `registrations_select_self` is the only policy that matches
-- them. Adding a table here makes its changes *visible to whoever could
-- already have read them by refreshing*, and nothing more.
--
-- `replica identity full` is what makes a DELETE carry the row that was
-- deleted rather than only its primary key. Without it a deleted registration
-- arrives as an id the browser has no way to match against a filter, and RLS
-- cannot be evaluated against a row that is not there — so Supabase drops the
-- event and the roster keeps showing somebody who has gone.

do $$
declare
  t text;
begin
  -- The publication exists on every Supabase project, but a local
  -- `supabase start` or a self-hosted Postgres has no such guarantee, and
  -- `alter publication` on one that is missing fails the whole migration.
  -- `create publication` has no `if not exists` form, hence the lookup.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'camps',
    'registrations',
    'donors',
    'certificates',
    'partners',
    'partner_members',
    'camp_partners',
    'profiles',
    'email_log',
    'audit_log'
  ]
  loop
    -- Idempotent: `add table` errors if it is already a member, and this
    -- migration has to be safe to re-run against a project where somebody
    -- clicked the toggle in the dashboard first.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;

    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Search
-- ---------------------------------------------------------------------------
--
-- Every search in the console is `ilike '%term%'`, and a leading wildcard is
-- exactly what a btree index cannot help with — Postgres reads every row and
-- lowercases every name to answer "arnab". That is imperceptible at seventy
-- donors and is not at seventy thousand, which is one busy university's worth.
--
-- Trigram indexes are the fix: `gin_trgm_ops` indexes every three-character
-- run, so an infix match becomes an index lookup. They are the reason `pg_trgm`
-- exists.
--
-- In `extensions`, not `public`: that is where Supabase puts extensions, and a
-- function resolved at CREATE time against the wrong search_path is how
-- `gen_random_bytes` broke in 0008.
create extension if not exists pg_trgm with schema extensions;

create index if not exists donors_full_name_trgm
  on donors using gin (full_name extensions.gin_trgm_ops);
create index if not exists donors_email_trgm
  on donors using gin (email extensions.gin_trgm_ops);
create index if not exists donors_phone_trgm
  on donors using gin (phone extensions.gin_trgm_ops);

create index if not exists camps_title_trgm
  on camps using gin (title extensions.gin_trgm_ops);

create index if not exists partners_name_trgm
  on partners using gin (name extensions.gin_trgm_ops);

create index if not exists profiles_email_trgm
  on profiles using gin (email extensions.gin_trgm_ops);
create index if not exists profiles_full_name_trgm
  on profiles using gin (full_name extensions.gin_trgm_ops);

create index if not exists email_log_to_email_trgm
  on email_log using gin (to_email extensions.gin_trgm_ops);

-- The roster is always read newest-first within one camp, and that pair is
-- what `listRegistrations` orders and filters on. A single-column index on
-- `camp_id` still leaves the sort to be done by hand.
create index if not exists registrations_camp_created
  on registrations (camp_id, created_at desc);
