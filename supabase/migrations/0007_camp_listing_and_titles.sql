-- Two additions to `camps`.
--
-- 1. Translated titles. Assam is multilingual and the title is the one string a
--    donor reads before deciding this page is for them. They are columns rather
--    than a jsonb blob so the console can put them in a form and a query can
--    find a camp by its Assamese name later.
--
-- 2. `listed`, which is NOT the same thing as `status` and is why it is a
--    separate column rather than a fourth enum value.
--
--    `status` answers "may a stranger open this page at all" and is what RLS
--    enforces. `listed` answers "do we advertise it" and is a presentation
--    choice on top of that. An unlisted-but-published camp is reachable by
--    anyone holding the link and appears nowhere on the site: a staff-only
--    drive, a rescheduled camp whose old link is still circulating, a private
--    corporate session. Folding that into the enum would have meant
--    'published_unlisted' and a policy that had to know about advertising.
alter table camps
  add column title_as text,
  add column title_hi text,
  add column listed   boolean not null default true;

comment on column camps.listed is
  'Show on the home page and the /camps list. False hides it from both while the camp page itself stays reachable by direct link.';

-- The index behind "the next camp to show on the landing page".
create index camps_listed_starts_idx on camps (status, listed, starts_at);

update camps
   set title_as = 'মেগা ৰক্তদান শিবিৰ ২০২৬',
       title_hi = 'मेगा रक्तदान शिविर २०२६'
 where slug = 'world-blood-camp-2026';
