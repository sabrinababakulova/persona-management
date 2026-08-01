# Companies, roles, and sign-up

How an account gets a company, who owns that company, and what each role may do.

## Roles

Every user belongs to exactly one company (`user.companyId`). The hierarchy is **master → admin → member**.

| Attribute | Values | Who writes it | Editable |
|---|---|---|---|
| `user.isMasterAccount` | `true` \| `false` (default `false`) | registration only — `true` for whoever created the company | no — read-only in Directus, SQL only |
| `user.role` | `admin` \| `member` (default `member`) | the master account (Настройки компании → Команда), registration, `company.acceptInvitation` | yes — in the app and in Directus |
| `user.deactivatedAt` | timestamp \| `null` | the master account, when it removes someone | yes — clearing it in Directus restores access |

- **Master account** — the creator. Full rights: everything an admin can do, plus changing anyone's role and removing/restoring their access. One per company (`user_company_master_idx`), and it outranks `role`: even if its role is edited to `member` in Directus it keeps admin rights. Nobody can demote or deactivate it — not even itself.
- **Admin** — may edit the company profile/logo and manage invitation links. Cannot touch other people. A company can have **any number of admins**; the master promotes and demotes them.
- **Member** — read-only view of the company profile.
- **Deactivated** — removed from the company by the master. The row is kept (name, email, history stay visible in the roster), but the account cannot sign in at all: credentials login and Google both reject it, and an existing session dies on its next token refresh. Because it cannot sign in, it cannot join another company either. The master can restore access from the same modal.

Constants live in `src/shared/company-roles.ts`; server guards in `src/server/api/router-utils/company.ts` (`getCompanyMembership`, `requireCompanyAdmin`, `requireCompanyMaster`).

### Permission matrix

| Action | master | admin | member |
|---|---|---|---|
| View company profile (`company.get`, `company.listMembers`) | ✅ | ✅ | ✅ |
| Edit company details / logo (`company.update`, `company.updateLogo`) | ✅ | ✅ | ❌ |
| List / create / revoke invite links | ✅ | ✅ | ❌ |
| Change a member's role (`company.updateMemberRole`) | ✅ | ❌ | ❌ |
| Remove / restore a member (`company.setMemberActive`) | ✅ | ❌ | ❌ |
| Accept an invite (`company.acceptInvitation`) | ✅\* | ✅\* | ✅\* |

\* Only from the shared default company — someone already inside a real company is rejected, because moving them would strand the data they created.

### Managing members (UI)

**Настройки компании → Команда** lists everyone with a role badge (Владелец / Администратор / Сотрудник) and a "Доступ отключен" badge for deactivated accounts. The master account gets a pencil button on every row except its own, opening a modal with:

- a **role selector** (Администратор / Сотрудник) plus a one-line description of what the selected role may do, saved with `company.updateMemberRole`;
- **«Удалить участника»**, which replaces the modal body with a Да / Нет confirmation and calls `company.setMemberActive({ isActive: false })`;
- **«Восстановить доступ»** for an already-deactivated member.

The server re-checks everything: both mutations run through `requireCompanyMaster`, resolve the target inside the caller's own company, and refuse to act on the master account.

## Sign-up

`src/app/register/page.tsx` — three UI steps, then e-mail verification.

```
 1. account            2. company-choice              3. company-form
 ┌──────────────┐      ┌───────────────────────┐      ┌──────────────────┐
 │ name, email  │ ───► │ Создать компанию      │ ───► │ name*, city,     │
 │ password     │      │ Присоединиться (hint) │      │ country, site,   │
 └──────────────┘      └───────────────────────┘      │ phone, about     │
        │                                             └──────────────────┘
        │ ?invite=<token> present → skip both company steps    │
        └───────────────────────────┬─────────────────────────-┘
                                    ▼
                   signIn("credentials", { mode: "register", … })
                                    ▼
                    6-digit code by e-mail → mode: "verify-code"
                                    ▼
                              /dashboard
```

"Присоединиться к существующей компании" is not a self-service flow: it shows a hint telling the user to open the invite link their admin sends.

### What the server does (`authorize`, `mode: "register"`)

1. Validate name/email/password (`registerSchema`); reject an already-verified e-mail.
2. Rate limits: 3 registrations per hour per e-mail and per IP, plus a 60-second resend cooldown.
3. Decide the company:
   - **invite token** (`findUsableInvitation`) → join that company as `member`, `isMasterAccount: false`;
   - **`company*` credentials** (validated with `updateCompanySchema`) → `INSERT` the company, the account becomes `admin` + `isMasterAccount: true`;
   - **neither** (Google, older clients) → the shared default company as `member`.
4. Create the unverified user, store an HMAC-hashed 6-digit code (10 min) and a flow id (30 min), send the e-mail, and throw `verification_required:<flowId>` so the client moves to the code screen.
5. On any failure the attempt is rolled back — the user row and a company created for that attempt are both deleted.

Retrying registration with the same unverified e-mail updates the company created by the previous attempt instead of leaving an orphan behind.

