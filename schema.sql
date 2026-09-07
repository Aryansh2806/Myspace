-- Paste into Supabase -> SQL Editor -> Run
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  client      text,
  due_at      timestamptz,
  source      text,
  source_kind text,
  status      text not null default 'open',
  created_at  timestamptz not null default now()
);

create index if not exists tasks_due_idx on tasks (status, due_at);

-- Single-user app: only the service-role key (server-side) touches this table.
alter table tasks enable row level security;
