# OLX.uz integration

## What is implemented

OLX's supported Partner API does not include OLX.uz. Persona therefore uses the
same private JSON services as the OLX.uz web application, without pretending
that they are a supported public API.

The flow is split into two parts:

1. A user installs the small Chrome extension in
   `browser-extension/olx-connector`, starts connection from Company settings,
   and signs in on the official `olx.uz` website.
2. The extension sends only the OLX access, refresh, and identity tokens plus
   OLX's device id, request fingerprint, and first-party request cookies through
   a single-use, 15-minute Persona ticket. OLX's current web client sends this
   context on authenticated requests, so the server preserves the same pairing.
   Persona verifies the account and stores the values encrypted. Later previews
   and publications run through a short-lived headless Chrome/Chromium network
   context on the Persona server. It performs the requested API call and closes;
   it does not automate OLX pages or retain an idle browser process.

Passwords, CAPTCHA answers, and SMS/OTP codes are never requested by Persona,
never read by the extension, and never stored. Security checks must be completed
on OLX.uz itself.

## Why the connector is necessary

OLX.uz's tokens live in the user's browser origin and cannot be read by a normal
Talanty web page because of browser same-origin protections. The connector has a
narrow host allow-list for `*.olx.uz`, `*.talanty.uz`, localhost, and
127.0.0.1. It runs only after the user presses Connect and then presses the
confirmation button shown on OLX.uz.

The extension does not automate login, click OLX controls, solve challenges,
hide automation, poll the website, or retain connection data in persistent
extension storage. Its OLX-only network listener copies `X-Device-Id` and
`X-Fingerprint` and the same request's first-party cookie header. It computes a
one-way SHA-256 digest of the active access token to select the exact matching
Auth0 cache entry, then discards the request value; the authorization header
itself is never stored or transmitted. Bodies, responses, and non-OLX traffic
are ignored.

## Server security model

- `createOlxConnectionTicket` creates a random one-time value. Only its SHA-256
  hash is stored in `verification_token`; it expires after 15 minutes and is
  atomically deleted when consumed.
- `/api/integrations/olx/token-connect` accepts Chrome-extension origins only,
  validates payload size/schema, consumes the ticket, and verifies the token
  against `GET /api/v1/users/me` before saving it.
- `src/server/services/olx-api/crypto.ts` encrypts credentials with AES-256-GCM
  and a key derived from `AUTH_SECRET`. Authentication tags detect tampering.
- Access, refresh, and identity tokens, device id, request fingerprint, and OLX
  cookies never enter client React state, tRPC responses, logs, or vacancy
  metadata.
- Disconnect deletes the encrypted row. Expired/rejected tokens change the row
  to `reauth_required` and require the user to connect again.
- Keep `AUTH_SECRET` stable and backed up. Rotating it invalidates all saved OLX
  connections, by design.

## Publication behavior

- Categories are parsed from OLX.uz's live category state and cached in memory
  for six hours. Only selectable leaf categories of type `job` are shown.
- Location suggestions use OLX.uz's posting geo-encoder. The user must select an
  exact suggestion, including a district where OLX requires one.
- **Check form** sends one `POST /api/v1/offers-preview` request. It validates
  through OLX but creates no advert.
- **Publish** sends one `POST /api/v1/offers` request with a unique `posting-id`.
  If the response does not include the public URL, Persona performs one
  read-back by advert id. It does not resubmit.
- Once an OLX advert id is stored, the same publication record cannot be sent
  again. This remains true even if the public URL is delayed by moderation.
- A per-user 30-second cooldown and ten-operation hourly cap apply to preview
  and publish actions. There are no background jobs, automatic retries, or
  polling.

Editing, pausing, and deleting OLX adverts are intentionally manual in this
version. Open the advert in OLX.uz to perform those actions.

## Linux deployment

Install Google Chrome or Chromium. Headless mode needs no display server. Deploy
like the rest of Persona:

1. Pull the branch and run `bun install --frozen-lockfile`.
2. Keep the existing production `AUTH_SECRET`; do not generate a new value for
   each deploy.
3. Apply migrations with `bun run db:migrate` (or the documented custom migrator
   if that database has migration-ledger drift).
4. Install a current `google-chrome-stable` or `chromium` package. Common paths
   are detected automatically; otherwise set `OLX_BROWSER_EXECUTABLE_PATH`.
   Run Persona as an unprivileged user so the Chrome sandbox stays enabled.
5. Ensure outbound HTTPS/DNS can reach `login.olx.uz`, `www.olx.uz`, and
   `categories.olxcdn.com`.
6. Run `bun run build`, restart the application, and check logs for configuration
   or database errors.
7. Package `browser-extension/olx-connector` for the Chrome Web Store or managed
   enterprise distribution. During development only, load it unpacked from
   `chrome://extensions`.

There are no `OLX_CLIENT_ID` or `OLX_CLIENT_SECRET` settings. Avoid
`OLX_BROWSER_NO_SANDBOX=true`; it is only an explicit fallback for a separately
hardened root/container deployment.

## Manual connection test

1. Run Persona locally and sign in.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
   and select `browser-extension/olx-connector`.
3. Refresh Persona, open **My profile → Company settings → OLX.uz**, and
   confirm the connector is detected.
4. Press **Connect OLX.uz**. A new official OLX.uz tab opens.
5. Sign in normally. Complete any OLX CAPTCHA/SMS/OTP on OLX.uz. Persona cannot
   and must not complete it for you.
6. On the OLX.uz page, press **I am signed in — connect account** in the connector
   panel. The extension returns to Persona.
7. Press **Verify connection** and confirm the status remains Connected.

## Safe end-to-end publication test

Use a real draft that may safely be published, and avoid duplicate clicks:

1. Open an OLX publication form for a vacancy.
2. Select a live OLX job role and an exact location suggestion.
3. Use a 16–70 character title, an 80–9000 character description, a contact name,
   the work type, the employment level, and optional salary/Uzbek phone.
4. Press **Check form** once. Confirm Persona says no advert was published.
5. Press **Publish**, read the confirmation, and confirm once.
6. Verify the stored advert id/URL and the advert in the connected OLX account.
7. For a disposable test advert, archive/delete it manually on OLX.uz after the
   verification.

## Automated verification

```bash
bun run typecheck
bun run check
bun run i18n:check
bun test src/server/services/olx-api
bun run build
```

The OLX service tests cover token refresh/retry, authenticated request errors,
encryption/tamper detection, category parsing, location normalization, payload
composition, preview non-creation, and create/read-back behavior.

## Limitations and operational risk

OLX.uz can change its private endpoints, payload fields, token format, or web
storage without notice. This integration may then require an application and/or
extension update. It should be monitored and kept behind an explicit user
action. Do not increase request rates, add retries, bypass OLX challenges, or
describe this as an officially supported OLX integration.

If OLX rejects an otherwise valid request:

- run **Verify connection**; reconnect if required;
- use **Check form** once and read the returned field validation;
- confirm the category and exact location are still present in OLX's live
  dictionaries;
- check outbound access and OLX status;
- do not repeatedly retry a failed publish.
