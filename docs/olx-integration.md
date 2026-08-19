# olx.uz integration

## What is implemented

OLX's supported Partner API does not include olx.uz. Persona therefore uses the
same private JSON services as the olx.uz web application, without pretending
that they are a supported public API.

The flow is split into two parts:

1. A user installs the small Chrome extension in
   `browser-extension/olx-connector`, starts connection from Company settings,
   and signs in on the official `olx.uz` website.
2. The extension sends only the OLX access and refresh tokens plus OLX's device
   id, request fingerprint, and the allowlisted `deviceGUID` and `access_token` cookies through
   a single-use, 15-minute Persona ticket. OLX's current web client sends this
   context on authenticated requests, so the server preserves the same pairing.
   Persona verifies the account and stores the values encrypted. Later previews
   and publications run through a short-lived headless Chrome/Chromium network
   context on the Persona server. It performs the requested API call and closes;
   it does not automate OLX pages or retain an idle browser process. Status
   changes and deletion use a normal server-side GraphQL request and launch no
   browser process.

Passwords, CAPTCHA answers, and SMS/OTP codes are never requested by Persona,
never read by the extension, and never stored. Security checks must be completed
on olx.uz itself.

## Why the connector is necessary

olx.uz's tokens live in the user's browser origin and cannot be read by a normal
Talanty web page because of browser same-origin protections. The production
connector is limited to `www.olx.uz` and `admin.talanty.uz`. The unpacked
development manifest additionally supports localhost and 127.0.0.1. It runs
only after the user presses Connect and then presses the confirmation button
shown on olx.uz.

The extension does not automate login, click OLX controls, solve challenges,
hide automation, poll the website, or retain connection data in persistent
extension storage. Its OLX-only network listener copies `X-Device-Id` and
`X-Fingerprint` and the same request's allowlisted authentication cookies. It computes a
one-way SHA-256 digest of the active access token to select the exact matching
Auth0 cache entry, then discards the request value; the authorization header
itself is never stored or transmitted. Bodies, responses, and non-OLX traffic
are ignored.

## Server security model

- `createOlxConnectionTicket` creates a random one-time value bound to a hash of
  the exact configured Chrome extension-id allowlist. Only its SHA-256 hash is
  stored in `verification_token`; it expires after 15 minutes. Either approved
  extension can atomically claim the single row, so parallel redemptions cannot
  both win. The ticket is consumed only after the encrypted session is saved;
  failed verification releases the claim for a safe retry.
- `/api/integrations/olx/token-connect` exact-matches
  the official `OLX_CONNECTOR_EXTENSION_ID` plus any ids explicitly listed in
  `OLX_CONNECTOR_EXTENSION_IDS`, throttles by client IP, and enforces the
  payload limit while streaming before schema validation.
- `src/server/services/olx-api/crypto.ts` encrypts credentials with AES-256-GCM
  and a dedicated `OLX_CREDENTIALS_ENCRYPTION_KEY`. The ciphertext contains a
  key id for rotation and is authenticated with the user and OLX-session ids as
  additional data. Previous keys can be retained temporarily for decryption.
- Access and refresh tokens, device id, request fingerprint, and allowlisted OLX
  cookies never enter client React state, tRPC responses, logs, or vacancy
  metadata.
- Disconnect deletes the encrypted row. Expired/rejected tokens change the row
  to `reauth_required` and require the user to connect again.
- Credentials are retained only while the user keeps the integration connected.
  Reconnection replaces the prior ciphertext, explicit disconnect deletes it,
  and deleting the Persona user cascades deletion of the per-user OLX session.
- Legacy `AUTH_SECRET` ciphertext is read for migration and rewritten with the
  dedicated key after a successful operation. Rotating `AUTH_SECRET` no longer
  invalidates credentials written in the new format.

## Publication behavior

- Categories are parsed from olx.uz's live category state and cached in memory
  for six hours. Only selectable leaf categories of type `job` are shown.
- Location suggestions use olx.uz's posting geo-encoder. The user must select an
  exact suggestion, including a district where OLX requires one. Results are
  cached for 15 minutes. New forms start with Tashkent in the field. Cyrillic and
  Latin input are accepted; common English spellings such as `Tashkent`,
  `Samarkand`, and `Bukhara` are mapped to spellings understood by OLX's
  Uzbekistan search endpoint.
- Public dictionary requests first use the native HTTP client. OLX currently
  returns HTTP 403 to Node.js in some environments, so those requests fall back
  to one short-lived Chromium request and then use the caches above.
- The contact-phone field always starts with `+998`, keeps only nine national
  digits, and formats them as `+998 XX XXX XX XX` while the user types.
- **Publish** atomically claims the vacancy and persists a stable `posting-id`
  before sending one `POST /api/v1/offers` request. Concurrent attempts cannot
  both claim the row, and uncertain retries reuse the same idempotency key. If
  the response does not include the public URL, Persona
  performs one read-back by advert id. It does not resubmit.
