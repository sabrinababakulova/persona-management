import { relations } from "drizzle-orm";
import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

export const createTable = pgTableCreator((name) => name);

// Companies table
export const companies = createTable("company", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }).notNull(),
  city: d.varchar({ length: 255 }),
  country: d.varchar({ length: 255 }).default("Узбекистан"),
  description: d.text(),
  website: d.varchar({ length: 500 }),
  phone: d.varchar({ length: 50 }),
  logoUrl: d.varchar({ length: 500 }),
  createdAt: d
    .timestamp({ withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}));

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
  email: d.varchar({ length: 255 }).notNull().unique(),
  password: d.varchar({ length: 255 }),
  passwordChangedAt: d.timestamp({ mode: "date", withTimezone: true }),
  hasSeenWelcomeModal: d.boolean().notNull().default(true),
  emailVerified: d.timestamp({
    mode: "date",
    withTimezone: true,
  }),
  image: d.varchar({ length: 255 }),
  avatarFileId: d.varchar({ length: 255 }),
  companyId: d.varchar({ length: 255 }).references(() => companies.id),
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
    resumeFileId: d.varchar({ length: 255 }),
    resumeFileName: d.varchar({ length: 255 }),
    resumeFileSize: d.varchar({ length: 50 }),
    experience: d.varchar({ length: 255 }),
    matchScore: d.integer(),
    aiAnalysis: d.text(),
    // JSON fields for arrays
    contacts: d.json().$type<{ type: string; value: string }[]>().default([]),
    skills: d.json().$type<string[]>().default([]),
    languages: d.json().$type<{ name: string; level: string }[]>().default([]),
    tags: d.json().$type<string[]>().default([]),
    workExperience: d
      .json()
      .$type<
        {
          company: string;
          position: string;
          period: string;
          isCurrent?: boolean;
          description: string[];
        }[]
      >()
      .default([]),
    education: d
      .json()
      .$type<
        {
          institution: string;
          gpa: string;
          period: string;
          isCurrent?: boolean;
        }[]
      >()
      .default([]),
    notes: d
      .json()
      .$type<
        {
          id: string;
          content: string;
          author: string;
          createdAt: string;
        }[]
      >()
      .default([]),
    activities: d
      .json()
      .$type<
        {
          id: string;
          userName: string;
          userAvatar: string;
          action: string;
          targetName: string;
          targetStatus: string;
          timeAgo: string;
        }[]
      >()
      .default([]),
    companyId: d.varchar({ length: 255 }).references(() => companies.id),
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
    index("candidate_company_id_idx").on(t.companyId),
  ],
);

// Vacancies table
export const vacancies = createTable(
  "vacancy",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: d.varchar({ length: 255 }).notNull(),
    level: d.varchar({ length: 100 }),
    status: d.varchar({ length: 50 }).default("active"),
    city: d.varchar({ length: 255 }),
    responses: d.integer().default(0),
    workType: d.varchar({ length: 100 }),
    salaryExpectation: d.integer(),
    salaryCurrency: d.varchar({ length: 10 }).default("UZS"),
    workScheduleStart: d.varchar({ length: 10 }).default("09:00"),
    workScheduleEnd: d.varchar({ length: 10 }).default("18:00"),
    comments: d.text(),
    tasks: d.text(),
    team: d.text(),
    companyDescription: d.text(),
    companyId: d.varchar({ length: 255 }).references(() => companies.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("vacancy_title_idx").on(t.title),
    index("vacancy_status_idx").on(t.status),
    index("vacancy_company_id_idx").on(t.companyId),
  ],
);

// Activity log table for dashboard "Recent actions" feed
export const recentActivityLogs = createTable(
  "recent_activity_log",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    entityType: d.varchar({ length: 50 }).notNull(), // candidate | vacancy
    entityId: d.varchar({ length: 255 }).notNull(),
    actorUserId: d.varchar({ length: 255 }).references(() => users.id),
    actorName: d.varchar({ length: 255 }).notNull(),
    action: d.varchar({ length: 255 }).notNull(),
    targetName: d.varchar({ length: 255 }).notNull(),
    targetStatus: d.varchar({ length: 255 }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("recent_activity_created_at_idx").on(t.createdAt),
    index("recent_activity_entity_idx").on(t.entityType, t.entityId),
  ],
);

// Lookup tables for candidate create form select options.
// NOTE: These are managed by the backend and populated via `bun run db:seed`.
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

export const vacancyStatusOptions = createTable(
  "vacancy_status_option",
  (d) => ({
    value: d.varchar({ length: 50 }).notNull().primaryKey(),
    label: d.varchar({ length: 255 }).notNull(),
    sortOrder: d.integer().notNull().default(0),
    isActive: d.boolean().notNull().default(true),
  }),
);

export const vacancyLevels = createTable("vacancy_level_option", (d) => ({
  value: d.varchar({ length: 50 }).notNull().primaryKey(),
  label: d.varchar({ length: 255 }).notNull(),
  sortOrder: d.integer().notNull().default(0),
  isActive: d.boolean().notNull().default(true),
}));

export const vacancyWorkTypes = createTable(
  "vacancy_work_type_option",
  (d) => ({
    value: d.varchar({ length: 50 }).notNull().primaryKey(),
    label: d.varchar({ length: 255 }).notNull(),
    sortOrder: d.integer().notNull().default(0),
    isActive: d.boolean().notNull().default(true),
  }),
);

// Company Telegram channels (for vacancy posting)
export const companyTelegramChannels = createTable(
  "company_telegram_channel",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => companies.id),
    channelId: d.varchar({ length: 255 }).notNull(),
    label: d.varchar({ length: 255 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("company_tg_channel_company_id_idx").on(t.companyId)],
);

// Company hh.uz (HeadHunter) accounts
export const companyHhAccounts = createTable("company_hh_account", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: d
    .varchar({ length: 255 })
    .notNull()
    .references(() => companies.id)
    .unique(),
  clientId: d.varchar({ length: 255 }),
  clientSecret: d.varchar({ length: 500 }),
  accessToken: d.text(),
  refreshToken: d.text(),
  employerId: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }),
  createdAt: d
    .timestamp({ withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}));
