import { DrizzleAdapter } from "@auth/drizzle-adapter";
import * as argon2 from "argon2";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextAuthConfig } from "next-auth";
import { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { env } from "~/env";
import type { UpdateCompanyInput } from "~/schemas/company";
import { updateCompanySchema } from "~/schemas/company";
import { registerSchema } from "~/schemas/register";
import {
  createEmailVerificationFlowIdentifier,
  createEmailVerificationIdentifier,
  createRateLimitIdentifier,
  EMAIL_VERIFICATION_CODE_TTL_MS,
  EMAIL_VERIFICATION_FLOW_TTL_MS,
  generateEmailVerificationCode,
  generateEmailVerificationFlowId,
  hashEmailVerificationCode,
  isEmailVerificationCodeValid,
  isEmailVerificationFlowIdValid,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  normalizeEmail,
  REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
  REGISTER_RATE_LIMIT_WINDOW_MS,
  REGISTER_RESEND_COOLDOWN_MS,
  VERIFY_RATE_LIMIT_MAX_ATTEMPTS,
  VERIFY_RATE_LIMIT_WINDOW_MS,
} from "~/server/auth/email-verification";
import {
  clearIdentifier,
  hasActiveRecord,
  isRateLimited,
  recordAttempt,
  setMarker,
} from "~/server/auth/rate-limit";
import { toCompanyColumns } from "~/server/company/company-input";
import {
  findUsableInvitation,
  markInvitationUsed,
} from "~/server/company/invitations";
import { db } from "~/server/db";
import {
  accounts,
  companies,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";
import { sendRegistrationCode } from "~/server/mail/send-registration-code";
import { getDirectusAssetUrl } from "~/server/storage/directus-storage";
import {
  COMPANY_ROLE_ADMIN,
  COMPANY_ROLE_MEMBER,
  isCompanyAdmin,
} from "~/shared/company-roles";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";

class AuthFlowError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

const VERIFICATION_REQUIRED_CODE_PREFIX = "verification_required:";

function getClientIp(request: Request) {
  // Prefer x-real-ip set by the reverse proxy (most reliable)
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  // Fall back to the rightmost IP in x-forwarded-for
  // (the last proxy in the chain appends the real client IP)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    const rightmost = ips[ips.length - 1];
    if (rightmost) {
      return rightmost;
    }
  }

  return "unknown";
}

/**
 * Google vouches for the address, so the account counts as verified.
 *
 * It deliberately does NOT hand out a company: a Google sign-up has not been through the
 * "create or join a company" step yet, and `/onboarding/company` asks for it on first visit.
 */
async function markEmailVerified(userId: string) {
  await db
    .update(users)
    .set({
      emailVerified: new Date(),
    })
    .where(and(eq(users.id, userId), isNull(users.emailVerified)));
}

/** Null for an account that has not picked a company yet — see `/onboarding/company`. */
async function getUserCompanyId(userId: string) {
  const [user] = await db
    .select({ companyId: users.companyId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.companyId ?? null;
}

/** True when the master account removed this person from the company. */
async function isAccountDeactivated(userId: string) {
  const [user] = await db
    .select({ deactivatedAt: users.deactivatedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return Boolean(user?.deactivatedAt);
}

/**
 * Company details captured by the "create new company" step of registration.
 *
 * Returns null when the client sent none — invite sign-ups, Google, or an older client — in
 * which case the account keeps the previous default-company behaviour.
 */
function parseNewCompanyCredentials(
  credentials: Partial<Record<string, unknown>> | undefined,
) {
  const name = credentials?.companyName?.toString() ?? "";
  if (!name.trim()) {
    return null;
  }

  const parsed = updateCompanySchema.safeParse({
    name,
    city: credentials?.companyCity?.toString() ?? "",
    country: credentials?.companyCountry?.toString() ?? "",
    description: credentials?.companyDescription?.toString() ?? "",
    website: credentials?.companyWebsite?.toString() ?? "",
    phone: credentials?.companyPhone?.toString() ?? "",
  });

  if (!parsed.success) {
    throw new AuthFlowError("invalid_data");
  }

  return parsed.data;
}

async function createCompany(input: UpdateCompanyInput) {
  const [company] = await db
    .insert(companies)
    .values(toCompanyColumns(input))
    .returning({ id: companies.id });

  if (!company) {
    throw new AuthFlowError("registration_failed");
  }

  return company.id;
}

/** The company this user already created (and administers), if registration is being retried. */
async function getOwnedCompanyId(userId: string) {
  const [current] = await db
    .select({ companyId: users.companyId, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (
    !current?.companyId ||
    current.companyId === DEFAULT_COMPANY_ID ||
    !isCompanyAdmin(current.role)
  ) {
    return null;
  }

  return current.companyId;
}

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Credentials",
    credentials: {
      mode: { label: "Mode", type: "text" },
      firstName: { label: "First Name", type: "text" },
      lastName: { label: "Last Name", type: "text" },
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      code: { label: "Code", type: "text" },
      flowId: { label: "Flow ID", type: "text" },
      inviteToken: { label: "Invite Token", type: "text" },
      // "Create new company" step — see `parseNewCompanyCredentials`.
      companyName: { label: "Company Name", type: "text" },
      companyCity: { label: "Company City", type: "text" },
      companyCountry: { label: "Company Country", type: "text" },
      companyDescription: { label: "Company Description", type: "text" },
      companyWebsite: { label: "Company Website", type: "text" },
      companyPhone: { label: "Company Phone", type: "text" },
    },
    async authorize(credentials, request) {
      const mode = credentials?.mode?.toString().trim().toLowerCase();
      const clientIp = getClientIp(request);

      if (mode === "register") {
        const parsed = registerSchema.safeParse({
          firstName: credentials?.firstName,
          lastName: credentials?.lastName,
          email: credentials?.email,
          password: credentials?.password,
        });

        if (!parsed.success) {
          throw new AuthFlowError("invalid_data");
        }

        const { firstName, lastName, password } = parsed.data;
        const email = normalizeEmail(parsed.data.email);

        const registerRateIdentifier = createRateLimitIdentifier(
          "register",
          email,
        );
        const registerRateByIpIdentifier = createRateLimitIdentifier(
          "register-ip",
          clientIp,
        );
        const registerCooldownIdentifier = createRateLimitIdentifier(
          "register-cooldown",
          email,
        );

        if (
          (await isRateLimited(
            registerRateIdentifier,
            REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
          )) ||
          (await isRateLimited(
            registerRateByIpIdentifier,
            REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
          )) ||
          (await hasActiveRecord(registerCooldownIdentifier))
        ) {
          throw new AuthFlowError("rate_limited");
        }

        // Always hash the password BEFORE checking user existence
        // to prevent timing-based user enumeration
        const hashedPassword = await bcrypt.hash(password, 12);

        const [existingUser] = await db
          .select({ id: users.id, emailVerified: users.emailVerified })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existingUser?.emailVerified) {
          // Record rate limit attempts (same timing as the normal flow)
          await recordAttempt(
            registerRateIdentifier,
            REGISTER_RATE_LIMIT_WINDOW_MS,
          );
          await recordAttempt(
            registerRateByIpIdentifier,
            REGISTER_RATE_LIMIT_WINDOW_MS,
          );
          throw new AuthFlowError("registration_failed");
        }

        // Where the account lands: an invite link joins an existing company as a member, the
        // "create new company" step creates a company owned by this user. Neither (Google
        // sign-ups, older clients) falls back to the shared default company.
        const inviteToken = credentials?.inviteToken?.toString().trim();
        const invitation = inviteToken
          ? await findUsableInvitation(inviteToken)
          : null;
        const newCompany = invitation
          ? null
          : parseNewCompanyCredentials(credentials);

        const verificationCode = generateEmailVerificationCode();

        let createdUserId: string | null = null;
        let createdCompanyId: string | null = null;
        let verificationIdentifier: string | null = null;
        let verificationFlowIdentifier: string | null = null;

        try {
          let verificationUserId: string | undefined;

          if (existingUser?.id) {
            // Unverified user exists: delete old verification tokens
            // but do NOT overwrite their password (prevents race condition
            // where an attacker could set a password for someone else's email)
            verificationUserId = existingUser.id;
            const oldVerificationId =
              createEmailVerificationIdentifier(verificationUserId);
            await db
              .delete(verificationTokens)
              .where(eq(verificationTokens.identifier, oldVerificationId));

            if (invitation) {
              await db
                .update(users)
                .set({
                  companyId: invitation.companyId,
                  role: COMPANY_ROLE_MEMBER,
                  isMasterAccount: false,
                })
                .where(eq(users.id, verificationUserId));
            } else if (newCompany) {
              // Registration was retried: update the company from the earlier attempt instead
              // of leaving an orphan behind.
              const ownedCompanyId =
                await getOwnedCompanyId(verificationUserId);

              if (ownedCompanyId) {
                await db
                  .update(companies)
                  .set(toCompanyColumns(newCompany))
                  .where(eq(companies.id, ownedCompanyId));
                // Repairs accounts that created a company before the flag existed.
                await db
                  .update(users)
                  .set({ isMasterAccount: true })
                  .where(eq(users.id, verificationUserId));
              } else {
                createdCompanyId = await createCompany(newCompany);
                await db
                  .update(users)
                  .set({
                    companyId: createdCompanyId,
                    role: COMPANY_ROLE_ADMIN,
                    isMasterAccount: true,
                  })
                  .where(eq(users.id, verificationUserId));
              }
            }
          } else {
            if (newCompany) {
              createdCompanyId = await createCompany(newCompany);
            }

            verificationUserId = (
              await db
                .insert(users)
                .values({
                  email,
                  name: `${firstName} ${lastName}`.trim(),
                  password: hashedPassword,
                  hasSeenWelcomeModal: false,
                  // No invite and no company payload (an older client): leave it unset and let
                  // `/onboarding/company` ask, instead of dropping them into a shared company.
                  companyId: invitation?.companyId ?? createdCompanyId ?? null,
                  // Only the person who creates a company is its admin — and its permanent
                  // master account, which no later role change can transfer.
                  role: createdCompanyId
                    ? COMPANY_ROLE_ADMIN
                    : COMPANY_ROLE_MEMBER,
                  isMasterAccount: Boolean(createdCompanyId),
                })
                .returning({ id: users.id })
            )[0]?.id;

            if (!verificationUserId) {
              throw new AuthFlowError("registration_failed");
            }

            createdUserId = verificationUserId;
          }

          const flowId = generateEmailVerificationFlowId();
          verificationIdentifier =
            createEmailVerificationIdentifier(verificationUserId);
          verificationFlowIdentifier =
            createEmailVerificationFlowIdentifier(flowId);

          await db
            .delete(verificationTokens)
            .where(eq(verificationTokens.identifier, verificationIdentifier));

          await db.insert(verificationTokens).values({
            identifier: verificationIdentifier,
            token: hashEmailVerificationCode(
              verificationCode,
              verificationUserId,
            ),
            expires: new Date(Date.now() + EMAIL_VERIFICATION_CODE_TTL_MS),
          });

          await db.insert(verificationTokens).values({
            identifier: verificationFlowIdentifier,
            token: verificationUserId,
            expires: new Date(Date.now() + EMAIL_VERIFICATION_FLOW_TTL_MS),
          });

          await sendRegistrationCode(email, verificationCode);

          await recordAttempt(
            registerRateIdentifier,
            REGISTER_RATE_LIMIT_WINDOW_MS,
          );
          await recordAttempt(
            registerRateByIpIdentifier,
            REGISTER_RATE_LIMIT_WINDOW_MS,
          );
          await setMarker(
            registerCooldownIdentifier,
            REGISTER_RESEND_COOLDOWN_MS,
          );

          if (invitation) {
            await markInvitationUsed(invitation.id);
          }

          throw new AuthFlowError(
            `${VERIFICATION_REQUIRED_CODE_PREFIX}${flowId}`,
          );
        } catch (error) {
          if (
            error instanceof AuthFlowError &&
            error.code.startsWith(VERIFICATION_REQUIRED_CODE_PREFIX)
          ) {
            throw error;
          }

          if (createdUserId) {
            const verificationIdentifier =
              createEmailVerificationIdentifier(createdUserId);
            await db
              .delete(verificationTokens)
              .where(eq(verificationTokens.identifier, verificationIdentifier))
              .catch(() => undefined);
            await db
              .delete(users)
              .where(eq(users.id, createdUserId))
              .catch(() => undefined);
          }

          // Drop the company created for this attempt — after the user row, which references it.
          if (createdCompanyId) {
            await db
              .delete(companies)
              .where(eq(companies.id, createdCompanyId))
              .catch(() => undefined);
          }

          if (verificationIdentifier) {
            await db
              .delete(verificationTokens)
              .where(eq(verificationTokens.identifier, verificationIdentifier))
              .catch(() => undefined);
          }

          if (verificationFlowIdentifier) {
            await db
              .delete(verificationTokens)
              .where(
                eq(verificationTokens.identifier, verificationFlowIdentifier),
              )
              .catch(() => undefined);
          }

          if (error instanceof AuthFlowError) {
            throw error;
          }

          throw new AuthFlowError("registration_failed");
        }
      }

      if (mode === "verify-code") {
        const flowId = credentials?.flowId?.toString().trim();
        const code = credentials?.code?.toString().trim();

        if (
          !flowId ||
          !code ||
          !isEmailVerificationFlowIdValid(flowId) ||
          !isEmailVerificationCodeValid(code)
        ) {
          return null;
        }

        const verifyRateIdentifier = createRateLimitIdentifier(
          "verify",
          flowId,
        );
        const verifyRateByIpIdentifier = createRateLimitIdentifier(
          "verify-ip",
          clientIp,
        );

        if (
          await isRateLimited(
            verifyRateIdentifier,
            VERIFY_RATE_LIMIT_MAX_ATTEMPTS,
          )
        ) {
          throw new AuthFlowError("rate_limited");
        }

        if (
          await isRateLimited(
            verifyRateByIpIdentifier,
            VERIFY_RATE_LIMIT_MAX_ATTEMPTS,
          )
        ) {
          throw new AuthFlowError("rate_limited");
        }

        const verificationFlowIdentifier =
          createEmailVerificationFlowIdentifier(flowId);

        const [flowRecord] = await db
          .select({ userId: verificationTokens.token })
          .from(verificationTokens)
          .where(
            and(
              eq(verificationTokens.identifier, verificationFlowIdentifier),
              gt(verificationTokens.expires, new Date()),
            ),
          )
          .limit(1);

        const verificationUserId = flowRecord?.userId;
        if (!verificationUserId) {
          return null;
        }

        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            avatarFileId: users.avatarFileId,
            image: users.image,
          })
          .from(users)
          .where(eq(users.id, verificationUserId))
          .limit(1);

        if (!user) {
          return null;
        }

        const verificationIdentifier =
          createEmailVerificationIdentifier(verificationUserId);

        const [verificationToken] = await db
          .select({ token: verificationTokens.token })
          .from(verificationTokens)
          .where(
            and(
              eq(verificationTokens.identifier, verificationIdentifier),
              eq(
                verificationTokens.token,
                hashEmailVerificationCode(code, verificationUserId),
              ),
              gt(verificationTokens.expires, new Date()),
            ),
          )
          .limit(1);

        if (!verificationToken) {
          await recordAttempt(
            verifyRateIdentifier,
            VERIFY_RATE_LIMIT_WINDOW_MS,
          );
          await recordAttempt(
            verifyRateByIpIdentifier,
            VERIFY_RATE_LIMIT_WINDOW_MS,
          );
          return null;
        }

        await db
          .update(users)
          .set({ emailVerified: new Date() })
          .where(eq(users.id, user.id));

        await markEmailVerified(user.id);

        await Promise.all([
          clearIdentifier(verificationIdentifier),
          clearIdentifier(verificationFlowIdentifier),
          clearIdentifier(verifyRateIdentifier),
          clearIdentifier(verifyRateByIpIdentifier),
        ]);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image:
            getDirectusAssetUrl(user.avatarFileId) ?? user.image ?? undefined,
        };
      }

      if (mode !== "login") {
        return null;
      }

      const rawEmail = credentials?.email?.toString();
      const password = credentials?.password?.toString();

      if (!rawEmail || !password) {
        throw new AuthFlowError("missing_credentials");
      }

      const email = normalizeEmail(rawEmail);
      const loginRateIdentifier = createRateLimitIdentifier("login", email);
      const loginRateByIpIdentifier = createRateLimitIdentifier(
        "login-ip",
        clientIp,
      );

      if (
        await isRateLimited(loginRateIdentifier, LOGIN_RATE_LIMIT_MAX_ATTEMPTS)
      ) {
        throw new AuthFlowError("rate_limited");
      }
      if (
        await isRateLimited(
          loginRateByIpIdentifier,
          LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
        )
      ) {
        throw new AuthFlowError("rate_limited");
      }

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          password: users.password,
          emailVerified: users.emailVerified,
          deactivatedAt: users.deactivatedAt,
          name: users.name,
          avatarFileId: users.avatarFileId,
          image: users.image,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        // Hash a dummy password to prevent timing-based user enumeration
        await bcrypt.hash(password, 12);
        await recordAttempt(loginRateIdentifier, LOGIN_RATE_LIMIT_WINDOW_MS);
        await recordAttempt(
          loginRateByIpIdentifier,
          LOGIN_RATE_LIMIT_WINDOW_MS,
        );
        throw new AuthFlowError("user_not_found");
      }

      if (!user.password) {
        await bcrypt.hash(password, 12);
        await recordAttempt(loginRateIdentifier, LOGIN_RATE_LIMIT_WINDOW_MS);
        await recordAttempt(
          loginRateByIpIdentifier,
          LOGIN_RATE_LIMIT_WINDOW_MS,
        );
        throw new AuthFlowError("password_sign_in_unavailable");
      }

      if (!user.emailVerified) {
        await bcrypt.hash(password, 12);
        await recordAttempt(loginRateIdentifier, LOGIN_RATE_LIMIT_WINDOW_MS);
        await recordAttempt(
          loginRateByIpIdentifier,
          LOGIN_RATE_LIMIT_WINDOW_MS,
        );
        throw new AuthFlowError("email_not_verified");
      }

      // Removed from their company by the master account: the row survives, the access does not.
      if (user.deactivatedAt) {
        await bcrypt.hash(password, 12);
        await recordAttempt(loginRateIdentifier, LOGIN_RATE_LIMIT_WINDOW_MS);
        await recordAttempt(
          loginRateByIpIdentifier,
          LOGIN_RATE_LIMIT_WINDOW_MS,
        );
        throw new AuthFlowError("account_deactivated");
      }

      const isArgon2 = user.password.startsWith("$argon2");
      const isValid = isArgon2
        ? await argon2.verify(user.password, password)
        : await bcrypt.compare(password, user.password);
      if (!isValid) {
        await recordAttempt(loginRateIdentifier, LOGIN_RATE_LIMIT_WINDOW_MS);
        await recordAttempt(
          loginRateByIpIdentifier,
          LOGIN_RATE_LIMIT_WINDOW_MS,
        );
        throw new AuthFlowError("password_incorrect");
      }

      await Promise.all([
        clearIdentifier(loginRateIdentifier),
        clearIdentifier(loginRateByIpIdentifier),
      ]);

      await markEmailVerified(user.id);

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        image:
          getDirectusAssetUrl(user.avatarFileId) ?? user.image ?? undefined,
      };
    },
  }),
];

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  secret: env.AUTH_SECRET,
  trustHost: true,
  useSecureCookies: env.AUTH_URL?.startsWith("https://") ?? false,
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    signIn: async ({ account, user, profile }) => {
      if (account?.provider !== "google") {
        return true;
      }

      const googleProfile = profile as
        | { email_verified?: boolean; email?: string | null }
        | undefined;

      if (!user.id || !user.email || googleProfile?.email_verified === false) {
        return false;
      }

      if (await isAccountDeactivated(user.id)) {
        return false;
      }

      await markEmailVerified(user.id);
      return true;
    },
    jwt: async ({ token, user }) => {
      if (user?.id) {
        (token as { id?: string }).id = user.id;
        (token as { needsCompany?: boolean }).needsCompany =
          !(await getUserCompanyId(user.id));
        return token;
      }

      // On token refresh, check if the account was deactivated or the password changed
      // after the token was issued.
      const tokenId = (token as { id?: string }).id;
      if (tokenId && typeof token.iat === "number") {
        const [dbUser] = await db
          .select({
            passwordChangedAt: users.passwordChangedAt,
            deactivatedAt: users.deactivatedAt,
            companyId: users.companyId,
          })
          .from(users)
          .where(eq(users.id, tokenId))
          .limit(1);

        if (dbUser?.deactivatedAt) {
          return { ...token, id: undefined };
        }

        (token as { needsCompany?: boolean }).needsCompany = !dbUser?.companyId;

        if (dbUser?.passwordChangedAt) {
          const changedAtSec = Math.floor(
            dbUser.passwordChangedAt.getTime() / 1000,
          );
          if (changedAtSec > token.iat) {
            // Password changed after token issued — invalidate session
            return { ...token, id: undefined };
          }
        }
      }

      return token;
    },
    session: ({ session, token }) => {
      const tokenId =
        typeof (token as { id?: unknown }).id === "string"
          ? (token as { id: string }).id
          : undefined;

      if (!session.user || !tokenId) {
        // Token is invalid — clear the session user so the client
        // treats this as unauthenticated
        return { ...session, user: undefined } as unknown as typeof session;
      }

      return {
        ...session,
        user: {
          ...session.user,
          id: tokenId,
        },
      };
    },
  },
} satisfies NextAuthConfig;
