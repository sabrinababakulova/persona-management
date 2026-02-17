import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import type { NextAuthConfig } from "next-auth";
import { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { env } from "~/env";
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
import { db } from "~/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";
import { sendRegistrationCode } from "~/server/mail/send-registration-code";

class RegisterFlowError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

const VERIFICATION_REQUIRED_CODE_PREFIX = "verification_required:";

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
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
            throw new RegisterFlowError("invalid_data");
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
            throw new RegisterFlowError("rate_limited");
          }

          const [existingUser] = await db
            .select({ id: users.id, emailVerified: users.emailVerified })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (existingUser?.emailVerified) {
            throw new RegisterFlowError("registration_failed");
          }

          const hashedPassword = await bcrypt.hash(password, 12);
          const verificationCode = generateEmailVerificationCode();

          let createdUserId: string | null = null;
          let verificationIdentifier: string | null = null;
          let verificationFlowIdentifier: string | null = null;

          try {
            const verificationUserId =
              existingUser?.id ??
              (
                await db
                  .insert(users)
                  .values({
                    email,
                    name: `${firstName} ${lastName}`.trim(),
                    password: hashedPassword,
                    hasSeenWelcomeModal: false,
                  })
                  .returning({ id: users.id })
              )[0]?.id;

            if (!verificationUserId) {
              throw new RegisterFlowError("registration_failed");
            }

            if (!existingUser?.id) {
              createdUserId = verificationUserId;
            } else {
              await db
                .update(users)
                .set({
                  name: `${firstName} ${lastName}`.trim(),
                  password: hashedPassword,
                  hasSeenWelcomeModal: false,
                })
                .where(eq(users.id, verificationUserId));
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

            throw new RegisterFlowError(
              `${VERIFICATION_REQUIRED_CODE_PREFIX}${flowId}`,
            );
          } catch (error) {
            if (
              error instanceof RegisterFlowError &&
              error.code.startsWith(VERIFICATION_REQUIRED_CODE_PREFIX)
            ) {
              throw error;
            }

            if (createdUserId) {
              const verificationIdentifier =
                createEmailVerificationIdentifier(createdUserId);
              await db
                .delete(verificationTokens)
                .where(
                  eq(verificationTokens.identifier, verificationIdentifier),
                )
                .catch(() => undefined);
              await db
                .delete(users)
                .where(eq(users.id, createdUserId))
                .catch(() => undefined);
            }

            if (verificationIdentifier) {
              await db
                .delete(verificationTokens)
                .where(
                  eq(verificationTokens.identifier, verificationIdentifier),
                )
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

            if (error instanceof RegisterFlowError) {
              throw error;
            }

            throw new RegisterFlowError("registration_failed");
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
            throw new RegisterFlowError("rate_limited");
          }

          if (
            await isRateLimited(
              verifyRateByIpIdentifier,
              VERIFY_RATE_LIMIT_MAX_ATTEMPTS,
            )
          ) {
            throw new RegisterFlowError("rate_limited");
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
            image: user.image ?? undefined,
          };
        }

        if (mode !== "login") {
          return null;
        }

        const rawEmail = credentials?.email?.toString();
        const password = credentials?.password?.toString();

        if (!rawEmail || !password) {
          return null;
        }

        const email = normalizeEmail(rawEmail);
        const loginRateIdentifier = createRateLimitIdentifier("login", email);
        const loginRateByIpIdentifier = createRateLimitIdentifier(
          "login-ip",
          clientIp,
        );

        if (
          await isRateLimited(
            loginRateIdentifier,
            LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
          )
        ) {
          throw new RegisterFlowError("rate_limited");
        }
        if (
          await isRateLimited(
            loginRateByIpIdentifier,
            LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
          )
        ) {
          throw new RegisterFlowError("rate_limited");
        }

        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            password: users.password,
            emailVerified: users.emailVerified,
            name: users.name,
            image: users.image,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.password || !user.emailVerified) {
          await recordAttempt(loginRateIdentifier, LOGIN_RATE_LIMIT_WINDOW_MS);
          await recordAttempt(
            loginRateByIpIdentifier,
            LOGIN_RATE_LIMIT_WINDOW_MS,
          );
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          await recordAttempt(loginRateIdentifier, LOGIN_RATE_LIMIT_WINDOW_MS);
          await recordAttempt(
            loginRateByIpIdentifier,
            LOGIN_RATE_LIMIT_WINDOW_MS,
          );
          return null;
        }

        await Promise.all([
          clearIdentifier(loginRateIdentifier),
          clearIdentifier(loginRateByIpIdentifier),
        ]);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  secret: env.AUTH_SECRET,
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        (token as { id?: string }).id = user.id;
      }
      return token;
    },
    session: ({ session, token }) => {
      const tokenId =
        typeof (token as { id?: unknown }).id === "string"
          ? (token as { id: string }).id
          : undefined;

      if (!session.user || !tokenId) {
        return session;
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