- Once an OLX advert id is stored, the same publication record cannot be sent
  again. This remains true even if the public URL is delayed by moderation.
- A per-user 30-second cooldown and ten-operation hourly cap apply atomically to
  publication actions. Refresh-token operations are serialized per OLX account
  with a PostgreSQL advisory lock.
- Changing the publications-table status sends the same `UpdateAd` GraphQL
  mutation as olx.uz's current **My ads** page, with `DEACTIVATE` or `ACTIVATE`.
  Persona changes its local status only after OLX accepts the mutation.
- Permanent deletion is available only after deactivation. Persona sends one
  `REMOVE` mutation first and removes the local publication only after OLX
  succeeds. For rows with a recorded publishing account, an OLX not-found result
  is treated as idempotent success because the remote advert is already gone;
  legacy rows fail closed until a successful lifecycle mutation establishes
  ownership.
- Lifecycle actions have a ten-second shared cooldown and a twenty-operation
  hourly cap per connected OLX account. They are never run by a background task. A rejected
  access token can trigger one refresh-and-replay; other failures are not retried.
- The publishing user's id is stored with new OLX adverts. Only that authenticated
  user can activate, deactivate, or delete the remote advert; teammates cannot
  operate the publisher's personal OLX credentials. Older rows adopt the current
  account only after OLX successfully accepts a lifecycle mutation.

## Linux deployment

Install Google Chrome or Chromium. Headless mode needs no display server. Deploy
like the rest of Persona:

1. Pull the branch and run `bun install --frozen-lockfile`.
2. Set a random, backed-up `OLX_CREDENTIALS_ENCRYPTION_KEY` of at least 32
   characters and set `OLX_CONNECTOR_EXTENSION_ID` to the exact production
   Chrome Web Store id. To support known unpacked development builds, set
   `OLX_CONNECTOR_EXTENSION_IDS` to a comma-separated list of their exact ids;
   never use a wildcard origin. During key rotation, put old keys in
   `OLX_CREDENTIALS_PREVIOUS_ENCRYPTION_KEYS` as a comma-separated list.
3. Commit the generated migration. The production workflow applies it with
   `bun run db:migrate-custom` after taking a verified database backup.
4. Install a current `google-chrome-stable` or `chromium` package. Common paths
   are detected automatically; otherwise set `OLX_BROWSER_EXECUTABLE_PATH`.
   `scripts/deploy.sh` runs the production service as the unprivileged
   `persona-web` user so the Chrome sandbox stays enabled. Production ignores
   `OLX_BROWSER_NO_SANDBOX=true`; it cannot disable the sandbox. Chromium launches are
   bounded to two concurrent processes with a finite queue and circuit breaker;
   additionally apply container/process memory and CPU limits in production.
5. Ensure outbound HTTPS/DNS can reach `login.olx.uz`, `www.olx.uz`,
   `categories.olxcdn.com`, and
   `production-graphql.eu-sharedservices.olxcdn.com`.
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
3. Refresh Persona, open **My profile → Company settings → olx.uz**, and
   confirm the connector is detected.
4. Press **Connect olx.uz**. A new official olx.uz tab opens.
5. Sign in normally. Complete any OLX CAPTCHA/SMS/OTP on olx.uz. Persona cannot
   and must not complete it for you.
6. On the olx.uz page, press **I am signed in — connect account** in the connector
   panel. The extension returns to Persona.
7. Confirm Company settings shows the account status as **Connected**.

## Safe end-to-end publication test

Use a real draft that may safely be published, and avoid duplicate clicks:

1. Open an OLX publication form for a vacancy.
2. Select a live OLX job role and an exact location suggestion.
3. Use a 16–70 character title, an 80–9000 character description, a contact name,
   the work type, the employment level, and optional salary/Uzbek phone.
4. Press **Publish** once. Correct any validation messages shown by Persona.
5. Read the confirmation and confirm once.
6. Verify the stored advert id/URL and the advert in the connected OLX account.
7. In Persona's publications table, change the advert to **Inactive** once and
   verify it is hidden in the connected OLX account.
8. Change it back to **Active** once and verify it becomes visible again.
9. To test permanent deletion, deactivate it again, press the trash button, read
   the irreversible-action confirmation, and confirm once. Verify it is gone
   from both OLX and Persona.

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
composition, preview non-creation, create/read-back behavior, activation,
deactivation, idempotent remote deletion, and permanent deletion request shape.

## Limitations and operational risk

olx.uz can change its private endpoints, payload fields, token format, or web
storage without notice. This integration may then require an application and/or
extension update. It should be monitored and kept behind an explicit user
action. Do not increase request rates, add retries, bypass OLX challenges, or
describe this as an officially supported OLX integration.

If OLX rejects an otherwise valid request:

- reconnect the account if Company settings shows **Sign-in required**;
- press **Publish** once and read the returned field validation;
- confirm the category and exact location are still present in OLX's live
  dictionaries;
- check outbound access and OLX status;
- do not repeatedly retry a failed publish.
