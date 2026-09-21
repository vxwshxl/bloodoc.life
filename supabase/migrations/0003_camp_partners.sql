-- A camp is rarely run by one organisation.
--
-- The collaborating body and the blood bank that actually receives the units
-- are both things a donor looks for before deciding to turn up — "who is this,
-- and where does my blood go" — so they belong on the camp itself rather than
-- being written into the summary prose, where nothing can read them back.

alter table camps
  add column collaboration text,        -- "In collaboration with …"
  add column partner_name  text,        -- the blood bank taking the units
  add column partner_note  text;        -- its address / parent institution

-- The September camp, as confirmed.
update camps
   set venue         = 'The Royal Global University, DEF Block 6th Floor',
       city          = 'Guwahati',
       starts_at     = '2026-09-25T05:30:00Z',   -- 11:00 IST
       ends_at       = '2026-09-25T10:30:00Z',   -- 16:00 IST
       -- No cap announced. A published number that turns out to be wrong turns
       -- donors away at the door, so the column is left null and the card
       -- simply does not mention places.
       capacity      = null,
       collaboration = 'Terapanth Yuvak Parishad, Guwahati',
       partner_name  = 'State of the Art Model Blood Centre',
       partner_note  = 'Gauhati Medical College & Hospital'
 where slug = 'world-blood-camp-2026';
