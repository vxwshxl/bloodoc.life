-- Which camp leads the home page.
--
-- The pinned hero picked `getNextCamp()` — the soonest published, listed camp.
-- That is a guess, and it was wrong as soon as there was more than one camp:
-- a draft drive six months out won the slot over the drive happening next
-- week, purely because of a date. Whoever runs the site should choose.
--
-- `featured` is not `listed` and not `status`:
--   status  — may a stranger open this camp's page at all
--   listed  — do we advertise it on the home page and /camps
--   featured — is it the one the hero animates around
-- A camp can be listed without being featured; only one can be featured.
alter table camps
  add column featured boolean not null default false;

comment on column camps.featured is
  'Lead the home page hero. At most one camp may be true; enforced by camps_one_featured.';

-- At most one, enforced here rather than trusted to the application.
--
-- A partial unique index over a constant: every featured row indexes the same
-- key, so a second one collides. The alternative — a `where featured` check in
-- every write path — is one forgotten branch away from two heroes and a home
-- page that picks between them arbitrarily.
create unique index camps_one_featured on camps ((true)) where featured;

-- Seed the slot with whatever the hero would have chosen anyway, so the home
-- page does not go blank the moment this lands. The soonest published, listed,
-- not-yet-finished camp — the old `getNextCamp` rule, applied once.
update camps
   set featured = true
 where id = (
   select id
     from camps
    where status = 'published'
      and listed
      and coalesce(ends_at, starts_at) >= now()
    order by starts_at asc
    limit 1
 );
