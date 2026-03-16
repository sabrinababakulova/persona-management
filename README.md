# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

## GitHub Actions Deploy

This repo includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that follows:

1. Run `bun install --frozen-lockfile`
2. Run `bun run check`
3. Run `bun run typecheck`
4. SSH into the server
5. Execute `scripts/deploy.sh`

The server-side deploy script:

- refuses to deploy if the server worktree is dirty
- fast-forwards the target branch
- runs `bun install --frozen-lockfile`
- runs `bun run build`
- restarts `yeshunt.service`

Required GitHub repository secrets:

- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_KNOWN_HOSTS`

## Candidate Lookup Constants

The candidate create form select options (contact types, sources, positions, skills, languages, language levels, statuses) are stored in Postgres lookup tables and served from the backend via tRPC.

- Migration + seed data: `drizzle/0001_aromatic_red_skull.sql`
- API: `lookups.getCandidateCreateOptions`

To apply locally:

```sh
./start-database.sh
bun run db:migrate
```

## Monitoring And Alerts

This repo now includes a lightweight monitor runner at `scripts/monitor.ts` plus a health endpoint at `/api/health`.

What it watches:

- host CPU load
- host memory usage
- disk usage for `MONITOR_DISK_PATH`
- API request spikes using app-side counters
- auth failure spikes using app-side counters
- service health via `/api/health` (app, database, Directus reachability)

Setup:

```sh
./start-database.sh
bun run db:migrate
```

Populate the monitoring vars in `.env`:

- `ALERT_CHANNELS=email`, `telegram`, or `sms` (comma-separated is supported)
- `ALERT_EMAIL_TO` plus SMTP settings for email alerts
- `ALERT_TELEGRAM_BOT_TOKEN` and `ALERT_TELEGRAM_CHAT_ID` for Telegram
- `ALERT_TWILIO_ACCOUNT_SID`, `ALERT_TWILIO_AUTH_TOKEN`, `ALERT_TWILIO_FROM`, and `ALERT_SMS_TO` for SMS
- the `MONITOR_*` threshold vars if you want to override the defaults in `.env.example`

Useful commands:

```sh
bun run monitor:run
bun run monitor:install-cron
```

The cron installer registers a once-per-minute job that writes output to `storage/monitor/monitor.log`.
