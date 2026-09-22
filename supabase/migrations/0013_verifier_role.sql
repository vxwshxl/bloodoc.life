-- A third account role: someone who verifies registrations and nothing else.
--
-- This file does one thing and one thing only, deliberately. Postgres will not
-- let a newly added enum value be *used* in the same transaction that adds it —
-- "unsafe use of new value of enum type" — and the CLI runs each migration
-- file in its own transaction. So the value lands here and every policy that
-- reads it lands in 0014. Putting them together fails on a fresh database and
-- passes on one where the value already exists, which is the worst kind of
-- migration: the one that works for you and not for the next person.
alter type user_role add value if not exists 'verifier';
