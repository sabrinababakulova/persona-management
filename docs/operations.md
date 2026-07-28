# Production operations

Run the operational installer after the application has been deployed:

```bash
sudo bash scripts/install-operations.sh
```

`scripts/deploy.sh` runs this installer automatically after restarting the
application.

## Scheduled jobs

The installer writes `/etc/cron.d/persona-management`.

| Schedule (UTC) | User | Job |
| --- | --- | --- |
| Every minute | `persona-cron` | Drain the hh.uz enrichment queue |
| Every 20 minutes | `persona-cron` | Discover new hh.uz applications |
| Every 5 minutes | `persona-cron` | Reconcile hh.uz statuses |
| Every day at 02:17 | `root` | Create and validate a PostgreSQL backup |
| Sundays at 03:43 | `root` | Restore the latest backup into a temporary database |

The hh.uz user can read only `/etc/persona-management/cron.env`, which contains
`AUTH_SECRET` and `PORT`. It cannot read the project `.env` under `/root`.
Database backups remain root-only because access to the Docker or Podman socket
is equivalent to host root access.

Each HTTP worker has both a connection timeout and a total timeout. A
per-worker `flock` prevents overlapping invocations.

## Database backups

Backups are PostgreSQL custom-format archives created by the `pg_dump` binary
inside the running database container. Every archive is checked with the
container's matching `pg_restore` before it is published.

Default location:

```text
backups/database/
├── daily/    # 14 days
├── weekly/   # 56 days
└── monthly/  # 366 days
```

A successful Sunday backup is copied into `weekly/`; a successful backup on the
first day of the month is copied into `monthly/`.

The backup can also be run manually:

```bash
sudo bash scripts/backup-database.sh
```

Optional shell-only environment settings:

```bash
DATABASE_BACKUP_DIR=/path/to/backups
DATABASE_BACKUP_DAILY_RETENTION_DAYS=14
DATABASE_BACKUP_WEEKLY_RETENTION_DAYS=56
DATABASE_BACKUP_MONTHLY_RETENTION_DAYS=366
```

These backups are local. Copying them to encrypted object storage or another
server is still required to survive loss of the production host.

Before restoring, first validate and inspect an archive using the PostgreSQL
container that will perform the restore:

```bash
docker exec -i <database-container> pg_restore --list < backup.dump
```

Practice restoration into a separate database. Do not restore over production
until the test database has passed application smoke tests.

The scheduled Sunday restore test automates the database-level part of this
check. It creates a uniquely named temporary database, restores the latest
daily archive with `--exit-on-error`, confirms that public tables exist, and
drops only that temporary database. It can be run manually with:

```bash
sudo bash scripts/verify-database-backup.sh [optional-backup.dump]
```

## Logs

Cron output is written under `/var/log/persona-management/`. The installed
logrotate policy rotates daily or at 10 MB, keeps 14 rotations, and compresses
old logs. The three legacy `/var/log/hh-*.log` files are retained for four
weekly rotations after migration.
