-- Run once in the Supabase SQL editor.
-- Deliberately separate from tasks.client, which stays plain text so the board
-- keeps working untouched. These join by name only where it is useful.

create table if not exists clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  is_self      boolean not null default false,
  voice        text,
  audience     text,
  pillars      text[],
  tone_do      text[],
  tone_dont    text[],
  colours      text[],
  links        jsonb,
  language     text not null default 'english'
               check (language in ('english', 'hinglish', 'hindi')),
  notes        text,
  created_at   timestamptz not null default now()
);

-- name is how this links back to tasks.client, so two "MCC" rows would make
-- that ambiguous. The database refuses it rather than the app policing it.
create unique index if not exists clients_name_idx on clients (lower(name));

-- Exactly one personal brand. A partial unique index is the whole rule.
create unique index if not exists clients_self_idx on clients (is_self) where is_self;

create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  platform     text not null check (platform in ('instagram', 'linkedin')),
  format       text not null default 'post'
               check (format in ('post', 'reel', 'carousel', 'story', 'article')),
  pillar       text,
  hook         text,
  caption      text,
  hashtags     text[],
  image_prompt text,
  cta          text,
  -- When YOU intend to post it. Nothing publishes; this is an intention.
  scheduled_at timestamptz,
  status       text not null default 'draft'
               check (status in ('draft', 'approved', 'posted')),
  posted_at    timestamptz,
  position     double precision,
  created_at   timestamptz not null default now()
);

create index if not exists posts_client_idx on posts (client_id, status, scheduled_at);
create index if not exists posts_position_idx on posts (client_id, position);

alter table clients enable row level security;
alter table posts enable row level security;
