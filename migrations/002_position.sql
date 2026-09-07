-- Run once in the Supabase SQL editor.
-- double precision, not int: dropping a row between two others is then a
-- midpoint of its neighbours, so a reorder updates ONE row instead of renumbering
-- the whole list.
alter table tasks add column if not exists position double precision;

-- Seed a stable starting order per client from creation time.
update tasks set position = sub.rn
from (
  select id, row_number() over (partition by coalesce(client, '') order by created_at) as rn
  from tasks
) sub
where tasks.id = sub.id and tasks.position is null;

create index if not exists tasks_position_idx on tasks (client, position);
