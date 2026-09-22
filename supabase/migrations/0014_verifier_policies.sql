-- What a verifier may do.
--
-- The desk volunteer role. They check people in, take the screening readings
-- and mark who actually donated — the work that happens at a table on camp
-- morning — and nothing else. Specifically NOT: creating or editing camps,
-- managing partners or users, reading the audit log, or editing email
-- templates.
--
-- Scoped by capability rather than by camp, unlike a partner. A partner's
-- reach is limited to the drives their body is attached to; a verifier is the
-- organisation's own staff, rostered wherever they are needed on the day, and
-- making them re-earn access per camp would mean an administrator editing
-- permissions every morning.

create or replace function is_verifier()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'verifier'
  );
$$;

-- Donor records, so the desk can find the person in front of them. Full
-- contact details, for the same reason the blood bank gets them: the desk
-- rings the donor who did not turn up.
create policy donors_select_verifier on donors for select
  using (is_verifier());

-- Correcting a phone number or a blood group at the desk is part of check-in.
create policy donors_update_verifier on donors for update
  using (is_verifier()) with check (is_verifier());

-- Walk-ins: somebody who arrives without having registered online.
create policy donors_insert_verifier on donors for insert
  with check (is_verifier());

-- The roster itself, and the readings taken against it.
create policy registrations_select_verifier on registrations for select
  using (is_verifier());

create policy registrations_update_verifier on registrations for update
  using (is_verifier()) with check (is_verifier());

create policy registrations_insert_verifier on registrations for insert
  with check (is_verifier());

-- Camps are readable so the roster can name the drive it belongs to. Read
-- only: `camps_write_admin` stays the only write policy, so a verifier can
-- open a camp and never change, publish or delete one.
create policy camps_select_verifier on camps for select
  using (is_verifier());

-- Certificates are visible because reaching `donated` mints one, and a desk
-- that cannot see the result of its own work has to ask an administrator
-- whether the thing it just did worked. Approving stays with the blood bank
-- and the administrator — `certificates_bloodbank_write` is unchanged.
create policy certificates_select_verifier on certificates for select
  using (is_verifier());
