-- Admin-editable copy for the transactional emails.
--
-- What is editable and what is not, deliberately:
--
--   editable — the subject, the heading, and the lead paragraph
--   fixed    — the layout, the branding, and every block that carries data
--              (the code itself, the camp card, the eligibility notice)
--
-- The alternative, letting an administrator edit raw HTML, was rejected. These
-- messages carry a sign-in code and a donor's own details into their inbox; a
-- template field that reaches `htmlbody` unescaped is a way to put arbitrary
-- markup in front of somebody who trusts the sender, and a mistyped tag breaks
-- the email for everyone with no preview that would have caught it. Copy is
-- what people actually want to change; the layout is what they want to keep.
--
-- Every column is nullable and blank means "use the built-in wording", so a
-- half-filled row still sends a complete email. That is what makes this safe to
-- ship before anybody has written anything.
create table email_templates (
  -- The template's identity in code — 'signin_code', 'registration_confirmed',
  -- 'camp_reminder'. Not an enum: adding a template should be a code change
  -- plus a row, not a migration.
  key         text primary key,
  subject     text,
  heading     text,
  lead        text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles (id) on delete set null
);

comment on table email_templates is
  'Copy overrides for transactional email. Null or blank falls back to the wording in lib/email/templates.ts.';

alter table email_templates enable row level security;

-- Admins only, read and write. Nothing here is public: the wording of a
-- sign-in email is not secret, but the table is an administrative setting and
-- there is no page outside the console that needs it.
create policy email_templates_admin_all on email_templates for all
  using (is_admin()) with check (is_admin());

-- Audited like everything else an administrator can change.
create trigger audit_email_templates
  after insert or update or delete on email_templates
  for each row execute function record_audit();
