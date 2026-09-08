-- Run once in the Supabase SQL editor.
-- Competitor/market analysis, stored per brand so it is paid for once and then
-- reused free in every content plan.
alter table clients add column if not exists market jsonb;
-- What YOU have actually seen competitors doing. Pasted observations beat
-- anything the model can find on its own: Instagram and LinkedIn are
-- login-walled, and live web research proved slow, costly and unsourced.
alter table clients add column if not exists competitor_notes text;

-- Measured, not guessed: evals/ scored a plan with a stated objective at 78%
-- would-post against 17% without one, on identical brands. Purpose was the
-- missing ingredient, not craft — the baseline already used brand facts (94%)
-- and wrote working hooks (100%).
alter table clients add column if not exists objective text;
