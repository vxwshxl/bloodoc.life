-- Haemoglobin is the number that actually decides most deferrals.
--
-- It belongs on the registration rather than the donor for the same reason the
-- rest of the vitals do: it is a measurement of one morning, and the whole
-- point of recording it is to be able to look back at what it was last time.
-- Storing it on the person would mean September silently overwrote March.
--
-- No lower bound check at 12.5 (the usual Indian cutoff for donation): the
-- column has to be able to hold the reading that *caused* a deferral, which is
-- by definition below it. Eligibility is a decision, not a constraint.
alter table registrations
  add column hemoglobin_gdl numeric(4,1)
    check (hemoglobin_gdl is null or hemoglobin_gdl between 3 and 25);

update camps
   set title = 'Mega Blood Donation Drive 2026'
 where slug = 'world-blood-camp-2026';
