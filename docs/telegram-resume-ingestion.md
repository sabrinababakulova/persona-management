# Telegram candidate resume ingestion

The integration polls one configured Telegram group for new PDF resumes,
stores them in Directus, extracts candidate data with the existing Mastra
agents, creates company-scoped candidates, and links every candidate to one
configured vacancy. Telegram Bot API calls use grammY's typed `Api` client
with bounded `auto-retry`; the application retains control of durable update
acknowledgment and database retry backoff.

## One-time setup

Apply the database schema and make sure the application's normal server
environment is configured. In particular, the setup and worker require
`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, Directus credentials, and the Gemini API
key used by the resume agents.

Run:

```bash
bun run db:push
bun run telegram:resume:setup
```

The setup command is idempotent and does all of the following:

1. Verifies the bot, target group, bot membership/privacy, protected-content
   setting, database schema, and polling compatibility.
2. Reuses the canonical `Default Company` (or creates it if it is missing).
3. Creates the base vacancy `placeholder-vacancy` in that company unless it
   already exists.
4. Writes `TELEGRAM_RESUME_CHAT_ID`, `TELEGRAM_RESUME_COMPANY_ID`, and
   `TELEGRAM_RESUME_VACANCY_ID` to `.env.local`.
5. Installs one managed crontab entry that polls Telegram and processes one
   eligible resume every minute.

The defaults use Telegram group `-4910953100`. They can be overridden:

```bash
bun run telegram:resume:setup \
  --chat-id=-4910953100 \
  --company-name="Default Company" \
  --vacancy-title=placeholder-vacancy \
  --env-file=.env.local
```

For validation without changing crontab, add `--no-cron`.

If setup reports that `DIRECTUS_TOKEN` is invalid but the configured Directus
administrator credentials are current, rotate and persist a verified static
server token, then rerun setup:

```bash
bun run directus:token:repair
bun run telegram:resume:setup
```

Telegram does not allow `getUpdates` polling while a webhook is configured.
If this bot currently has a webhook and it should be replaced by this cron
poller, explicitly run:

```bash
bun run telegram:resume:setup --replace-webhook
```

That removes the webhook without dropping pending updates.

## Cron behavior

The installed entry runs `scripts/telegram-resumes-poll-cron.sh` once per
minute. The runner:

- asks Bun to load the base `.env` followed by the exact environment file
  selected during setup, so dotenv values do not have to be evaluated as shell
  code;
- pulls every currently pending Bot API update and acknowledges a batch only
  after it has been persisted in PostgreSQL;
- processes at most one eligible resume, leaving the remainder for subsequent
  minutes;
- uses a PID-aware lock so slow AI processing cannot overlap with the next
  cron invocation;
- on macOS, installs a bundled runtime under
  `~/Library/Application Support/persona-management/telegram-resume-worker`;
  this avoids the operating system denying `cron` access to repositories under
  the privacy-protected `Desktop` directory;
- appends output to the log path printed by the setup command. This is
  `storage/logs/telegram-resumes-cron.log` on Linux and lives beside the
  bundled runtime on macOS.

Running the setup command again replaces only its own marked cron line and
does not duplicate it or alter unrelated crontab entries.

Check the installed entry and follow its output:

```bash
crontab -l
tail -f "storage/logs/telegram-resumes-cron.log"
```

On macOS, use the absolute `logFile` path printed by setup instead.

Run either stage manually when troubleshooting:

```bash
bun run telegram:resume:pending
bun run telegram:resume:drain
```

## Processing guarantees

- Only documents from the configured numeric chat id are considered.
- PDF files up to 10 MB are accepted. Invalid, empty, oversized, and non-PDF
  documents are retained as `ignored` queue records with a reason.
- Unique database indexes on Telegram message id and file unique id make Bot
  API retries and repeated forwards idempotent.
- The worker stores the PDF in Directus, runs the existing Mastra resume
  analyzer and summary agents, creates the candidate, and creates its
  `vacancy_candidate` link in one database transaction.
- Successful AI output is cached on the queue row so a later database retry
  does not pay for the same analysis again.
- Transient errors retry up to five times with exponential backoff.
- Queue jobs use `FOR UPDATE SKIP LOCKED`, adding database-level protection
  against concurrent workers.

The Telegram Bot API does not expose arbitrary group history. Polling sees only
updates Telegram still retains (currently no more than 24 hours), so the cron
must remain installed for ongoing ingestion:
<https://core.telegram.org/bots/api#getting-updates>.

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
