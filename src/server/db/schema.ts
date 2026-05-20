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

export const aiUsageLogs = createTable(
  "ai_usage_log",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar("user_id", { length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    companyId: d
      .varchar("company_id", { length: 255 })
      .references(() => companies.id, { onDelete: "set null" }),
    candidateId: d.varchar("candidate_id", { length: 255 }),
    provider: d.varchar({ length: 50 }).notNull().default("google"),
    model: d.varchar({ length: 100 }).notNull(),
    agent: d.varchar({ length: 100 }).notNull(),
    operation: d.varchar({ length: 100 }).notNull(),
    status: d.varchar({ length: 50 }).notNull(),
    inputTokens: d.integer("input_tokens").notNull().default(0),
    outputTokens: d.integer("output_tokens").notNull().default(0),
    totalTokens: d.integer("total_tokens").notNull().default(0),
    reasoningTokens: d.integer("reasoning_tokens").notNull().default(0),
    cachedInputTokens: d.integer("cached_input_tokens").notNull().default(0),
    inputRateUsdPerMillion: d
      .numeric("input_rate_usd_per_million", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    outputRateUsdPerMillion: d
      .numeric("output_rate_usd_per_million", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    inputCostUsd: d
      .numeric("input_cost_usd", { precision: 14, scale: 8 })
      .notNull()
      .default("0"),
    outputCostUsd: d
      .numeric("output_cost_usd", { precision: 14, scale: 8 })
      .notNull()
      .default("0"),
    totalCostUsd: d
      .numeric("total_cost_usd", { precision: 14, scale: 8 })
      .notNull()
      .default("0"),
    errorMessage: d.text("error_message"),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("ai_usage_log_created_at_idx").on(t.createdAt),
    index("ai_usage_log_company_id_idx").on(t.companyId),
    index("ai_usage_log_user_id_idx").on(t.userId),
    index("ai_usage_log_candidate_id_idx").on(t.candidateId),
    index("ai_usage_log_agent_idx").on(t.agent),
  ],
);

// Vacancies table — schema mirrors the hh.uz publish payload so a vacancy can be created
// in the form, persisted here, and published to hh.uz without an extra translation layer.
export const vacancies = createTable(
  "vacancy",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    parentId: d.varchar({ length: 255 }).notNull(),
    title: d.varchar({ length: 255 }).notNull(),
    status: d.varchar({ length: 50 }).default("active"),
    responses: d.integer().default(0),
    areaId: d.varchar("area_id", { length: 20 }),
    employmentId: d.varchar("employment_id", { length: 50 }),
    scheduleId: d.varchar("schedule_id", { length: 50 }),
    experienceId: d.varchar("experience_id", { length: 50 }),
    professionalRoleId: d.varchar("professional_role_id", { length: 50 }),
    vacancyTypeId: d.varchar("vacancy_type_id", { length: 50 }),
    billingTypeId: d.varchar("billing_type_id", { length: 50 }),
    salaryFrom: d.integer("salary_from"),
    salaryTo: d.integer("salary_to"),
    salaryCurrency: d.varchar({ length: 10 }).default("UZS"),
    descriptionHtml: d.text("description_html"),
    contactPhone: d.varchar("contact_phone", { length: 50 }),
    companyId: d.varchar({ length: 255 }).references(() => companies.id),
    hhVacancyId: d.varchar("hh_vacancy_id", { length: 100 }),
    hhDraftId: d.varchar("hh_draft_id", { length: 100 }),
    telegramPostId: d.varchar("telegram_post_id", { length: 255 }),
    /** Directus file id of the Telegram publication image, set via the image uploader. */
    telegramFileId: d.varchar("telegram_file_id", { length: 255 }),
    /**
     * `true` when this row represents a per-channel publication rather than a base vacancy.
     * Replaces the deprecated `vacancy_publication` table.
     */
    isPublication: d.boolean("is_publication").notNull().default(false),
    /** Active flag for publications; ignored when `isPublication` is `false`. */
    isActive: d.boolean("is_active").notNull().default(true),
    /**
     * Target channel for this publication (e.g. `"linkedin"`, `"hh.uz"`, `"telegram"`).
     * Null on base vacancies (`isPublication = false`).
     */
    destination: d.varchar({ length: 50 }),
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
    index("vacancy_parent_id_idx").on(t.parentId),
    index("vacancy_hh_vacancy_id_idx").on(t.hhVacancyId),
  ],
);

export const candidateVacancies = createTable(
  "vacancy_candidate",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    candidateId: d
      .varchar("candidate_id", { length: 255 })
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    vacancyId: d
      .varchar("vacancy_id", { length: 255 })
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
  }),
  (t) => [
    index("vacancy_candidate_candidate_id_idx").on(t.candidateId),
    index("vacancy_candidate_vacancy_id_idx").on(t.vacancyId),
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
    companyId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => companies.id),
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
    index("recent_activity_company_id_idx").on(t.companyId),
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

export const vacancySources = createTable("vacancy_source_option", (d) => ({
  value: d.varchar({ length: 100 }).notNull().primaryKey(),
  label: d.varchar({ length: 255 }).notNull(),
  sortOrder: d.integer().notNull().default(0),
  isActive: d.boolean().notNull().default(true),
}));

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

// User Telegram channels (for vacancy posting)
export const userTelegramChannels = createTable(
  "company_telegram_channel",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    channelId: d.varchar({ length: 255 }).notNull(),
    label: d.varchar({ length: 255 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("user_tg_channel_user_id_idx").on(t.userId)],
);

// Per-channel record of a vacancy publication posted to Telegram
export const vacancyTelegramPosts = createTable(
  "vacancy_telegram_post",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    publicationId: d
      .varchar("publication_id", { length: 255 })
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
    /**
     * Channel the message was posted to. Set to `null` when the channel is later
     * removed by the user — the post record is kept so the message stays
     * tracked, and the publication can no longer be deactivated/deleted.
     */
    channelId: d
      .varchar("channel_id", { length: 255 })
      .references(() => userTelegramChannels.id, { onDelete: "set null" }),
    /** Public t.me URL of the posted message; self-sufficient for deletion. */
    messageUrl: d.varchar("message_url", { length: 500 }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("vacancy_tg_post_publication_id_idx").on(t.publicationId)],
);

// User hh.uz (HeadHunter) accounts
export const userHhAccounts = createTable("company_hh_account", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: d
    .varchar({ length: 255 })
    .notNull()
    .references(() => users.id)
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
