# OLX.uz Partner API integration

Last verified: 2026-07-23

## What is implemented

Persona can connect one OLX.uz account per application user and create, edit,
activate, deactivate, and delete OLX job adverts from the existing vacancy
publication flow.

The implementation includes:

- OAuth 2.0 authorization-code flow with a signed, user-bound, 15-minute state;
- per-user access/refresh-token storage and automatic refresh;
- Partner API v2 headers (`Authorization`, `Version: 2.0`,
  `Accept-Language: ru`);
- live OLX Jobs categories, category attributes, cities, districts, and
  currencies;
- a dynamic Russian-language publication form;
- OLX-compatible HTML sanitization and documented content validation;
- idempotent creation through `external_id`;
- full advert lifecycle commands and safe delete-after-deactivation;
- local persistence of the OLX advert id, URL, status, and category-owned form
  values;
- read-through status reconciliation when the publication list opens, including
  asynchronous moderation and payment-required states;
- mocked Partner API contract tests. OLX has no sandbox.

Inbound OLX conversations/applicants are not imported. The public Partner API
contract used here exposes advert management and messages, but OLX's general
Developer Hub says Leads require authentication, advert lifecycle, and webhook
products. OLX.uz does not publicly list which of those products it enables. That
scope must be confirmed with OLX before candidate ingestion can be designed.

## Access finding

