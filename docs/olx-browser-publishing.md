# OLX.uz browser-assisted vacancy publishing

Last reviewed: 2026-08-10

## Why this integration uses a browser

OLX.uz does not offer this project a supported third-party vacancy publishing
API or an OAuth client-registration flow. Persona therefore uses the public
OLX.uz website with Playwright on behalf of an authenticated Persona user.

This is browser assistance, not an API emulation layer. It must only be used
with an OLX.uz account the user is authorized to operate and in accordance with
the account's OLX terms, package limits, and moderation rules.

## Supported scope

- connect one OLX.uz browser session per Persona user;
- fill a Jobs advert from a Persona vacancy;
- run a safe form check that closes the browser before the final submit;
- publish after a separate confirmation;
- store the resulting public advert URL/id on the publication row;
- reconnect, verify, or delete the saved browser session.

The first version deliberately does **not** automate editing, deactivation, or
deletion of a published advert. Those operations must be completed on OLX.uz.
Persona blocks a local status toggle for linked OLX adverts so it cannot claim
that a still-live external advert is inactive.

## One-time login and persisted state

1. The user opens **My profile → Company settings → OLX.uz account**.
2. They enter their OLX.uz email/phone and password over the application's
   authenticated HTTPS connection.
3. A short-lived headless Chrome process opens `https://www.olx.uz/adding` and
   submits the normal OLX login form.
4. The password exists only in the request and browser process memory. It is
   never inserted into the database, written to a file, or deliberately logged.
5. After a successful redirect, Playwright storage state (cookies and origin
   storage) is encrypted and stored in `user_olx_session`.
6. The browser closes. Future user-triggered checks/publications decrypt and
   reuse that state.

OLX does not provide an API access token for this flow. The reusable credential
is the browser storage state. It is as sensitive as a signed-in browser profile.

### Encryption

`src/server/services/olx-browser/crypto.ts` uses AES-256-GCM with a random
96-bit IV. The key is domain-separated and derived from `AUTH_SECRET` with
SHA-256. The payload is versioned and authenticated, so a modified value or a
wrong secret is rejected.

Rotating `AUTH_SECRET` intentionally invalidates saved OLX sessions. Users must
reconnect afterward. Database backups containing these rows must receive the
same protection as other authentication data.

### Why login is not shown in a Playwright popup

Production Persona runs on a remote server. A headed Playwright window would
open on that server, not on the recruiter's computer. Streaming a remote browser
would add a persistent browser pool, screen streaming, input forwarding, and a
larger security surface. The minimal production flow therefore accepts the
credentials once in Persona and never stores the password.

## CAPTCHA, OTP, and site changes

Persona never solves or bypasses CAPTCHA, OTP, device checks, or other OLX
security controls. If one appears, the browser closes, the saved session is
marked `reauth_required`, and the UI asks the user to reconnect after completing
the required OLX verification through normal OLX channels.

Selectors prefer accessible roles and visible Russian/Uzbek/English labels.
Undocumented CSS selectors are only fallbacks for input names. When a required
field or exact option cannot be found, the process stops before submission with
a "form changed/value not found" error. It does not guess or repeatedly retry.

Because OLX owns the Jobs taxonomy and exposes no supported dictionary API, the
publication form stores user-entered visible labels for category path, location,
employment, schedule, and experience. The values must match the current OLX.uz
dropdown labels exactly. The safe form check is the authoritative validation.

Contact phone numbers are validated as Uzbekistan numbers (`+998` followed by
exactly nine national digits). The UI accepts common spacing, hyphen, and
parenthesis variants, then Zod normalizes the value to `+998XXXXXXXXX` before it
is persisted or entered into the OLX.uz form. Invalid and foreign numbers stop
before Chrome starts.

## Resource and request controls

- no background job, cron, crawling, polling loop, or browser pool;
- Chrome starts only for connect, verify, preview, or publish and closes in a
  `finally` block;
- one browser operation per application process and host (an atomic temporary
  lock also covers multiple workers); concurrent attempts are rejected instead
  of queued;
