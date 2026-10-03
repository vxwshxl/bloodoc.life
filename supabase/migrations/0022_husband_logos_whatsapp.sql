-- --------------------------------------------------------------------------
-- Husband's name, partner logos, and the donor's phone for WhatsApp.
--
-- `donors` already has RLS and its policies (0001, 0008); the new columns are
-- covered by them and need nothing here.
-- --------------------------------------------------------------------------

-- Asked beside the parents' names, optional, because it applies to some donors
-- and not others. Titled the same way the parents are ("Mr." / "Lt."), kept
-- apart from the name for the same reason 0020 gave: the name column still
-- sorts and searches on the name.
alter table donors
  add column husband_title text
    constraint donors_husband_title_known check (husband_title in ('mr', 'late')),
  add column husband_name text;

-- --------------------------------------------------------------------------
-- Partner logos.
--
-- Printed on the standard certificate and in the camp's Excel report. Public
-- read, because both of those load the file without a session. Only an
-- administrator may write; the upload action re-encodes everything to PNG
-- before it gets here, so the bucket refuses any other type.
--
-- storage.objects has RLS on by default in Supabase; these are its policies
-- for this bucket.
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-logos', 'partner-logos', true, 2097152, array['image/png'])
on conflict (id) do nothing;

create policy partner_logos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'partner-logos' and public.is_admin());

create policy partner_logos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'partner-logos' and public.is_admin())
  with check (bucket_id = 'partner-logos' and public.is_admin());

create policy partner_logos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'partner-logos' and public.is_admin());

-- The two collaborators whose emblems are on the RGU drive's own artwork,
-- cut from it into public/partners. Only where nothing is set yet, and a
-- database without these partners matches nothing.
update partners set logo_url = '/partners/nss.png'
 where logo_url is null and name ilike 'NSS%';
update partners set logo_url = '/partners/abtyp.png'
 where logo_url is null and name ilike '%terapanth yuvak parishad%';

-- --------------------------------------------------------------------------
-- The certificate claim also returns the donor's phone, so the certificate
-- can go out on WhatsApp as well as by email. Otherwise identical to 0021;
-- the return type changed, so the function is replaced rather than redefined.
-- --------------------------------------------------------------------------
drop function if exists claim_certificate_email(uuid);

create function claim_certificate_email(target_registration uuid)
returns table (
  code         text,
  donor_name   text,
  donor_email  text,
  donor_phone  text,
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
  returning c.code, d.full_name, d.email, d.phone, k.title, k.starts_at;
$$;

revoke all on function claim_certificate_email(uuid) from public, anon;
grant execute on function claim_certificate_email(uuid) to authenticated;
