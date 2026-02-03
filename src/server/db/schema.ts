import { relations } from "drizzle-orm";
import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator(
  (name) => `persona-management_${name}`,
);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ],
);

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .$defaultFn(() => /* @__PURE__ */ new Date()),
  image: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// Candidates table
export const candidates = createTable(
  "candidate",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    fullName: d.varchar({ length: 255 }).notNull(),
    city: d.varchar({ length: 255 }),
    salaryExpectation: d.integer(),
    salaryCurrency: d.varchar({ length: 10 }).default("UZS"),
    currentPosition: d.varchar({ length: 255 }),
    source: d.varchar({ length: 255 }),
    status: d.varchar({ length: 50 }).default("new"),
    resumeUrl: d.varchar({ length: 500 }),
    resumeFileName: d.varchar({ length: 255 }),
    // JSON fields for arrays
    contacts: d.json().$type<{ type: string; value: string }[]>().default([]),
    skills: d.json().$type<string[]>().default([]),
    languages: d.json().$type<{ name: string; level: string }[]>().default([]),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("candidate_name_idx").on(t.fullName),
    index("candidate_city_idx").on(t.city),
    index("candidate_created_at_idx").on(t.createdAt),
  ],
);

// Lookup tables for candidate create form select options.
// NOTE: These are intended to be managed from the backend (seeded via migrations).
export const candidateContactTypes = createTable(
  "candidate_contact_type",
  (d) => ({
    value: d.varchar({ length: 50 }).notNull().primaryKey(),
    label: d.varchar({ length: 255 }).notNull(),
    sortOrder: d.integer().notNull().default(0),
    isActive: d.boolean().notNull().default(true),
  }),
);

export const candidateSources = createTable("candidate_source", (d) => ({
  value: d.varchar({ length: 100 }).notNull().primaryKey(),
  label: d.varchar({ length: 255 }).notNull(),
  sortOrder: d.integer().notNull().default(0),
  isActive: d.boolean().notNull().default(true),
}));

export const candidatePositions = createTable("candidate_position", (d) => ({
  value: d.varchar({ length: 100 }).notNull().primaryKey(),
  label: d.varchar({ length: 255 }).notNull(),
  sortOrder: d.integer().notNull().default(0),
  isActive: d.boolean().notNull().default(true),
}));

export const candidateSkills = createTable("candidate_skill", (d) => ({
  value: d.varchar({ length: 255 }).notNull().primaryKey(),
  label: d.varchar({ length: 255 }).notNull(),
  sortOrder: d.integer().notNull().default(0),
  isActive: d.boolean().notNull().default(true),
}));

export const candidateLanguages = createTable("candidate_language", (d) => ({
  value: d.varchar({ length: 50 }).notNull().primaryKey(),
  label: d.varchar({ length: 255 }).notNull(),
  sortOrder: d.integer().notNull().default(0),
  isActive: d.boolean().notNull().default(true),
}));

export const candidateLanguageLevels = createTable(
  "candidate_language_level",
  (d) => ({
    value: d.varchar({ length: 10 }).notNull().primaryKey(),
    label: d.varchar({ length: 255 }).notNull(),
    sortOrder: d.integer().notNull().default(0),
    isActive: d.boolean().notNull().default(true),
  }),
);

export const candidateStatusOptions = createTable(
  "candidate_status_option",
  (d) => ({
    value: d.varchar({ length: 50 }).notNull().primaryKey(),
    label: d.varchar({ length: 255 }).notNull(),
    sortOrder: d.integer().notNull().default(0),
    isActive: d.boolean().notNull().default(true),
  }),
);
