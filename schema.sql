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

-- Priority. Also shipped as migrations/001_priority.sql for existing databases.
alter table tasks
  add column if not exists priority text not null default 'normal'
  check (priority in ('high', 'normal', 'low'));
create index if not exists tasks_priority_idx on tasks (status, priority, due_at);

-- Manual ordering. Also shipped as migrations/002_position.sql.
alter table tasks add column if not exists position double precision;
create index if not exists tasks_position_idx on tasks (client, position);

-- Completion timestamps, for the streak and the 7-day history.
-- Also shipped as migrations/003_done_at.sql.
alter table tasks add column if not exists done_at timestamptz;
create index if not exists tasks_done_at_idx on tasks (done_at desc);

-- Social module: brand profiles and the post queue.
-- Also shipped as migrations/004_social.sql.
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_self boolean not null default false,
  voice text, audience text,
  pillars text[], tone_do text[], tone_dont text[], colours text[],
  links jsonb,
  language text not null default 'english' check (language in ('english','hinglish','hindi')),
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists clients_name_idx on clients (lower(name));
create unique index if not exists clients_self_idx on clients (is_self) where is_self;

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  platform text not null check (platform in ('instagram','linkedin')),
  format text not null default 'post' check (format in ('post','reel','carousel','story','article')),
  pillar text, hook text, caption text, hashtags text[], image_prompt text, cta text,
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','approved','posted')),
  posted_at timestamptz,
  position double precision,
  created_at timestamptz not null default now()
);
create index if not exists posts_client_idx on posts (client_id, status, scheduled_at);
create index if not exists posts_position_idx on posts (client_id, position);
alter table clients enable row level security;
alter table posts enable row level security;

-- Market analysis per brand. Also shipped as migrations/005_market.sql.
alter table clients add column if not exists market jsonb;
alter table clients add column if not exists competitor_notes text;
