# My Todos — paste-in task dashboard

One box. You paste a WhatsApp message, an email, or a whole exported chat.
It comes back as todos with client, due date, and a nudge when they're due.

## Stack (all things you already run)

- **Next.js on Vercel** — same as your other project. One app, no separate backend.
- **Supabase Postgres** — one table. Free tier is plenty for one person.
- **Claude API (`claude-opus-5`)** — the parser. One call, JSON out. No regex date
  library, no NLP, no rules engine.
- **`<input type="date">`, browser `Notification`, `<dialog>`** — native. No date picker
  lib, no toast lib, no push service.

## Data model — one table

```sql
create table tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  client      text,              -- free text, not a table
  due_at      timestamptz,
  source      text,              -- the raw pasted line it came from
  source_kind text,              -- 'whatsapp' | 'email' | 'note'
  status      text default 'open',  -- open | done | dropped
  created_at  timestamptz default now()
);
```

No `clients` table, no `projects`, no `tags`, no `attachments`. Client is a text
column; the dashboard groups by it with `distinct`. Add real tables the day you
actually need per-client fields — you won't for months.

## The one hard part: parsing

Everything else is CRUD. This is the whole product:

```
POST /api/parse  { text, defaultClient? }
  -> Claude, with a JSON schema:
     [{ title, client, due_at (ISO or null), confidence }]
  -> returns candidates, does NOT write to the DB
```

Prompt gives it today's date, your timezone, and the rule that "by Friday",
"EOD tomorrow", "next week" resolve to real timestamps. Model returns nothing
for chit-chat lines. Everything lands in a **review screen** first — checkbox
list, editable date, then Save. Never auto-commit AI output into your task list;
you'll spend more time deleting garbage than typing tasks.

WhatsApp group export (`_chat.txt`) is the same endpoint: strip the
`[dd/mm/yy, hh:mm:ss] Name:` prefix with one regex, keep sender as a hint, send
the messages in ~200-line chunks. Sender name becomes the default client guess.

## Screens — three, not ten

1. **Inbox** — big textarea + file drop for `_chat.txt`. Paste → Parse → review
   → Save.
2. **Board** — one list, grouped by client, sorted by due date. Overdue red,
   today amber. Click a row to edit inline. That's the dashboard.
3. **Today** — due today + overdue. Opens by default.

Skipped on purpose: kanban drag-drop, calendar view, charts, subtasks,
recurring tasks, comments, attachments, team members.

## Reminders

- On load, browser `Notification` for anything due in the next 2 hours.
- One Vercel cron at 8am → sends you one email with today's list (Resend, ~15 lines).

Skipped: real push notifications, WhatsApp reply-back bot, per-task snooze.
Add push when you actually miss something because the tab was closed.

## Auth

Single user. Put a password in an env var, check it in middleware, set a cookie.
Skipped: Supabase Auth, Google login, sessions, roles. It's your dashboard.

## Build order

| Phase | Ship | Roughly |
|---|---|---|
| 1 | Table + Board + manual add/edit/done | **built** |
| 2 | `/api/parse` + Inbox paste + review screen | **built** |
| 3 | WhatsApp `_chat.txt` upload into the same flow | **built** (came free) |
| 4 | Today view + browser notification | **built** |
| 5 | 8am cron email | **built** |

Phase 1+2 is the whole product. 3–5 are comfort.

## What this deliberately is not

Not a CRM, not multi-user, not a WhatsApp integration (the WhatsApp Business API
is an approval process and a monthly bill for something a copy-paste solves).
No offline sync, no mobile app — the Vercel URL on your phone home screen is a
mobile app.

## Things that will bite

- **Dates in Hinglish/shorthand** ("parso", "agle hafte", "15 tarikh"). Say so in
  the prompt; test with 10 of your real messages before trusting it.
- **Timezone.** Store UTC, render Asia/Kolkata. Get this wrong once and every
  due date is off by 5.5 hours.
- **Cost.** A 2000-message chat export is a few cents per parse. Fine. But don't
  re-parse the same export twice — hash the file and skip if seen.
- **Bad parses.** The review screen is not optional. It's the difference between
  a tool you use and one you abandon in week two.
