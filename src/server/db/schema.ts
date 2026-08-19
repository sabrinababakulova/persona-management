import { relations, sql } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

import type { CandidateResumePrefillData } from "~/schemas/resume-analysis";
import type {
  OlxPublicationMeta,
  PersonHunterPublicationMeta,
} from "~/server/api/routers/vacancies/schemas";
import { COMPANY_ROLE_MEMBER } from "~/shared/company-roles";
import type { LocalizedStringList, LocalizedText } from "~/shared/localized-ai";

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
  /** Directus file id of an uploaded logo; `logoUrl` mirrors it for direct rendering. */
  logoFileId: d.varchar({ length: 255 }),
  createdAt: d
    .timestamp({ withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}));

/**
 * Shareable "join our company" links.
 *
 * The token is a random 256-bit value stored as-is so the link stays copyable after it was
 * generated. It only grants membership in `companyId`, expires, and can be revoked at any time.
 */
export const companyInvitations = createTable(
  "company_invitation",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    token: d.varchar({ length: 64 }).notNull(),
    createdById: d
      .varchar({ length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    expiresAt: d.timestamp({ withTimezone: true }).notNull(),
    revokedAt: d.timestamp({ withTimezone: true }),
    /** How many accounts joined through this link — informational only, the link is multi-use. */
    usesCount: d.integer().notNull().default(0),
    lastUsedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    uniqueIndex("company_invitation_token_idx").on(t.token),
    index("company_invitation_company_id_idx").on(t.companyId),
  ],
);

/**
 * Per-company feature toggles, edited in Directus.
 *
 * `feature` is either a boolean capability key ("telegram_resume_warehouse",
 * "person_hunter_publications") or a namespaced resume design grant
 * ("resume_design.person-hunters"). A feature is ON when a row exists with
 * isEnabled = true; absence of a row means OFF. Keys live in
 * `~/shared/feature-flags`.
 */
export const companyFeatureFlags = createTable(
  "company_feature_flag",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: d
      .varchar("company_id", { length: 255 })
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    feature: d.varchar({ length: 100 }).notNull(),
    /** Kept as a column (vs deleting the row) so Directus admins toggle a checkbox. */
    isEnabled: d.boolean("is_enabled").notNull().default(true),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    // Doubles as the company_id lookup index (leftmost column).
    uniqueIndex("company_feature_flag_company_feature_idx").on(
      t.companyId,
      t.feature,
    ),
  ],
);