- 90-second hard operation timeout;
- fonts and media are blocked; images remain enabled for visible verification
  challenges;
- fixed event-driven waits and no retry loop or randomized "human" behavior;
- login: 3 attempts per 15 minutes per user plus a 60-second cooldown;
- browser actions: 10 per hour per user; preview and publish each have a
  30-second cooldown;
- final submission requires a separate Persona confirmation;
- repeat submission is rejected after an advert URL has been saved.

These controls reduce both server consumption and accidental load on OLX.uz.
They are reliability controls, not anti-detection or fingerprint evasion.

## Configuration

Install one system Chrome or Chromium package. Persona depends on
`playwright-core`, so `bun install` does not download Playwright's browser
bundle.

Optional environment values:

```dotenv
# Omit to search common macOS/Linux Chrome and Chromium paths.
OLX_BROWSER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable"

# Default false. Prefer an unprivileged OS user and Chrome's sandbox.
OLX_BROWSER_NO_SANDBOX="false"
```

Run Persona and Chrome as an unprivileged OS user. If the existing deployment
runs the Node process as root, migrate it to a service account. Setting
`OLX_BROWSER_NO_SANDBOX=true` passes Chrome's `--no-sandbox` flags and should
only be used in a separately hardened container/host after accepting the
security tradeoff; it is never enabled automatically.

Apply the generated migration through the normal deploy path:

```bash
bun run db:migrate
```

Do not use `db:push` for deployment.

## Data model

`user_olx_session`:

- one row per Persona user (`user_id UNIQUE`, cascading on user deletion);
- encrypted Playwright storage state;
- masked login hint only;
- `connected` / `reauth_required` / `error` status;
- last verification, operation, and safe error metadata.

OLX publication fields on `vacancy`:

- `olx_browser_meta`: user-entered web-form labels and flags;
- `olx_advert_url` / `olx_advert_id`: captured after submission;
- `olx_last_published_at`;
- `olx_last_error`.

## Main code paths

- `src/server/services/olx-browser/runtime.ts` — executable discovery,
  process/host lock, one-at-a-time launch, request filtering, timeout, teardown;
- `src/server/services/olx-browser/browser-flow.ts` — login, challenge
  detection, semantic form filling, preview, final submit;
- `src/server/services/olx-browser/crypto.ts` — storage-state encryption;
- `src/server/api/routers/integrations.ts` — connect/verify/disconnect;
- `src/server/api/routers/vacancies/olx.ts` — guarded preview/publish;
- `src/app/_components/olx-account-section.tsx` — account settings;
- `src/app/vacancies/[id]/publications/[channel]/olx-publication-form.tsx` —
  localized publication editor.

## Verification

Automated tests use a local HTTP fixture and a system Chrome. They cover:

- encryption round-trip, wrong-key rejection, and tamper rejection;
- masked login hints and HTML-to-plain-text conversion;
- normal login and storage-state capture;
- authenticated session reuse;
- semantic form filling;
- preview stopping before submit;
- final submit and advert URL/id capture against the local fixture only.

Run:

```bash
bun test src/server/services/olx-browser
bun test
bun run i18n:check
bun run typecheck
bun run check
SKIP_ENV_VALIDATION=1 bun run build
```

### Live OLX.uz dry-run checklist

Use a dedicated account the company is authorized to operate. A live selector
test must stop before final submission unless the user separately approves a
real advert.

1. Configure Chrome and apply migration `0052`.
2. Connect the account and confirm the password field is cleared afterward.
3. Verify the masked login and last-verified timestamp.
4. Fill a representative Jobs publication using labels copied from current
   OLX.uz dropdowns.
5. Click **Check form** and confirm Persona reports that no advert was sent.
6. Confirm CAPTCHA/OTP stops the operation and marks reauthentication required.
7. Only with explicit approval, confirm the final dialog and verify that the
   saved URL opens the single intended advert.
8. Try publishing the same row again and confirm Persona rejects the duplicate.
