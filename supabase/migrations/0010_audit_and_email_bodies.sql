-- An audit trail, and email bodies worth previewing.

-- --------------------------------------------------------------------------
-- email_log.html — what was actually sent.
--
-- The log recorded that a message went out and to whom, but not what it said,
-- so "the donor says the date in the email is wrong" had no answer except to
-- re-render the template as it exists today, which is not what they received.
-- Storing the body makes the log evidential rather than statistical.
-- --------------------------------------------------------------------------
alter table email_log
  add column html text;

comment on column email_log.html is
  'The rendered body as sent. Null for rows written before this column existed.';

-- --------------------------------------------------------------------------
-- audit_log — who changed what.
--
-- Written by a trigger, never by the application. An audit trail the app is
-- responsible for appending to is one `await` away from being incomplete, and
-- the rows that go missing are exactly the ones written by the code path
-- somebody forgot about. At the database floor there is no such path.
--
-- `actor_id` is nullable on purpose: a row written by the service role (the
-- public registration form, the OTP mailer) genuinely has no authenticated
-- actor, and recording that honestly is better than attributing it to whoever
-- happened to be signed in.
-- --------------------------------------------------------------------------
create type audit_action as enum ('insert', 'update', 'delete');

create table audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references profiles (id) on delete set null,
  -- Denormalised deliberately. The point of an audit row is to still make
  -- sense after the account that wrote it is deleted, and a join that resolves
  -- to null tells you nothing about who did it.
  actor_email text,
  action      audit_action not null,
  table_name  text not null,
  record_id   text,
  -- For an update, only the columns that actually changed, as
  -- {"col": {"from": …, "to": …}}. For an insert or a delete, the whole row.
  -- Storing a full before-and-after on every update would triple the table for
  -- the one column somebody edited.
  changes     jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on audit_log (created_at desc);
create index audit_log_table_idx   on audit_log (table_name, created_at desc);
create index audit_log_actor_idx   on audit_log (actor_id, created_at desc);
create index audit_log_record_idx  on audit_log (table_name, record_id);

-- Columns never worth recording. `updated_at` changes on every write by
-- definition, so logging it means every diff has a line of noise in it.
create or replace function audit_skip_columns()
returns text[]
language sql
immutable
as $$ select array['updated_at'] $$;

create or replace function record_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor      uuid := auth.uid();
  actor_mail text;
  diff       jsonb := '{}'::jsonb;
  old_j      jsonb;
  new_j      jsonb;
  k          text;
begin
  if actor is not null then
    select email into actor_mail from public.profiles where id = actor;
  end if;

  if tg_op = 'INSERT' then
    diff := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    diff := to_jsonb(old);
  else
    old_j := to_jsonb(old);
    new_j := to_jsonb(new);
    -- Only the keys whose values differ. `is distinct from` rather than `<>`
    -- so a column going to or from null counts as a change.
    for k in select jsonb_object_keys(new_j) loop
      if k <> all (audit_skip_columns())
         and (old_j -> k) is distinct from (new_j -> k) then
        diff := diff || jsonb_build_object(
          k, jsonb_build_object('from', old_j -> k, 'to', new_j -> k)
        );
      end if;
    end loop;
    -- An update that changed nothing but `updated_at` is not an event.
    if diff = '{}'::jsonb then
      return coalesce(new, old);
    end if;
  end if;

  insert into public.audit_log (actor_id, actor_email, action, table_name, record_id, changes)
  values (
    actor,
    actor_mail,
    lower(tg_op)::audit_action,
    tg_table_name,
    coalesce((to_jsonb(coalesce(new, old)) ->> 'id'), null),
    diff
  );

  return coalesce(new, old);
end;
$$;

-- The tables worth watching: anything holding donor data, anything deciding
-- who may see it, and the records a certificate is evidence of.
--
-- `email_otps` is deliberately absent. Its rows are secrets with a ten-minute
-- life, and copying them into a table that keeps things forever would undo the
-- reason the codes are hashed in the first place.
create trigger audit_donors          after insert or update or delete on donors          for each row execute function record_audit();
create trigger audit_camps           after insert or update or delete on camps           for each row execute function record_audit();
create trigger audit_registrations   after insert or update or delete on registrations   for each row execute function record_audit();
create trigger audit_partners        after insert or update or delete on partners        for each row execute function record_audit();
create trigger audit_partner_members after insert or update or delete on partner_members for each row execute function record_audit();
create trigger audit_camp_partners   after insert or update or delete on camp_partners   for each row execute function record_audit();
create trigger audit_certificates    after insert or update or delete on certificates    for each row execute function record_audit();
create trigger audit_profiles        after insert or update or delete on profiles        for each row execute function record_audit();

-- --------------------------------------------------------------------------
-- RLS. Admins read; nobody writes through the API at all.
--
-- There is deliberately no insert, update or delete policy. The only thing
-- that may append is the trigger above, which is `security definer` and so
-- bypasses this entirely. An audit log an administrator can edit is not one.
-- --------------------------------------------------------------------------
alter table audit_log enable row level security;

create policy audit_log_select_admin on audit_log for select using (is_admin());

-- Deleting an email_log row is an ordinary administrative action (clearing out
-- a test run), so unlike the audit log it stays writable by admins.
create policy email_log_admin_write on email_log for all
  using (is_admin()) with check (is_admin());
