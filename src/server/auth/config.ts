import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { env } from "~/env";
import { db } from "~/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

class EmailAlreadyExistsError extends CredentialsSignin {
  code = "email_exists";
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
      },
      async authorize(credentials) {
        const mode = credentials?.mode?.toString().trim().toLowerCase();
        const firstName = credentials?.firstName?.toString().trim();
        const lastName = credentials?.lastName?.toString().trim();
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString();

        if (mode === "register") {
          if (
            !email ||
            !password ||
            !firstName ||
            !lastName ||
            password.length < 8
          ) {
            return null;
          }

          const [existingUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (existingUser) {
            throw new EmailAlreadyExistsError();
          }

          const hashedPassword = await bcrypt.hash(password, 10);

          try {
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                name: `${firstName} ${lastName}`.trim(),
                password: hashedPassword,
                hasSeenWelcomeModal: false,
              })
              .returning({
                id: users.id,
                email: users.email,
                name: users.name,
                image: users.image,
              });

            if (!newUser) {
              return null;
            }

            return {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name ?? undefined,
              image: newUser.image ?? undefined,
            };
          } catch (error: unknown) {
            const pgCode =
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              typeof (error as { code?: unknown }).code === "string"
                ? (error as { code: string }).code
                : undefined;

            if (pgCode === "23505") {
              throw new EmailAlreadyExistsError();
            }
            throw error;
          }
        }

        if (!email || !password) {
          return null;
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.password) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

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