### Verification (`mode: "verify-code"`)

Validates the code (8 attempts / 15 min per flow and per IP), sets `emailVerified` and issues the session. A company chosen at step 3 is preserved.

## Sign-in

`src/app/login/page.tsx` + `login-form.tsx`, `mode: "login"`.

1. 5 attempts / 15 min per e-mail and per IP.
2. Password compared with bcrypt (argon2 hashes are still accepted); unverified e-mails and deactivated accounts (`account_deactivated`) are rejected.
3. JWT session (no DB sessions). `passwordChangedAt` newer than the token's `iat` invalidates the session on refresh.
4. Redirect: `/dashboard`, or back to `/invite/<token>` when the user arrived from an invite link (`/login?invite=…`).

Google OAuth (enabled only when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set) refuses deactivated accounts and marks the e-mail verified. It deliberately does **not** assign a company — see "Company onboarding" below.

The `jwt` callback re-reads the user on every session refresh: a deactivated account (or a password changed after the token was issued) drops the session id, so the app treats it as signed out.

`src/middleware.ts` gates `/dashboard`, `/candidates`, `/vacancies`, `/my-profile`, `/onboarding`. `/invite/*` is public.

## Company onboarding (Google sign-ups)

A Google sign-in never passes through the registration form, so the account arrives with no
company. Instead of dropping it into a shared default company, the app asks:

1. The `jwt` callback puts `needsCompany` in the token (`true` while `users.companyId` is null).
2. `src/middleware.ts` redirects any signed-in request with `needsCompany` to `/onboarding/company`.
3. That page shows the same "create a company or join one" step as registration — both render
   `CompanySetupSteps` (`src/app/_components/company-setup-steps.tsx`) — and submits to
   `company.createForCurrentUser`, which creates the company and makes the account its `admin`
   and master. It also offers signing out, for someone who used the wrong Google account.
4. On success the client refreshes the session (`useSession().update()`) so the token drops
   `needsCompany`, then reloads into `/dashboard`.

An invite link still short-circuits this: `/invite/<token>` is public, so a Google user coming
from an invite signs in, lands back on the invite page and joins that company as a `member`.

A stale cookie (token says "no company", database disagrees) cannot cause a redirect loop: the
onboarding page renders a client that refreshes the session and moves on by itself.

## Inviting people

1. A master or admin opens **Мой профиль → Настройки компании → Команда** and clicks "Пригласить людей" (`company.createInvitation`).
2. A link `/invite/<token>` is created: 43-char base64url token, valid 14 days, multi-use, revocable, max 10 active links per company. The token is stored as-is so the link stays copyable.
3. The recipient opens it:
   - **not signed in** → "Создать аккаунт" (`/register?invite=…`) or "У меня уже есть аккаунт" (`/login?invite=…`, which returns to the invite page);
   - **signed in** → "Присоединиться" → `company.acceptInvitation` sets `companyId`, `role: member`, `isMasterAccount: false`.

Unknown, expired, and revoked tokens are indistinguishable to the caller — all render the same "ссылка недействительна" page.

## Operating notes

- **Change a role:** normally in-app (master account → Команда). Directus → `user` → `role` is the fallback; any number of admins is fine.
- **`isMasterAccount` is read-only in Directus** by design — it records who created the company. Accounts that predate the flag stay `false` and can only be corrected with SQL.
- **Restore a removed account:** the master can do it in the app, or clear `user.deactivatedAt` in Directus.
- Field metadata for all three columns is applied by `scripts/register-directus-collections.sh` (run by `scripts/setup.sh`).
- **Deleting a user in Directus** is possible: `account`, `session`, `company_hh_account`, `company_telegram_channel` and `user_olx_account` rows cascade away, while `recent_activity_log.actorUserId`, `ai_usage_log.user_id` and `company_invitation.createdById` are set to NULL so the history survives (the log keeps `actorName`). Prefer deactivation — deletion loses the person's identity in past activity.
- Existing installs: everyone starts as `member` with no master account, so no one can edit a pre-existing company until a role is set in Directus.

## Key files

| Area | File |
|---|---|
| Role constants / helpers | `src/shared/company-roles.ts` |
| Permission guards | `src/server/api/router-utils/company.ts` |
| Company + invite API | `src/server/api/routers/company.ts` |
| Registration / login / OAuth | `src/server/auth/config.ts` |
| Invite tokens | `src/server/company/invitations.ts`, `src/shared/invitation-token.ts` |
| Sign-up UI | `src/app/register/page.tsx`, `src/app/_components/company-setup-steps.tsx` |
| Company onboarding | `src/app/onboarding/company/` |
| Invite landing page | `src/app/invite/[token]/` |
| Company settings UI | `src/app/my-profile/company-profile-section.tsx`, `company-profile-view.tsx`, `company-invite-section.tsx`, `member-manager-modal.tsx` |
| Schema | `src/server/db/schema.ts` (`companies`, `users`, `companyInvitations`) |
