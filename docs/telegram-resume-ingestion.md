# Telegram candidate resume ingestion

Production ingestion uses a Telegram webhook. Telegram sends each new
`message` or `channel_post` update to the Next.js application, the webhook
stores matching PDF documents in a durable PostgreSQL queue, and a separate
worker processes that queue.

```text
New Telegram document
        |
        v
Telegram POSTs an Update to the webhook
        |
        v
Webhook validates its secret and inserts a queue row
        |
        v
Resume worker downloads the file
        |
        v
Directus upload -> Mastra analysis -> candidate saved
```

The webhook does not run file downloads or AI work. This keeps its response
fast and lets Telegram retry failed deliveries safely. Unique database indexes
on the Telegram message id and file unique id make retries idempotent.

## Company self-service connection

Every company receives an internal `Склад кандидатов из Telegram` vacancy when
the company row is created. Existing companies are backfilled by the database
migration. The vacancy is identified by the system key
`telegram_resume_warehouse`, remains hidden from normal vacancy lists, and is
never shared between companies.

A company administrator connects a group from **Company settings → Telegram
resume group**:

1. Talanty creates a random one-time `/connect` command valid for 15 minutes.
2. The administrator adds the configured bot to the target group, makes it an
   administrator, and sends the command in that group.
3. The webhook consumes the one-time code, verifies that the chat is a group,
   the bot is an active member with access to ordinary messages, and protected
   content is disabled.
4. The numeric chat id is bound to exactly one company and that company's
   warehouse vacancy in `company_telegram_resume_config`.

The command flow supports private groups without asking users to discover a
numeric chat id. Only company admins can create a connection code, replace a
group, or disconnect it. Disconnecting stops new ingestion but keeps candidates
already imported into the warehouse.

## One-time setup

Apply the database schema and make sure the application's normal server
environment is configured. The setup and worker require `DATABASE_URL`,
`TELEGRAM_BOT_TOKEN`, Directus credentials, and the Gemini API key used by the
resume agents.

Run:

```bash
bun run db:migrate-custom
bun run telegram:resume:setup
```

The legacy operations setup command is idempotent and:

1. Verifies the bot, target group, bot membership/privacy,
   protected-content setting, database schema, and Directus access.
2. Reuses the canonical `Default Company`, or creates it if missing.
3. Ensures the company's system-owned Telegram warehouse vacancy exists.
4. Writes `TELEGRAM_RESUME_CHAT_ID`, `TELEGRAM_RESUME_COMPANY_ID`, and
   `TELEGRAM_RESUME_VACANCY_ID` to `.env.local`.
5. Installs a managed cron entry that processes one queued resume per minute.

The worker cron never calls `getUpdates` and does not modify the bot's webhook.
For validation without changing crontab, add `--no-cron`.

The defaults can be overridden:

```bash
bun run telegram:resume:setup \
  --chat-id=-4910953100 \
  --company-name="Default Company" \
  --vacancy-title=placeholder-vacancy \
  --env-file=.env.local
```

If setup reports that `DIRECTUS_TOKEN` is invalid but the configured Directus
administrator credentials are current, rotate and persist a verified static
server token, then rerun setup:

```bash
bun run directus:token:repair
bun run telegram:resume:setup
```

## Register the production webhook

Deploy the application with these server-side variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_RESUME_CHAT_ID`
- `TELEGRAM_RESUME_COMPANY_ID`
- `TELEGRAM_RESUME_VACANCY_ID`
- `TELEGRAM_WEBHOOK_BASE_URL` (the public HTTPS application origin)
- `TELEGRAM_WEBHOOK_SECRET` (optional; derived from `AUTH_SECRET` by default)

After the deployment is healthy, register the webhook once:

```bash
bun run telegram:resume:webhook:set
bun run telegram:resume:status
```

Registration performs a signed preflight request before calling
`setWebhook`. It subscribes only to `message` and `channel_post` updates and
keeps pending updates. `telegram:resume:status` reports the current URL,
pending update count, and Telegram's latest delivery error.

Telegram supports either `getUpdates` or a webhook for a bot, not both. This
integration no longer contains or schedules a `getUpdates` poller. See the
[Telegram Bot API update delivery documentation](https://core.telegram.org/bots/api#getting-updates).

## Queue worker

The setup-installed entry runs
`scripts/telegram-resumes-worker-cron.sh` once per minute. It:

- asks Bun to load the base `.env` followed by the environment file selected
  during setup;
- processes at most one eligible queue item per invocation;
- uses a PID-aware lock so slow AI processing cannot overlap;
- on macOS, installs a bundled runtime under
  `~/Library/Application Support/persona-management/telegram-resume-worker`;
- appends output to the log path printed by setup.

Running setup again replaces only its own marked cron line. Inspect the local
worker with:

```bash
crontab -l
tail -f "storage/logs/telegram-resumes-cron.log"
```

On macOS, use the absolute `logFile` path printed by setup.

For hosted production, a scheduler can call the equivalent authenticated
endpoint instead:

```text
GET /api/cron/telegram-resumes
Authorization: Bearer <AUTH_SECRET>
```

Only one worker mechanism is needed. Run the worker manually when
troubleshooting:

```bash
bun run telegram:resume:drain
```

## Processing guarantees

- Only documents from a chat bound to a company through the connection flow
  are considered.
- PDF files up to 10 MB are accepted. Invalid, empty, oversized, and non-PDF
  documents are retained as `ignored` queue records with a reason.
- The worker downloads the file from Telegram, stores it in Directus, runs the
  existing Mastra resume analyzer and summary agents, creates the candidate,
  and creates its `vacancy_candidate` link in one database transaction.
- Successful AI output is cached on the queue row, so a later database retry
  does not repeat the analysis.
- Transient errors retry up to five times with exponential backoff.
- Queue jobs use `FOR UPDATE SKIP LOCKED`, adding database-level protection
  against concurrent workers.

The Bot API does not expose arbitrary Telegram group history. New updates are
delivered after webhook registration, while Telegram retains undelivered
updates for [no longer than 24 hours](https://core.telegram.org/bots/api#getting-updates).
Use the existing Telegram Desktop export import for an intentional historical
backfill:

```bash
bun run telegram:resume:history -- <path-to-result.json>
```

## Queue inspection

Summary:

```sql
select status, count(*)
from telegram_resume_import
group by status
order by status;
```

Failures:

```sql
select id, message_id, file_name, attempts, last_error, "updatedAt"
from telegram_resume_import
where status in ('failed', 'ignored')
order by "createdAt" desc;
```

After correcting a transient configuration issue, deliberately requeue failed
items:

```sql
update telegram_resume_import
set status = 'pending',
    attempts = 0,
    run_after = now(),
    locked_at = null
where status = 'failed';
```
