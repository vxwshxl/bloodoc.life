-- The summary said "one morning"; the camp runs 11:00 to 16:00, which is not
-- one. Copy that contradicts the time printed six inches below it is the kind
-- of thing a reader notices and a writer never does.
update camps
   set summary = 'One afternoon. One unit of blood. Up to three lives. Walk in, give, and be out inside the hour — screening, donation and refreshments are all on site.'
 where slug = 'world-blood-camp-2026';
