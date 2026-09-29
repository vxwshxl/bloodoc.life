-- --------------------------------------------------------------------------
-- The certificate is issued, and emailed, the moment a donation is recorded.
--
-- Until now a donation minted a `pending` certificate and the blood bank had
-- to approve it before the donor got anything. The organisers want the donor
-- to have it on the day. Recording `donated` is itself a person at the desk or
-- the blood bank vouching for the donation, so it is now what issues the
-- certificate. Withdrawing one still works exactly as before, and a withdrawn
-- code still says so at /verify.
--
-- Certificates already sitting `pending` are left alone. The blood bank's
-- Approve button still issues (and emails) those.
-- --------------------------------------------------------------------------

-- When the donor was sent their certificate. Null means not yet. The claim
-- below sets it, and nothing else should.
alter table certificates add column emailed_at timestamptz;

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
        insert into public.certificates (registration_id, code, status, issued_at, issued_by)
        values (new.id, mint_certificate_code(), 'approved', now(), auth.uid())
        -- A registration that goes donated → screened → donated keeps its
        -- first certificate, and a withdrawn one stays withdrawn.
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

-- --------------------------------------------------------------------------
-- Claim the right to email a donor their certificate. Exactly once.
--
-- Returns what the email needs, or no row if there is nothing to send: no
-- certificate, not approved, already emailed, or the caller may not record
-- outcomes at this camp. Setting `emailed_at` and reading the row happen in
-- one update, so two people tapping "Donated" at the same moment send one
-- email between them, and re-saving a donated registration sends none.
--
-- Security definer because the desk (verifier) may record a donation but has
-- no update policy on certificates, and should not get one just for this. The
-- caller check inside is the same set of people who can record a donation:
-- administrators, verifiers, and the blood bank running that camp.
-- --------------------------------------------------------------------------
create or replace function claim_certificate_email(target_registration uuid)
returns table (
  code         text,
  donor_name   text,
  donor_email  text,
  camp_title   text,
  camp_starts  timestamptz
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update certificates c
     set emailed_at = now()
    from registrations r
    join donors d on d.id = r.donor_id
    join camps k  on k.id = r.camp_id
   where c.registration_id = target_registration
     and r.id = c.registration_id
     and c.status = 'approved'
     and c.emailed_at is null
     and (is_admin() or is_verifier() or is_camp_bloodbank(r.camp_id))
  returning c.code, d.full_name, d.email, k.title, k.starts_at;
$$;

revoke all on function claim_certificate_email(uuid) from public, anon;
grant execute on function claim_certificate_email(uuid) to authenticated;
