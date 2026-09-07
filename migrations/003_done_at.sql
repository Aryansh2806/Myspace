-- Run once in the Supabase SQL editor.
-- A streak and a history chart need to know WHEN something was completed;
-- status alone cannot answer "did you ship anything yesterday".
alter table tasks add column if not exists done_at timestamptz;

-- Existing completed rows get their creation time as a best guess, so the
-- history is not silently empty. Anything completed from now on is stamped
-- properly by the API.
update tasks set done_at = created_at where status = 'done' and done_at is null;

create index if not exists tasks_done_at_idx on tasks (done_at desc);
