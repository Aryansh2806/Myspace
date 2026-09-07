-- Run once in the Supabase SQL editor.
-- Existing rows become 'normal', which is what they effectively already are.
alter table tasks
  add column if not exists priority text not null default 'normal'
  check (priority in ('high', 'normal', 'low'));

-- High first, then soonest due. Matches how the board sorts.
create index if not exists tasks_priority_idx on tasks (status, priority, due_at);
