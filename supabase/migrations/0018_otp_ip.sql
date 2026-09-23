-- --------------------------------------------------------------------------
-- Rate-limit sign-in codes by IP as well as by address.
--
-- Sign-in used to be refused for any address without a donor record, a
-- partner invite or a profile. That gate is gone — anyone may sign in and
-- apply to a camp from the panel — which means the form will now mail a code
-- to any address typed into it. The per-address cooldown in lib/auth/otp.ts
-- stops one inbox being flooded, but not one client walking a list of
-- addresses and using us as a mail cannon. Recording where each request came
-- from lets `issueOtp` cap that.
--
-- Nullable: rows issued before this migration have no IP, and the profile
-- flow's codes may be issued without one.
--
-- `email_otps` already has RLS enabled with no policies (0001); a new column
-- inherits that and needs nothing here.
-- --------------------------------------------------------------------------
alter table email_otps add column ip text;

create index email_otps_ip_idx on email_otps (ip, created_at desc) where ip is not null;
