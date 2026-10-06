-- --------------------------------------------------------------------------
-- Pulse rate, beats per minute.
--
-- On the registration with the rest of the screening readings, for the same
-- reason they are: it is a measurement of one morning, and the next camp's
-- reading must not overwrite this one's.
--
-- Recorded at the desk, never asked on the public form — a pulse a donor typed
-- in at home is not a reading. The range is what a cuff can plausibly report,
-- not what the medical officer would accept: the column has to hold the
-- reading that caused a deferral.
--
-- `registrations` already has RLS and its update policies (0001, 0008); a new
-- column is covered by them and needs nothing here.
-- --------------------------------------------------------------------------
alter table registrations
  add column pulse_bpm smallint
    constraint registrations_pulse_plausible
    check (pulse_bpm is null or pulse_bpm between 30 and 220);
    
