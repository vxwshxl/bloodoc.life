-- The camp summary is rendered copy like any other, and it still carried an em
-- dash after the rest of the site's text was rewritten without them. Copy that
-- lives in a row is the copy that gets missed.
update camps
   set summary = 'One afternoon. One unit of blood. Up to three lives. Walk in, give, and be out inside the hour. Screening, donation and refreshments are all on site.'
 where slug = 'world-blood-camp-2026';
