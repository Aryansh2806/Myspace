# My Todos

Paste a WhatsApp message, an email, or a whole exported group chat. Claude turns
it into todos with a client and a due date. You approve them, they land on the
board. See [PLAN.md](PLAN.md) for what's deliberately not here.

## Setup (~5 min)

1. **Supabase** — create a project, then SQL Editor → paste `schema.sql` → Run.
2. **Keys** — `cp .env.local.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API)
   - `ANTHROPIC_API_KEY` (console.anthropic.com → API keys)
3. `npm install && npm run dev` → http://localhost:3000

## Use

- **Paste** tab: dump text in, hit *Find tasks*, uncheck the junk, Save.
  Drag a WhatsApp `_chat.txt` export straight onto the box.
- **Board**: grouped by client. Overdue is red, due-today amber. Edit any title
  or date inline — it saves on blur. Hover a title to see the original message.

## Reminders

- **In the browser** — hit *Enable reminders* on the board once. Anything due in
  the next 2 hours pops a notification, once per task (remembered in
  `localStorage`, so reloads don't re-fire). Only fires while a tab is open.
- **Every morning** — a Vercel cron hits `/api/cron/digest` at 08:00 IST and
  emails you what's overdue and what's due today. Nothing due, no email.

The digest is optional: without `RESEND_API_KEY` / `DIGEST_TO` the route returns
the text it *would* have sent instead of sending it, which is also the easiest
way to test it.

## Deploy

Push to a repo, import into Vercel, add the same env vars **plus `APP_PASSWORD`**.
The middleware refuses to serve on Vercel without it. First visit:
`https://your-app.vercel.app/?pw=yourpassword` — it sets a year-long cookie.

`vercel.json` registers the 08:00 IST cron automatically. Set `CRON_SECRET` too —
`/api/cron/digest` is outside the password gate and that secret is its only door,
so it refuses to run on Vercel without one. Optional: `RESEND_API_KEY`,
`DIGEST_TO`, `APP_URL` for the email itself.

## Tests

`npm test` — 12 tests, no framework. Covers the WhatsApp export parser (iOS +
Android formats, continuation lines, system-notice filtering, rejecting
non-exports) and the due-date selector shared by the notifier and the digest
(timezone day boundaries, skipping done/undated tasks).

## Costs

Set `PARSE_MODEL` in `.env.local` to change models. Measured on real fixtures —
one client email and one WhatsApp export, 3 runs each, scored on whether every
extracted due date was right:

| Model | Correct | Speed | Cost per parse |
|---|---|---|---|
| `claude-opus-5` | 3/3 | ~6s | ~$0.013 |
| `claude-sonnet-5` *(default here)* | 3/3 | ~5s | ~$0.005 |
| `claude-haiku-4-5` | 2/3 | ~20s | ~$0.007 |

**Haiku is not the cheap option.** It burns thinking tokens on this task, so it
came out slower than Opus and dearer than Sonnet — while still misdating
"15 tarikh" as the 14th and "by Friday" as a Saturday. Sonnet matched Opus
on every fixture at 2.5x less, which is why it is the default.

The failures only show up on full messages with several tasks and a distractor;
on a single clean sentence all three models score 3/3. Benchmark on your own
messages before trusting any of this.

Exports are capped at 15 chunks (~2250 messages) per parse so a huge file can't
run up a bill; you'll be told when it truncates. A hard monthly ceiling is not
something this app can set — put one at
[console.anthropic.com](https://console.anthropic.com) → Limits.
