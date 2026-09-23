-- --------------------------------------------------------------------------
-- Per-camp choice of which optional registration questions are required.
--
-- The core of the form (name, contact, blood group, consent, …) is always
-- required and is not listed here. What an administrator may switch on per
-- camp is the handful of questions that are optional by default, because one
-- camp's blood bank wants a parent's name on every slip and another's does
-- not care.
--
-- Stored as the form's own field names so the public form, the camp editor
-- and the server action all speak the same keys. The check constraint keeps
-- the list honest: an unknown key would be silently unenforceable.
--
-- `camps` already has RLS and its policies (0001); a new column is covered by
-- them and needs nothing here.
-- --------------------------------------------------------------------------
alter table camps
  add column required_fields text[] not null default '{}'
  constraint camps_required_fields_known check (
    required_fields <@ array[
      'fatherName', 'motherName', 'altPhone', 'address',
      'priorDonations', 'heightCm', 'weightKg'
    ]::text[]
  );