export const users = createTable(
  "user",
  (d) => ({
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
    /**
     * Role inside `companyId` — `admin` may edit the company and invite people, `member` can
     * only look. Assigned by the master account (and editable in Directus); a company can have
     * any number of admins. See `~/shared/company-roles`.
     */
    role: d.varchar({ length: 20 }).notNull().default(COMPANY_ROLE_MEMBER),
    /**
     * Set when the master account removes this person from the company.
     *
     * The row is kept — deactivation is not deletion — but the account can no longer sign in
     * anywhere in the app, so it cannot join another company either.
     */
    deactivatedAt: d.timestamp({ withTimezone: true }),
    /**
     * True only for the account that created `companyId` during registration.
     *
     * A permanent record of who the company belongs to: `role` can be handed over, this cannot.
     * Written once by the registration flow and never by the app afterwards; Directus shows it
     * read-only.
     */
    isMasterAccount: d.boolean().notNull().default(false),
    /** Last time the user opened the Candidates page — drives the sidebar badge. */
    candidatesSeenAt: d
      .timestamp("candidates_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Last time the user opened the Vacancies page — drives the sidebar badge. */
    vacanciesSeenAt: d
      .timestamp("vacancies_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (t) => [
    // A company has exactly one creator, and only registration ever sets the flag.
    // (Admins are not unique — the master account may promote as many as it likes.)
    uniqueIndex("user_company_master_idx")
      .on(t.companyId)
      .where(sql`${t.isMasterAccount}`),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
      .references(() => users.id, { onDelete: "cascade" }),
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
    /** Total work experience in months; formatted for display by `formatExperienceMonths`. */
    experience: d.integer(),
    matchScore: d.integer(),
    /** Legacy Russian summary retained for backwards compatibility. */
    aiAnalysis: d.text(),
    /** Equivalent recruiter resume briefs in Russian, English, and Uzbek. */
    aiAnalysisTranslations: d
      .json("ai_analysis_translations")
      .$type<LocalizedText>(),
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
    /**
     * hh.uz resume id — the stable per-resume external key. Set on candidates
     * sourced from hh.uz; null for manually created candidates. Uniqueness is
     * enforced per company by `candidate_hh_resume_id_idx`.
     */
    hhResumeId: d.varchar("hh_resume_id", { length: 100 }),
    /** Link to the candidate's resume on hh.uz (the hh.uz `alternate_url`). */
    hhResumeUrl: d.varchar("hh_resume_url", { length: 500 }),
    /** When the full hh.uz resume was last fetched; null means the row is a stub. */
    hhResumeFetchedAt: d.timestamp("hh_resume_fetched_at", {
      withTimezone: true,
    }),
    /** Last time a sync run touched this row. */
    hhSyncedAt: d.timestamp("hh_synced_at", { withTimezone: true }),
    /**
     * Set once a recruiter edits the profile of an hh.uz candidate. While true,
     * sync stops overwriting raw profile fields for this candidate.
     */
    profileLocked: d.boolean("profile_locked").notNull().default(false),
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
    // One candidate row per (company, hh.uz resume): the upsert conflict target
    // for sync and the per-company dedup guarantee.
    uniqueIndex("candidate_hh_resume_id_idx")
      .on(t.companyId, t.hhResumeId)
      .where(sql`${t.hhResumeId} is not null`),
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

/**
 * Recruiter-scheduled meetings with candidates.
 *
 * `invitationStatus` describes SMTP delivery of the iCalendar request, not the
 * candidate's RSVP. Replies go to the organizer mailbox from the invitation.
 */
export const candidateMeetings = createTable(
  "candidate_meeting",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    candidateId: d
      .varchar("candidate_id", { length: 255 })
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    companyId: d
      .varchar("company_id", { length: 255 })
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    organizerUserId: d
      .varchar("organizer_user_id", { length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    organizerName: d.varchar("organizer_name", { length: 255 }).notNull(),
    organizerEmail: d.varchar("organizer_email", { length: 255 }).notNull(),
    candidateEmail: d.varchar("candidate_email", { length: 255 }).notNull(),
    title: d.varchar({ length: 255 }).notNull(),
    description: d.text(),
    location: d.varchar({ length: 500 }),
    startAt: d.timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: d.timestamp("end_at", { withTimezone: true }).notNull(),
    timeZone: d
      .varchar("time_zone", { length: 100 })
      .notNull()
      .default("Asia/Tashkent"),
    /** Stable iCalendar UID used by mail clients to identify this event. */
    invitationUid: d.varchar("invitation_uid", { length: 255 }).notNull(),
    /** `pending` | `sent` | `failed`; this is delivery state, not RSVP state. */
    invitationStatus: d
      .varchar("invitation_status", { length: 20 })
      .notNull()
      .default("pending"),
    invitationSentAt: d.timestamp("invitation_sent_at", {
      withTimezone: true,
    }),
    invitationError: d.text("invitation_error"),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("candidate_meeting_invitation_uid_idx").on(t.invitationUid),
    index("candidate_meeting_candidate_start_idx").on(t.candidateId, t.startAt),
    index("candidate_meeting_company_start_idx").on(t.companyId, t.startAt),
    index("candidate_meeting_organizer_start_idx").on(
      t.organizerUserId,
      t.startAt,
    ),
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
    /** Numeric id of this publication's vacancy on PersonHunters, set once published there. */
    personHunterVacancyId: d.varchar("person_hunter_vacancy_id", {
      length: 100,
    }),
    /**
     * PersonHunters `unique_code` returned on publish — the slug used in the public vacancy URL
     * (`personhunters.com/ru/vacancy/<unique_code>`), which is keyed on the code, not the id.
     */
    personHunterUniqueCode: d.varchar("person_hunter_unique_code", {
      length: 100,
    }),
    /**
     * PersonHunters-specific publication fields (duties, requirements, conditions, the selected
     * reference ids, employment/schedule, experience range, …) that have no dedicated vacancy
     * column. Stored so the PersonHunters publish form can be re-populated when editing.
     */
    personHunterMeta: d
      .json("person_hunter_meta")
      .$type<PersonHunterPublicationMeta>(),
    /** Public advert URL returned after the OLX server publication request. */
    olxAdvertUrl: d.varchar("olx_advert_url", { length: 1000 }),
    /** Stable advert id returned by OLX after publication. */
    olxAdvertId: d.varchar("olx_advert_id", { length: 100 }),
    /** Stable idempotency key persisted before the first OLX create request. */
    olxPostingId: d.varchar("olx_posting_id", { length: 100 }),
    /** Durable publication operation state used to serialize create requests. */
    olxPublicationState: d.varchar("olx_publication_state", { length: 30 }),
    /** Time at which the current publisher claimed this row. */
    olxPublishClaimedAt: d.timestamp("olx_publish_claimed_at", {
      withTimezone: true,
    }),
    /** User whose connected OLX account created the advert. */
    olxPublisherUserId: d
      .varchar("olx_publisher_user_id", { length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    /** OLX web-form labels entered by the recruiter. */
    olxBrowserMeta: d.json("olx_browser_meta").$type<OlxPublicationMeta>(),
    olxLastPublishedAt: d.timestamp("olx_last_published_at", {
      withTimezone: true,
    }),
    olxLastError: d.text("olx_last_error"),
    telegramPostId: d.varchar("telegram_post_id", { length: 255 }),
    /** Directus file id of the Telegram publication image, set via the image uploader. */
    telegramFileId: d.varchar("telegram_file_id", { length: 255 }),
    /**
     * `true` when this row represents a per-channel publication rather than a base vacancy.
     * Replaces the deprecated `vacancy_publication` table.
     */
    isPublication: d.boolean("is_publication").notNull().default(false),
    /**
     * System-owned vacancies remain queryable in Directus but are excluded from
     * every recruiter-facing application query.
     */
    isInternal: d.boolean("is_internal").notNull().default(false),
    /**
     * Stable purpose of a system-owned vacancy. A nullable key lets every
     * company own exactly one vacancy for a given internal workflow without
     * relying on a translated title for identity.
     */
    systemKey: d.varchar("system_key", { length: 100 }),
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
    index("vacancy_olx_advert_id_idx").on(t.olxAdvertId),
    uniqueIndex("vacancy_olx_posting_id_idx").on(t.olxPostingId),
    index("vacancy_olx_publisher_user_id_idx").on(t.olxPublisherUserId),
    uniqueIndex("vacancy_company_system_key_idx")
      .on(t.companyId, t.systemKey)
      .where(sql`${t.systemKey} is not null`),
  ],
);

/**
 * A candidate's application to a vacancy. Carries the per-vacancy pipeline
 * state — status in recruiting is per application, not per person.
 */
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
    /** hh.uz negotiation id — one per (vacancy, candidate). Null for manual links. */
    hhNegotiationId: d.varchar("hh_negotiation_id", { length: 100 }),
    /** Recruiter-owned funnel stage. Never written by sync. */
    stage: d.varchar({ length: 50 }).notNull().default("new"),
    /** hh.uz employer_state / funnel_stage. Reference-only, refreshed by sync. */
    hhStage: d.varchar("hh_stage", { length: 50 }),
    /** `active` | `withdrawn` | `archived`. Sync-owned. */
    applicationState: d
      .varchar("application_state", { length: 20 })
      .notNull()
      .default("active"),
    /**
     * 0–100 fit score from the candidate-vacancy match agent. Per-application,
     * not per-candidate: the same candidate can be a strong fit for one role
     * and weak for another. Refreshed by enrichment, null until first run.
     */
    matchScore: d.integer("match_score"),
    /** Legacy Russian match narrative retained for backwards compatibility. */
    matchAnalysis: d.text("match_analysis"),
    /** Equivalent vacancy-specific analyses in Russian, English, and Uzbek. */
    matchAnalysisTranslations: d
      .json("match_analysis_translations")
      .$type<LocalizedText>(),
    /**
     * Requirements of THIS vacancy the candidate's resume covers — the green
     * badges on funnel cards. Per-application, like `matchScore`.
     */
    matchedSkills: d.json("matched_skills").$type<string[]>().default([]),
    matchedSkillsTranslations: d
      .json("matched_skills_translations")
      .$type<LocalizedStringList>(),
    /**
     * Requirements of THIS vacancy the candidate's resume does not cover —
     * the red badges on funnel cards. Per-application, like `matchScore`.
     */
    missingSkills: d.json("missing_skills").$type<string[]>().default([]),
    missingSkillsTranslations: d
      .json("missing_skills_translations")
      .$type<LocalizedStringList>(),
    appliedAt: d.timestamp("applied_at", { withTimezone: true }),
    // DB-level default so `db:push` can add this NOT NULL column to the
    // already-populated vacancy_candidate table without a manual backfill.
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("vacancy_candidate_candidate_id_idx").on(t.candidateId),
    index("vacancy_candidate_vacancy_id_idx").on(t.vacancyId),
    // One application row per (vacancy, hh.uz negotiation): the upsert conflict
    // target for sync.
    uniqueIndex("vacancy_candidate_hh_negotiation_idx")
      .on(t.vacancyId, t.hhNegotiationId)
      .where(sql`${t.hhNegotiationId} is not null`),
  ],
);

/**
 * Per-vacancy discovery watermark. One row per hh.uz-linked vacancy; lets the
 * sync poll only negotiations newer than the last run instead of the full list.
 */
export const hhVacancySyncState = createTable("hh_vacancy_sync_state", (d) => ({
  vacancyId: d
    .varchar("vacancy_id", { length: 255 })
    .notNull()
    .primaryKey()
    .references(() => vacancies.id, { onDelete: "cascade" }),
  /** `created_at` of the newest negotiation processed by discovery (the cursor). */
  lastNegotiationAt: d.timestamp("last_negotiation_at", { withTimezone: true }),
  /** `updated_at` of the newest negotiation processed by status sync (its cursor). */
  lastStatusNegotiationAt: d.timestamp("last_status_negotiation_at", {
    withTimezone: true,
  }),
  lastSyncStartedAt: d.timestamp("last_sync_started_at", {
    withTimezone: true,
  }),
  lastSyncFinishedAt: d.timestamp("last_sync_finished_at", {
    withTimezone: true,
  }),
  lastSyncError: d.text("last_sync_error"),
}));

/**
 * Enrichment queue: one job per newly discovered hh.uz candidate. Drained by a
 * worker with `FOR UPDATE SKIP LOCKED` — no external queue infrastructure.
 */
export const hhEnrichmentJobs = createTable(
  "hh_enrichment_job",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    candidateId: d
      .varchar("candidate_id", { length: 255 })
      .notNull()
      .unique()
      .references(() => candidates.id, { onDelete: "cascade" }),
    /** `pending` | `processing` | `done` | `failed`. */
    status: d.varchar({ length: 20 }).notNull().default("pending"),
    attempts: d.integer().notNull().default(0),
    /** Earliest time the job may be claimed; also the retry-backoff timestamp. */
    runAfter: d
      .timestamp("run_after", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    lockedAt: d.timestamp("locked_at", { withTimezone: true }),
    lastError: d.text("last_error"),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("hh_enrichment_job_claim_idx").on(t.status, t.runAfter)],
);

/**
 * Durable inbox for resume documents received from the configured Telegram
 * group (or from a one-time Telegram Desktop history export).
 *
 * The webhook only inserts rows. A separate worker claims them with
 * `FOR UPDATE SKIP LOCKED`, downloads/stores the PDF, runs the Mastra agents,
 * and creates the company-scoped candidate. The two unique indexes make
 * Telegram's at-least-once webhook delivery and repeated file forwards safe.
 */
export const telegramResumeImports = createTable(
  "telegram_resume_import",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: d
      .varchar("company_id", { length: 255 })
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    vacancyId: d
      .varchar("vacancy_id", { length: 255 })
      .notNull()
      .references(() => vacancies.id),
    chatId: d.varchar("chat_id", { length: 64 }).notNull(),
    messageId: d.integer("message_id").notNull(),
    updateId: d.varchar("update_id", { length: 64 }),
    /** `bot` for Bot API updates; `desktop_export` for historical backfills. */
    source: d.varchar({ length: 30 }).notNull().default("bot"),
    /** Bot-scoped id used to download a live Telegram document. */
    fileId: d.varchar("file_id", { length: 255 }),
    /** Stable Telegram id, or a SHA-256 identity for Desktop exports. */
    fileUniqueId: d.varchar("file_unique_id", { length: 255 }).notNull(),
    fileName: d.varchar("file_name", { length: 255 }).notNull(),
    mimeType: d.varchar("mime_type", { length: 255 }),
    fileSize: d.integer("file_size"),
    messageDate: d.timestamp("message_date", { withTimezone: true }),
    /**
     * Preallocated before a Candidate exists. This deliberately has no FK:
     * the same id is also used as the Directus storage key while processing.
     */
    candidateId: d.varchar("candidate_id", { length: 255 }).notNull(),
    /** Directus id once the original resume has been stored durably. */
    resumeFileId: d.varchar("resume_file_id", { length: 255 }),
    /** Cached successful AI outputs prevent paying for them again after retries. */
    prefillData: d.json("prefill_data").$type<CandidateResumePrefillData>(),
    aiAnalysis: d.text("ai_analysis"),
    aiAnalysisTranslations: d
      .json("ai_analysis_translations")
      .$type<LocalizedText>(),
    /** Cached classifier output prevents repeating the AI call after retries. */
    isResume: d.boolean("is_resume"),
    resumeClassificationReason: d.text("resume_classification_reason"),
    /** `pending` | `processing` | `done` | `failed` | `ignored`. */
    status: d.varchar({ length: 20 }).notNull().default("pending"),
    attempts: d.integer().notNull().default(0),
    runAfter: d
      .timestamp("run_after", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedAt: d.timestamp("locked_at", { withTimezone: true }),
    lastError: d.text("last_error"),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("telegram_resume_import_message_idx").on(t.chatId, t.messageId),
    uniqueIndex("telegram_resume_import_file_idx").on(
      t.companyId,
      t.fileUniqueId,
    ),
    index("telegram_resume_import_claim_idx").on(t.status, t.runAfter),
    index("telegram_resume_import_company_idx").on(t.companyId),
  ],
);

/**
 * Per-company Telegram resume ingestion wiring, edited in Directus.
 *
 * Each row maps one Telegram group (`chatId`) to one company and its internal
 * warehouse vacancy — the shared bot webhook routes incoming documents by chat
 * id. One config per company, one company per chat. Whether ingestion is
 * actually active is governed separately by the `telegram_resume_warehouse`
 * feature flag. The TELEGRAM_RESUME_* env vars remain only as a legacy
 * single-company fallback.
 */
export const companyTelegramResumeConfigs = createTable(
  "company_telegram_resume_config",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: d
      .varchar("company_id", { length: 255 })
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** Telegram group id the resumes are posted to (e.g. "-4910953100"). */
    chatId: d.varchar("chat_id", { length: 64 }).notNull(),
    /** Internal warehouse vacancy the ingested candidates are attached to. */
    warehouseVacancyId: d
      .varchar("warehouse_vacancy_id", { length: 255 })
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("company_tg_resume_config_company_idx").on(t.companyId),
    uniqueIndex("company_tg_resume_config_chat_idx").on(t.chatId),
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
    /** Null once the actor's account is deleted — `actorName` keeps the log readable. */
    actorUserId: d
      .varchar({ length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
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

/**
 * How a vacancy reaches a channel.
 *
 * `direct` posts as the bot and needs `can_post_messages` in the channel.
 * `admins` sends the ready-made post to the channel's admins in DM; they
 * publish it themselves and confirm with the "Запощено" button.
 */
export const telegramDeliveryModes = ["direct", "admins"] as const;
export type TelegramDeliveryMode = (typeof telegramDeliveryModes)[number];

// Company Telegram channels (for vacancy posting)
export const userTelegramChannels = createTable(
  "company_telegram_channel",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /**
     * Owning company. Channels are shared across the company like vacancies and
     * candidates, so a colleague can publish to a channel someone else added.
     */
    companyId: d
      .varchar("company_id", { length: 255 })
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** Kept for attribution only; deleting the user must not drop the channel. */
    createdByUserId: d
      .varchar("created_by_user_id", { length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    channelId: d.varchar({ length: 255 }).notNull(),
    label: d.varchar({ length: 255 }),
    /** Channel title resolved from `getChat` at save time, for display. */
    title: d.varchar({ length: 255 }),
    deliveryMode: d
      .varchar("delivery_mode", { length: 32 })
      .notNull()
      .default("direct")
      .$type<TelegramDeliveryMode>(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("company_tg_channel_company_id_idx").on(t.companyId)],
);

/**
 * A person who publishes on behalf of a channel.
 *
 * A bot cannot open a conversation with a user, so an admin is only reachable
 * after they press Start. The recruiter records the admin's `@username`, and
 * the `/start` handler matches on it to fill in `telegramUserId` — the numeric
 * id is what messages are actually sent to, since usernames can be changed at
 * any time. Until that happens, publishing through this admin fails with a
 * clear error saying they have not activated the bot.
 */
export const telegramChannelAdmins = createTable(
  "telegram_channel_admin",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    channelId: d
      .varchar("channel_id", { length: 255 })
      .notNull()
      .references(() => userTelegramChannels.id, { onDelete: "cascade" }),
    /** Stored lowercase without the leading `@`, so lookups on /start are exact. */
    telegramUsername: d.varchar("telegram_username", { length: 255 }).notNull(),
    /** Optional display name, so the list is readable before activation. */
    name: d.varchar({ length: 255 }),
    /** Numeric Telegram id, resolved when the admin presses Start. */
    telegramUserId: d.varchar("telegram_user_id", { length: 64 }),
    activatedAt: d.timestamp("activated_at", { withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("tg_channel_admin_channel_id_idx").on(t.channelId),
    index("tg_channel_admin_username_idx").on(t.telegramUsername),
    // One record per person per channel; re-adding the same @username should
    // update the existing row rather than create a duplicate recipient.
    uniqueIndex("tg_channel_admin_channel_username_key").on(
      t.channelId,
      t.telegramUsername,
    ),
  ],
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

/**
 * One "please publish this" message sent to a channel admin's DM.
 *
 * Separate from {@link vacancyTelegramPosts} because the two describe different
 * things: a post is a message the bot itself put in the channel and can still
 * delete, whereas a dispatch is a request handed to a human. We never learn the
 * resulting message's URL — the admin publishes it under their own account —
 * so the only signal we get is them pressing the "Запощено" button, which is
 * what flips `confirmedAt`.
 */
export const vacancyTelegramDispatches = createTable(
  "vacancy_telegram_dispatch",
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
    channelId: d
      .varchar("channel_id", { length: 255 })
      .references(() => userTelegramChannels.id, { onDelete: "set null" }),
    adminId: d
      .varchar("admin_id", { length: 255 })
      .references(() => telegramChannelAdmins.id, { onDelete: "set null" }),
    /** DM chat the request went to; equals the admin's numeric Telegram id. */
    adminChatId: d.varchar("admin_chat_id", { length: 64 }).notNull(),
    /** Message in the admin's DM, so its button can be edited away once used. */
    botMessageId: d.integer("bot_message_id").notNull(),
    /** Set when the admin presses "Запощено"; null means still awaiting them. */
    confirmedAt: d.timestamp("confirmed_at", { withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("vacancy_tg_dispatch_publication_id_idx").on(t.publicationId),
    index("vacancy_tg_dispatch_admin_id_idx").on(t.adminId),
  ],
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
    .references(() => users.id, { onDelete: "cascade" })
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

/**
 * Per-user olx.uz connection. The legacy column name is retained for migration
 * compatibility, but it now stores an encrypted API token set captured only
 * after the user signs in on olx.uz. Passwords and challenge responses are
 * never sent to Persona.
 */
export const userOlxSessions = createTable("user_olx_session", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: d
    .varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  /** AES-GCM encrypted OLX access/refresh credentials (legacy DB name). */
  encryptedStorageState: d.text("encrypted_storage_state").notNull(),
  /** Masked hint only, such as `sa***@example.com`; never the full login. */
  loginHint: d.varchar("login_hint", { length: 255 }),
  status: d.varchar({ length: 30 }).notNull().default("connected"),
  lastVerifiedAt: d.timestamp("last_verified_at", { withTimezone: true }),
  lastOperationAt: d.timestamp("last_operation_at", { withTimezone: true }),
  lastError: d.text("last_error"),
  createdAt: d
    .timestamp({ withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}));