OLX.uz does not currently expose a working public, self-service developer portal
at `developer.olx.uz`; that hostname resolves to an OLX-branded 404. The general
[OLX Developer Hub FAQ](https://developer.olxgroup.com/faq) lists supported
European marketplaces and explicitly directs integrations for an unlisted
marketplace to contact that marketplace directly.

At the same time, the production OLX.uz endpoints are deployed:

- `POST https://www.olx.uz/api/open/oauth/token` returns a standard OAuth
  `invalid_client` response for invalid credentials.
- `GET https://www.olx.uz/api/partner/categories` requires the `Version` header,
  and with `Version: 2.0` returns `invalid_token` without a valid token.

This implementation therefore uses OLX.uz production hosts with the official
OLX Partner API v2 contract published for the neighboring OLX Kazakhstan
marketplace:

- [OLX KZ API documentation](https://developer.olx.kz/api/doc)
- [OLX KZ Partner API v2 OpenAPI document](https://developer.olx.kz/swagger/v2/partner_api.yaml)
- [OLX KZ access process](https://developer.olx.kz/articles/getting-access-to-api)

The contract still needs one end-to-end verification with credentials explicitly
provisioned for OLX.uz. Do not use KZ, UA, or another marketplace's credentials
against OLX.uz.

## What to request from OLX

Use the [OLX.uz business jobs request form](https://business.olx.uz/rabota/) and
ask the manager for Partner API v2 access for a recruitment CRM. The general
developer support address listed by OLX is `developer-support@olx.com`.

The request should state:

- product: posting and managing job adverts from a CRM;
- marketplace: `www.olx.uz`;
- OAuth flow: authorization code;
- scopes: `read write v2`;
- required resources: authenticated user, categories/attributes,
  cities/districts, currencies, adverts, and advert commands;
- production callback URL:
  `https://<your-domain>/api/integrations/olx/callback`;
- whether the OLX.uz Jobs category requires a paid business package;
- whether OLX.uz enables Leads/webhooks or only messages for API-created job
  adverts.

The OLX.uz business page describes paid Start/Premium job packages. The Partner
API may create an advert with `limited` or `unpaid` status when the connected
account lacks an eligible placement. Persona preserves that state and asks the
user to buy or assign a package instead of reporting a false success.

## Configuration

Add these server-only values:

```dotenv
OLX_CLIENT_ID="<issued by OLX>"
OLX_CLIENT_SECRET="<issued by OLX>"
OLX_REDIRECT_URI="https://<your-domain>/api/integrations/olx/callback"
```

Optional:

```dotenv
OLX_JOBS_CATEGORY_ID="<numeric jobs root returned by OLX>"
```

`OLX_JOBS_CATEGORY_ID` is only needed if OLX.uz localizes the Jobs root to a
name the automatic `Работа` / `Вакансии` / `Ish` / `Vakansiyalar` / `Jobs`
detection does not recognize.

Never put these values in `NEXT_PUBLIC_*`, commit them, or send the Client Secret
through chat. The callback must exactly match a URL registered by OLX. For local
testing, register a stable HTTPS tunnel URL; OLX has no sandbox.

After adding the variables:

```sh
bun run db:push
bun dev
```

Then open **Мой профиль → Настройки компании → OLX.uz аккаунт**, connect the
OLX.uz business account, and authorize `read`, `write`, and `v2`.

## Data model

`user_olx_account` stores one connected OLX account per Persona user:

- OLX user id and basic account/contact profile;
- access and refresh tokens as PostgreSQL `text`;
- access-token expiry and granted scope;
- business-account flag.

`vacancy` publication rows store:

- `olx_advert_id`;
- `olx_advert_url`;
- `olx_advert_status`;
- `olx_meta` JSON containing category, advertiser type, location, contact,
  salary behavior, auto-extension, and dynamic category attributes.

All new vacancy fields are nullable, and the account table's only new
non-null business flag has a database default. This keeps production
`drizzle-kit push` safe on populated databases.

## API and lifecycle behavior

### OAuth

- authorize: `GET https://www.olx.uz/oauth/authorize/`
- token/refresh: `POST https://www.olx.uz/api/open/oauth/token`
- scopes: `read write v2`
- profile: `GET /api/partner/users/me`
- refresh tokens are documented as valid for one month and can rotate;
  Persona saves the new refresh token when returned.

### Catalogs

The editor reads all select options from OLX:

- `GET /categories` and `GET /categories/{id}/attributes`;
- `GET /cities` and `GET /cities/{id}/districts`;
- `GET /currencies`.

The category loader supports both a flat tree response and one-level-at-a-time
responses.

### Adverts

- list/filter: `GET /adverts?external_id=<publication-id>`;
- create: `POST /adverts`;
- read/update/delete: `GET|PUT|DELETE /adverts/{id}`;
- lifecycle: `POST /adverts/{id}/commands`.

Before POST, Persona searches by the stable local publication id in
`external_id`. A retry after an uncertain network outcome updates the matching
advert rather than creating a duplicate.

OLX creation statuses are handled as follows:

| OLX status | Persona behavior |
| --- | --- |
| `new`, `moderated`, `unconfirmed` | Show “На модерации”; do not allow a premature status toggle |
| `active` | Show published and active |
| `limited`, `unpaid` | Show “Требует оплаты”; preserve the remote advert for retry after a package is available |
| `removed_by_user`, `outdated`, `blocked`, `disabled`, `removed_by_moderator` | Show inactive |

OLX is the source of truth for the remote status. Opening the publication list
refreshes each connected OLX advert and updates the local status/URL.

### Preflight validation

Persona applies OLX's published v2 rules before making a request:

- title length: 16–150 visible characters;
- description length: 80–9000 visible characters;
- no more than 50% uppercase letters;
- no email addresses, web addresses, or phone numbers in title/description;
- no listed punctuation character three times consecutively;
- salary currency uppercase;
- salary values no greater than `99,999,999,999,999`;
- Jobs HTML limited to `p`, `ul`, `li`, `strong`, and `em`;
- required and numeric category attributes checked from the live taxonomy.

OLX remains the canonical validator and its field-level errors are returned in
Russian through tRPC.

## Production verification checklist

Because OLX has no sandbox, use an approved low-risk business account and a real
test vacancy agreed with OLX:

1. Apply the schema and deploy the three environment values.
2. Connect the account and confirm the profile appears in company settings.
3. Confirm the live list contains OLX.uz Jobs leaf categories, Uzbekistan
   cities, and `UZS`.
4. Create a test advert with a unique title and all required category fields.
5. Confirm the same OLX advert id and URL exist in Persona and OLX.uz.
6. Retry publication and confirm no duplicate advert is created.
7. Edit title/description and confirm the existing advert changes.
8. Observe moderation status changing to `active` after reopening the
   publication list.
9. Deactivate, reactivate, and finally deactivate/delete the test advert.
10. Force an expired token or wait for expiry and confirm automatic refresh.
11. Revoke the OLX authorization and confirm Persona asks for reconnection.
12. Test an account without a package and confirm `limited` / `unpaid` is shown
    as requiring payment rather than success.

Automated verification commands:

```sh
bun test
bun run typecheck
bun run check
bun run build
```

The live checklist cannot be completed without OLX.uz-issued credentials and an
approved account/package.
