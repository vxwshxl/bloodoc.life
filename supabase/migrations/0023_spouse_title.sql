-- --------------------------------------------------------------------------
-- The husband's name (0022) becomes the spouse's name.
--
-- Only the label changes for most donors; a wife is titled "Mrs.", so the
-- title check now allows it. The columns keep their 0022 names so nothing
-- already saved or deployed has to move.
-- --------------------------------------------------------------------------

alter table donors
  drop constraint donors_husband_title_known,
  add constraint donors_husband_title_known
    check (husband_title in ('mr', 'mrs', 'late'));
