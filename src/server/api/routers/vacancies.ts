import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  notInArray,
  or,
} from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  candidateStatusOptions,
  candidates,
  candidateVacancies,
  companyHhAccounts,
  companyTelegramChannels,
  recentActivityLogs,
  vacancies,
} from "~/server/db/schema";
import {
  fetchCompanyHhVacancies,
  fetchHhVacancyById,
  isHhConfigured,
  refreshHhAccessToken,
  resolveHhEmployerFromAccessToken,
} from "~/server/services/hh";
import {
  isTelegramConfigured,
  sendTelegramMessage,
} from "~/server/services/telegram";
import { buildCandidateResumeUrl } from "~/server/storage/resume-storage";
import { getUserCompanyId } from "~/server/utils/get-user-company-id";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";
import { formatTelegramVacancy } from "~/utils/format-telegram-vacancy";
import { generateVacancyKeyword } from "~/utils/generate-vacancy-keyword";

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

type VacancyStatus = "active" | "draft" | "paused" | "closed" | "archive";
type SalaryCurrency = "UZS" | "USD";

function toVacancyStatus(value: string | null): VacancyStatus {
  switch (value) {
    case "active":
    case "draft":
    case "paused":
    case "closed":
    case "archive":
      return value;
    default:
      return "active";
  }
}

async function getVacancyRelatedCandidates(
  db: typeof import("~/server/db").db,
  vacancyId: string,
  companyId: string,
) {
  return db
    .select({
      id: candidates.id,
      fullName: candidates.fullName,
      status: candidates.status,
      city: candidates.city,
      experience: candidates.experience,
      matchScore: candidates.matchScore,
      aiAnalysis: candidates.aiAnalysis,
      currentPosition: candidates.currentPosition,
      contacts: candidates.contacts,
      languages: candidates.languages,
      skills: candidates.skills,
      salaryExpectation: candidates.salaryExpectation,
      salaryCurrency: candidates.salaryCurrency,
      tags: candidates.tags,
      source: candidates.source,
      workExperience: candidates.workExperience,
      resumeFileId: candidates.resumeFileId,
    })
    .from(candidateVacancies)
    .innerJoin(candidates, eq(candidateVacancies.candidateId, candidates.id))
    .where(
      and(
        eq(candidateVacancies.vacancyId, vacancyId),
        eq(candidates.companyId, companyId),
      ),
    )
    .orderBy(desc(candidateVacancies.id));
}

async function getVacancyResponseCounts(
  db: typeof import("~/server/db").db,
  vacancyIds: string[],
) {
  if (vacancyIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await db
    .select({
      vacancyId: candidateVacancies.vacancyId,
      total: count(candidateVacancies.id),
    })
    .from(candidateVacancies)
    .where(inArray(candidateVacancies.vacancyId, vacancyIds))
    .groupBy(candidateVacancies.vacancyId);

  return new Map(rows.map((row) => [row.vacancyId, row.total]));
}

function toSalaryCurrency(value: string | null): SalaryCurrency {
  return value === "USD" ? "USD" : "UZS";
}

function formatVacancy(
  vacancy: typeof vacancies.$inferSelect,
  responses = vacancy.responses ?? 0,
) {
  return {
    id: vacancy.id,
    title: vacancy.title,
    level: vacancy.level ?? "",
    status: toVacancyStatus(vacancy.status),
    city: vacancy.city ?? "",
    responses,
    workType: vacancy.workType ?? "",
    salaryExpectation: vacancy.salaryExpectation ?? undefined,
    salaryCurrency: toSalaryCurrency(vacancy.salaryCurrency),
    workScheduleStart: vacancy.workScheduleStart ?? "09:00",
    workScheduleEnd: vacancy.workScheduleEnd ?? "18:00",
    comments: vacancy.comments ?? "",
    tasks: vacancy.tasks ?? "",
    team: vacancy.team ?? "",
    companyDescription: vacancy.companyDescription ?? "",
    companyId: vacancy.companyId ?? undefined,
    publishedAt: undefined,
    source: "local" as const,
    externalUrl: undefined,
  };
}

function formatHhVacancy(
  vacancy: Awaited<ReturnType<typeof fetchCompanyHhVacancies>>[number],
  companyId: string,
) {
  return {
    id: `hh_${vacancy.id}`,
    title: vacancy.title,
    level: vacancy.level,
    status: vacancy.status,
    city: vacancy.city,
    responses: vacancy.responses,
    workType: vacancy.workType,
    salaryExpectation: undefined,
    salaryCurrency: "UZS" as const,
    workScheduleStart: undefined,
    workScheduleEnd: undefined,
    comments: "",
    tasks: "",
    team: "",
    companyDescription: "",
    companyId,
    publishedAt: vacancy.publishedAt,
    source: "hh.uz" as const,
    externalUrl: vacancy.externalUrl,
  };
}

function isHhVacancyId(value: string): boolean {
  return value.startsWith("hh_");
}

function normalizeHhVacancyId(value: string): string {
  if (value.startsWith("hh_")) {
    return value;
  }

  return value;
}

const vacancyPeriodSchema = z.enum(["day", "week", "month", "year"]);

function getVacancyDateCutoff(period: z.infer<typeof vacancyPeriodSchema>) {
  const cutoff = new Date();

  switch (period) {
    case "day":
      cutoff.setDate(cutoff.getDate() - 1);
      break;
    case "week":
      cutoff.setDate(cutoff.getDate() - 7);
      break;
    case "month":
      cutoff.setMonth(cutoff.getMonth() - 1);
      break;
    case "year":
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
  }

  return cutoff;
}

function isDateWithinPeriod(value: string | undefined, cutoff: Date) {
  if (!value) {
    return false;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return parsedDate >= cutoff;
}

async function requireCurrentUserCompanyId(
  db: typeof import("~/server/db").db,
  userId: string | undefined,
) {
  const companyId = await getUserCompanyId(db, userId);

  if (!companyId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "У вас не привязана компания",
    });
  }

  return companyId;
}

export const vacanciesRouter = createTRPCRouter({
  hasVacancies: protectedProcedure.query(async ({ ctx }) => {
    const userCompanyId = await getUserCompanyId(ctx.db, ctx.session?.user?.id);

    if (!userCompanyId) {
      return false;
    }

    const localRows = await ctx.db
      .select({ id: vacancies.id })
      .from(vacancies)
      .where(eq(vacancies.companyId, userCompanyId))
      .limit(1);

    if (localRows.length > 0) {
      return true;
    }

    if (userCompanyId !== DEFAULT_COMPANY_ID) {
      return false;
    }

    const hhAccountRows = await ctx.db
      .select({
        accessToken: companyHhAccounts.accessToken,
        employerId: companyHhAccounts.employerId,
        id: companyHhAccounts.id,
        refreshToken: companyHhAccounts.refreshToken,
      })
      .from(companyHhAccounts)
      .where(eq(companyHhAccounts.companyId, userCompanyId))
      .limit(1);

    const hhAccount = hhAccountRows[0];
    const hasHhOAuth = Boolean(
      hhAccount?.accessToken || hhAccount?.refreshToken,
    );
    if (!hasHhOAuth) {
      return false;
    }

    let employerId = hhAccount?.employerId?.trim();

    if (!employerId && hhAccount?.accessToken && isHhConfigured()) {
      try {
        const resolvedAccount = await resolveHhEmployerFromAccessToken(
          hhAccount.accessToken,
        );
        employerId = resolvedAccount.employerId;

        await ctx.db
          .update(companyHhAccounts)
          .set({
            email: resolvedAccount.email,
            employerId: resolvedAccount.employerId,
          })
          .where(eq(companyHhAccounts.id, hhAccount.id));
      } catch (_resolveError) {
        if (hhAccount.refreshToken) {
          try {
            const refreshedTokens = await refreshHhAccessToken(
              hhAccount.refreshToken,
            );
            const resolvedAccount = await resolveHhEmployerFromAccessToken(
              refreshedTokens.accessToken,
            );
            employerId = resolvedAccount.employerId;

            await ctx.db
              .update(companyHhAccounts)
              .set({
                accessToken: refreshedTokens.accessToken,
                email: resolvedAccount.email,
                employerId: resolvedAccount.employerId,
                refreshToken: refreshedTokens.refreshToken,
              })
              .where(eq(companyHhAccounts.id, hhAccount.id));
          } catch {
            return false;
          }
        } else {
          return false;
        }
      }
    }

    if (!employerId) {
      return false;
    }

    try {
      const hhVacancies = await fetchCompanyHhVacancies(employerId);
      return hhVacancies.length > 0;
    } catch {
      return false;
    }
  }),

  getAllVacancies: protectedProcedure
    .input(
      z
        .object({
          period: vacancyPeriodSchema.optional().default("week"),
          search: z.string().max(255).optional(),
          statuses: z.array(z.string().max(50)).optional(),
          city: z.string().max(255).optional(),
          sources: z.array(z.string().max(255)).optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const period = input?.period ?? "week";
      const search = input?.search?.trim();
      const shouldApplyPeriod = !search;
      const normalizedSearch = search?.toLowerCase() ?? "";
      const statuses = input?.statuses?.filter(Boolean) ?? [];
      const city = input?.city?.trim();
      const normalizedCity = city?.toLowerCase() ?? "";
      const sources = input?.sources?.filter(Boolean) ?? [];
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const createdAtCutoff = getVacancyDateCutoff(period);
      const userCompanyId = await getUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      if (!userCompanyId) {
        return { items: [], total: 0 };
      }

      const includeLocal = sources.length === 0 || sources.includes("local");
      const includeHh = sources.length === 0 || sources.includes("hh.uz");

      let localVacancies: ReturnType<typeof formatVacancy>[] = [];

      if (includeLocal) {
        const localConditions = [eq(vacancies.companyId, userCompanyId)];

        if (shouldApplyPeriod) {
          localConditions.push(gte(vacancies.createdAt, createdAtCutoff));
        }

        if (search) {
          const searchCondition = or(
            ilike(vacancies.title, `%${escapeLike(search)}%`),
            ilike(vacancies.level, `%${escapeLike(search)}%`),
            ilike(vacancies.city, `%${escapeLike(search)}%`),
            ilike(vacancies.workType, `%${escapeLike(search)}%`),
          );

          if (searchCondition) {
            localConditions.push(searchCondition);
          }
        }

        if (statuses.length > 0) {
          localConditions.push(inArray(vacancies.status, statuses));
        }

        if (city) {
          localConditions.push(eq(vacancies.city, city));
        }

        const rows = await ctx.db
          .select()
          .from(vacancies)
          .where(and(...localConditions))
          .orderBy(desc(vacancies.createdAt));

        const responseCounts = await getVacancyResponseCounts(
          ctx.db,
          rows.map((row) => row.id),
        );
        localVacancies = rows.map((row) =>
          formatVacancy(row, responseCounts.get(row.id) ?? 0),
        );
      }

      if (userCompanyId !== DEFAULT_COMPANY_ID) {
        console.info("[hh.uz] skipping vacancy sync for non-default company", {
          userCompanyId,
          defaultCompanyId: DEFAULT_COMPANY_ID,
          localVacancies: localVacancies.length,
        });
        return {
          items: localVacancies.slice(offset, offset + limit),
          total: localVacancies.length,
        };
      }

      const hhAccountRows = await ctx.db
        .select({
          accessToken: companyHhAccounts.accessToken,
          employerId: companyHhAccounts.employerId,
          id: companyHhAccounts.id,
          refreshToken: companyHhAccounts.refreshToken,
        })
        .from(companyHhAccounts)
        .where(eq(companyHhAccounts.companyId, userCompanyId))
        .limit(1);

      const hhAccount = hhAccountRows[0];
      const hasHhOAuth = Boolean(
        hhAccount?.accessToken || hhAccount?.refreshToken,
      );
      if (!hasHhOAuth || !includeHh) {
        console.info("[hh.uz] skipping vacancy sync because OAuth is missing", {
          companyId: userCompanyId,
          localVacancies: localVacancies.length,
        });
        return {
          items: localVacancies.slice(offset, offset + limit),
          total: localVacancies.length,
        };
      }

      let employerId = hhAccount?.employerId?.trim();

      if (!employerId && hhAccount?.accessToken && isHhConfigured()) {
        try {
          const resolvedAccount = await resolveHhEmployerFromAccessToken(
            hhAccount.accessToken,
          );
          employerId = resolvedAccount.employerId;

          await ctx.db
            .update(companyHhAccounts)
            .set({
              email: resolvedAccount.email,
              employerId: resolvedAccount.employerId,
            })
            .where(eq(companyHhAccounts.id, hhAccount.id));
        } catch (resolveError) {
          if (hhAccount.refreshToken) {
            try {
              const refreshedTokens = await refreshHhAccessToken(
                hhAccount.refreshToken,
              );
              const resolvedAccount = await resolveHhEmployerFromAccessToken(
                refreshedTokens.accessToken,
              );
              employerId = resolvedAccount.employerId;

              await ctx.db
                .update(companyHhAccounts)
                .set({
                  accessToken: refreshedTokens.accessToken,
                  email: resolvedAccount.email,
                  employerId: resolvedAccount.employerId,
                  refreshToken: refreshedTokens.refreshToken,
                })
                .where(eq(companyHhAccounts.id, hhAccount.id));
            } catch (refreshError) {
              console.error(
                "Failed to refresh HH account before vacancy sync",
                {
                  companyId: userCompanyId,
                  error: refreshError,
                },
              );
            }
          } else {
            console.error("Failed to resolve HH employer ID for company", {
              companyId: userCompanyId,
              error: resolveError,
            });
          }
        }
      }

      if (!employerId) {
        console.info(
          "[hh.uz] skipping vacancy sync because employerId is missing",
          {
            companyId: userCompanyId,
            localVacancies: localVacancies.length,
          },
        );
        return {
          items: localVacancies.slice(offset, offset + limit),
          total: localVacancies.length,
        };
      }

      try {
        const hhVacancies = await fetchCompanyHhVacancies(employerId);
        const filteredHhVacancies = hhVacancies
          .map((vacancy) => formatHhVacancy(vacancy, userCompanyId))
          .filter((vacancy) =>
            shouldApplyPeriod
              ? isDateWithinPeriod(vacancy.publishedAt, createdAtCutoff)
              : true,
          )
          .filter((vacancy) => {
            if (statuses.length > 0 && !statuses.includes(vacancy.status)) {
              return false;
            }

            if (
              normalizedCity &&
              vacancy.city.trim().toLowerCase() !== normalizedCity
            ) {
              return false;
            }

            if (!normalizedSearch) {
              return true;
            }

            const combinedValue =
              `${vacancy.title} ${vacancy.level} ${vacancy.city} ${vacancy.source} ${vacancy.workType}`.toLowerCase();

            return combinedValue.includes(normalizedSearch);
          });

        console.info("[hh.uz] merging vacancies into response", {
          companyId: userCompanyId,
          employerId,
          localVacancies: localVacancies.length,
          hhVacancies: filteredHhVacancies.length,
        });

        const items = [...localVacancies, ...filteredHhVacancies];

        return {
          items: items.slice(offset, offset + limit),
          total: items.length,
        };
      } catch (error) {
        console.error("Failed to fetch hh.uz vacancies for company", {
          companyId: userCompanyId,
          employerId,
          error,
        });

        return {
          items: localVacancies.slice(offset, offset + limit),
          total: localVacancies.length,
        };
      }
    }),

  getVacancyById: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .query(async ({ ctx, input }) => {
      const normalizedId = normalizeHhVacancyId(input.id);
      const userCompanyId = await getUserCompanyId(ctx.db, ctx.session.user.id);

      if (!userCompanyId) {
        return null;
      }

      if (isHhVacancyId(normalizedId)) {
        const hhVacancyId = normalizedId.slice(3);

        let accessToken: string | undefined;
        const hhAccountRows = await ctx.db
          .select({
            accessToken: companyHhAccounts.accessToken,
          })
          .from(companyHhAccounts)
          .where(eq(companyHhAccounts.companyId, userCompanyId))
          .limit(1);
        accessToken = hhAccountRows[0]?.accessToken ?? undefined;

        try {
          const hhVacancy = await fetchHhVacancyById(hhVacancyId, accessToken);

          return {
            id: normalizedId,
            title: hhVacancy.title,
            level: hhVacancy.level,
            status: hhVacancy.status,
            city: hhVacancy.city,
            responses: hhVacancy.responses,
            workType: hhVacancy.workType,
            salaryExpectation: hhVacancy.salaryExpectation,
            salaryCurrency: hhVacancy.salaryCurrency ?? "UZS",
            workScheduleStart: hhVacancy.workScheduleStart,
            workScheduleEnd: hhVacancy.workScheduleEnd,
            comments: hhVacancy.comments ?? "",
            tasks: hhVacancy.tasks ?? "",
            team: hhVacancy.team ?? "",
            companyDescription: hhVacancy.companyDescription ?? "",
            companyId: userCompanyId ?? undefined,
            publishedAt: hhVacancy.publishedAt,
            source: "hh.uz" as const,
            externalUrl: hhVacancy.externalUrl,
            relatedCandidates: [] as {
              id: string;
              fullName: string;
              status: string | null;
            }[],
          };
        } catch (error) {
          console.error("Failed to fetch HH vacancy by id", {
            hhVacancyId,
            companyId: userCompanyId,
            error,
          });

          return null;
        }
      }

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, normalizedId),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .limit(1);

      const vacancy = rows[0];
      if (!vacancy) {
        return null;
      }

      const relatedCandidateRows = await getVacancyRelatedCandidates(
        ctx.db,
        vacancy.id,
        userCompanyId,
      );

      return {
        ...formatVacancy(vacancy, relatedCandidateRows.length),
        relatedCandidates: relatedCandidateRows,
      };
    }),

  getVacancyFunnel: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .query(async ({ ctx, input }) => {
      const userCompanyId = await getUserCompanyId(ctx.db, ctx.session.user.id);

      if (!userCompanyId || isHhVacancyId(input.id)) {
        return null;
      }

      const rows = await ctx.db
        .select({
          id: vacancies.id,
          title: vacancies.title,
          level: vacancies.level,
          city: vacancies.city,
        })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, input.id),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .limit(1);

      const vacancy = rows[0];
      if (!vacancy) {
        return null;
      }

      const candidateRows = await getVacancyRelatedCandidates(
        ctx.db,
        vacancy.id,
        userCompanyId,
      );

      const relatedVacancyRows =
        candidateRows.length > 0
          ? await ctx.db
              .select({
                candidateId: candidateVacancies.candidateId,
                vacancyId: vacancies.id,
                title: vacancies.title,
              })
              .from(candidateVacancies)
              .innerJoin(
                vacancies,
                eq(candidateVacancies.vacancyId, vacancies.id),
              )
              .where(
                and(
                  inArray(
                    candidateVacancies.candidateId,
                    candidateRows.map((candidate) => candidate.id),
                  ),
                  eq(vacancies.companyId, userCompanyId),
                ),
              )
              .orderBy(desc(candidateVacancies.id))
          : [];

      const relatedVacanciesByCandidate = new Map<
        string,
        { id: string; title: string }[]
      >();

      for (const row of relatedVacancyRows) {
        if (row.vacancyId === vacancy.id) {
          continue;
        }

        const existing = relatedVacanciesByCandidate.get(row.candidateId) ?? [];
        existing.push({ id: row.vacancyId, title: row.title });
        relatedVacanciesByCandidate.set(row.candidateId, existing);
      }

      const stageRows = await ctx.db
        .select({
          value: candidateStatusOptions.value,
          label: candidateStatusOptions.label,
        })
        .from(candidateStatusOptions)
        .where(eq(candidateStatusOptions.isActive, true))
        .orderBy(
          asc(candidateStatusOptions.sortOrder),
          asc(candidateStatusOptions.label),
        );

      const normalizedCandidates = candidateRows.map((candidate) => {
        const contacts =
          ((candidate.contacts ?? []) as { type: string; value: string }[]) ??
          [];
        const phone =
          contacts.find((item) => item.type === "phone")?.value ?? "";
        const telegram =
          contacts.find((item) => item.type === "telegram")?.value ?? "";
        const email =
          contacts.find((item) => item.type === "email")?.value ?? "";
        const workExperience =
          ((candidate.workExperience ?? []) as {
            company: string;
            position: string;
            period: string;
            isCurrent?: boolean;
            description: string[];
          }[]) ?? [];
        const currentWorkplace =
          workExperience.find((item) => item.isCurrent) ?? workExperience[0];

        return {
          id: candidate.id,
          fullName: candidate.fullName,
          status: candidate.status ?? "new",
          city: candidate.city ?? "",
          experience: candidate.experience ?? "",
          matchScore: candidate.matchScore ?? 0,
          aiAnalysis: candidate.aiAnalysis ?? "",
          currentPosition:
            candidate.currentPosition ?? currentWorkplace?.position ?? "",
          currentCompany: currentWorkplace?.company ?? "",
          contacts: {
            phone,
            telegram,
            email,
          },
          languages: (candidate.languages ?? []) as {
            name: string;
            level: string;
          }[],
          skills: (candidate.skills ?? []) as string[],
          salaryExpectation: candidate.salaryExpectation ?? 0,
          salaryCurrency: candidate.salaryCurrency ?? "UZS",
          tags: (candidate.tags ?? []) as string[],
          source: candidate.source ?? "",
          resumeUrl: candidate.resumeFileId
            ? buildCandidateResumeUrl(candidate.id)
            : "",
          relatedVacancies: relatedVacanciesByCandidate.get(candidate.id) ?? [],
        };
      });

      return {
        id: vacancy.id,
        title: vacancy.title,
        level: vacancy.level ?? "",
        city: vacancy.city ?? "",
        candidates: normalizedCandidates,
        stages: stageRows.map((stage) => ({
          value: stage.value,
          label: stage.label,
          candidates: normalizedCandidates.filter(
            (candidate) => candidate.status === stage.value,
          ),
        })),
      };
    }),

  searchAvailableCandidatesForVacancy: protectedProcedure
    .input(
      z.object({
        vacancyId: z.string().min(1).max(255),
        query: z.string().max(255),
        limit: z.number().min(1).max(50).optional(),
        offset: z.number().min(0).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const search = input.query.trim();
      const limit = input.limit ?? 8;
      const offset = input.offset ?? 0;

      const userCompanyId = await getUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      if (!userCompanyId || isHhVacancyId(input.vacancyId)) {
        return {
          items: [],
          total: 0,
        };
      }

      const vacancyRows = await ctx.db
        .select({ id: vacancies.id })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, input.vacancyId),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .limit(1);

      if (!vacancyRows[0]) {
        return {
          items: [],
          total: 0,
        };
      }

      const assignedCandidateRows = await ctx.db
        .select({ candidateId: candidateVacancies.candidateId })
        .from(candidateVacancies)
        .where(eq(candidateVacancies.vacancyId, input.vacancyId));

      const assignedCandidateIds = assignedCandidateRows.map(
        (row) => row.candidateId,
      );

      const conditions = [eq(candidates.companyId, userCompanyId)];

      if (assignedCandidateIds.length > 0) {
        conditions.push(notInArray(candidates.id, assignedCandidateIds));
      }

      if (search) {
        const searchCondition = or(
          ilike(candidates.fullName, `%${escapeLike(search)}%`),
          ilike(candidates.city, `%${escapeLike(search)}%`),
          ilike(candidates.currentPosition, `%${escapeLike(search)}%`),
        );

        if (!searchCondition) {
          return {
            items: [],
            total: 0,
          };
        }

        conditions.push(searchCondition);
      }

      const whereClause = and(...conditions);

      const [rows, totalRows] = await Promise.all([
        ctx.db
          .select({
            id: candidates.id,
            fullName: candidates.fullName,
            city: candidates.city,
            currentPosition: candidates.currentPosition,
            status: candidates.status,
            source: candidates.source,
          })
          .from(candidates)
          .where(whereClause)
          .orderBy(desc(candidates.createdAt))
          .limit(limit)
          .offset(offset),
        ctx.db.select({ total: count() }).from(candidates).where(whereClause),
      ]);

      return {
        items: rows.map((candidate) => ({
          id: candidate.id,
          fullName: candidate.fullName,
          city: candidate.city ?? "",
          currentPosition: candidate.currentPosition ?? "",
          status: candidate.status ?? "new",
          source: candidate.source ?? "",
        })),
        total: totalRows[0]?.total ?? 0,
      };
    }),

  assignCandidateToVacancy: protectedProcedure
    .input(
      z.object({
        vacancyId: z.string().min(1).max(255),
        candidateId: z.string().min(1).max(255),
        status: z.string().min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userCompanyId = await getUserCompanyId(ctx.db, ctx.session.user.id);

      if (!userCompanyId || isHhVacancyId(input.vacancyId)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Вакансия не найдена",
        });
      }

      const [vacancyRows, candidateRows, statusRows, existingRows] =
        await Promise.all([
          ctx.db
            .select({ id: vacancies.id })
            .from(vacancies)
            .where(
              and(
                eq(vacancies.id, input.vacancyId),
                eq(vacancies.companyId, userCompanyId),
              ),
            )
            .limit(1),
          ctx.db
            .select({
              id: candidates.id,
              status: candidates.status,
            })
            .from(candidates)
            .where(
              and(
                eq(candidates.id, input.candidateId),
                eq(candidates.companyId, userCompanyId),
              ),
            )
            .limit(1),
          ctx.db
            .select({ value: candidateStatusOptions.value })
            .from(candidateStatusOptions)
            .where(
              and(
                eq(candidateStatusOptions.value, input.status),
                eq(candidateStatusOptions.isActive, true),
              ),
            )
            .limit(1),
          ctx.db
            .select({ id: candidateVacancies.id })
            .from(candidateVacancies)
            .where(
              and(
                eq(candidateVacancies.vacancyId, input.vacancyId),
                eq(candidateVacancies.candidateId, input.candidateId),
              ),
            )
            .limit(1),
        ]);

      if (!vacancyRows[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Вакансия не найдена",
        });
      }

      const candidate = candidateRows[0];
      if (!candidate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Кандидат не найден",
        });
      }

      if (!statusRows[0]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Некорректный статус кандидата",
        });
      }

      if (!existingRows[0]) {
        await ctx.db.insert(candidateVacancies).values({
          candidateId: input.candidateId,
          vacancyId: input.vacancyId,
        });
      }

      if (candidate.status !== input.status) {
        await ctx.db
          .update(candidates)
          .set({
            status: input.status,
            updatedAt: new Date(),
          })
          .where(eq(candidates.id, input.candidateId));
      }

      return {
        success: true,
      };
    }),

  searchVacancies: protectedProcedure
    .input(
      z.object({
        query: z.string().max(255),
        limit: z.number().min(1).max(50).optional(),
        offset: z.number().min(0).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const search = input.query.trim();
      const limit = input.limit ?? 8;
      const offset = input.offset ?? 0;

      const userCompanyId = await getUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      if (!userCompanyId) {
        return {
          items: [],
          total: 0,
        };
      }

      const conditions = [];
      conditions.push(eq(vacancies.companyId, userCompanyId));
      if (search) {
        conditions.push(ilike(vacancies.title, `%${escapeLike(search)}%`));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, totalRows] = await Promise.all([
        ctx.db
          .select()
          .from(vacancies)
          .where(whereClause)
          .orderBy(desc(vacancies.createdAt))
          .limit(limit)
          .offset(offset),
        ctx.db.select({ total: count() }).from(vacancies).where(whereClause),
      ]);

      const responseCounts = await getVacancyResponseCounts(
        ctx.db,
        rows.map((row) => row.id),
      );

      return {
        items: rows.map((row) =>
          formatVacancy(row, responseCounts.get(row.id)),
        ),
        total: totalRows[0]?.total ?? 0,
      };
    }),

  createVacancy: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "Название вакансии обязательно").max(255),
        level: z.string().max(100).optional(),
        status: z
          .enum(["active", "draft", "paused", "closed", "archive"])
          .default("active"),
        city: z.string().max(255).optional(),
        responses: z.number().int().min(0).default(0),
        workType: z.string().max(100).optional(),
        salaryExpectation: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .optional(),
        salaryCurrency: z.enum(["UZS", "USD"]).default("UZS"),
        workScheduleStart: z.string().max(10).optional(),
        workScheduleEnd: z.string().max(10).optional(),
        comments: z.string().max(4000).optional(),
        tasks: z.string().max(4000).optional(),
        team: z.string().max(4000).optional(),
        companyDescription: z.string().max(8000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const companyId = await requireCurrentUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      const createdRows = await ctx.db
        .insert(vacancies)
        .values({
          title: input.title,
          level: input.level ?? null,
          status: input.status,
          city: input.city ?? null,
          responses: input.responses,
          workType: input.workType ?? null,
          salaryExpectation: input.salaryExpectation ?? null,
          salaryCurrency: input.salaryCurrency,
          workScheduleStart: input.workScheduleStart ?? null,
          workScheduleEnd: input.workScheduleEnd ?? null,
          comments: input.comments ?? null,
          tasks: input.tasks ?? null,
          team: input.team ?? null,
          companyDescription: input.companyDescription ?? null,
          companyId,
        })
        .returning();

      const created = createdRows[0];
      if (!created) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create vacancy",
        });
      }

      const actorName =
        ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";

      try {
        await ctx.db.insert(recentActivityLogs).values({
          entityType: "vacancy",
          entityId: created.id,
          companyId,
          actorUserId: ctx.session?.user?.id ?? null,
          actorName,
          action: "Создал(а) вакансию",
          targetName: created.title,
          targetStatus: "Создана",
        });
      } catch (error) {
        console.error(
          "Failed to write recent activity log for vacancy creation",
          error,
        );
      }

      return formatVacancy(created);
    }),

  updateVacancy: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1).max(255),
        title: z.string().min(1).max(255).optional(),
        level: z.string().max(100).optional(),
        status: z
          .enum(["active", "draft", "paused", "closed", "archive"])
          .optional(),
        city: z.string().max(255).optional(),
        responses: z.number().int().min(0).optional(),
        workType: z.string().max(100).optional(),
        salaryExpectation: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .nullable()
          .optional(),
        salaryCurrency: z.enum(["UZS", "USD"]).optional(),
        workScheduleStart: z.string().max(10).optional(),
        workScheduleEnd: z.string().max(10).optional(),
        comments: z.string().max(4000).optional(),
        tasks: z.string().max(4000).optional(),
        team: z.string().max(4000).optional(),
        companyDescription: z.string().max(8000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userCompanyId = await requireCurrentUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, input.id),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .limit(1);

      const existing = rows[0];
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vacancy not found",
        });
      }

      const valuesToUpdate: Partial<{
        title: string;
        level: string | null;
        status: "active" | "draft" | "paused" | "closed" | "archive";
        city: string | null;
        responses: number;
        workType: string | null;
        salaryExpectation: number | null;
        salaryCurrency: SalaryCurrency;
        workScheduleStart: string | null;
        workScheduleEnd: string | null;
        comments: string | null;
        tasks: string | null;
        team: string | null;
        companyDescription: string | null;
      }> = {};

      if (input.title && input.title !== existing.title) {
        valuesToUpdate.title = input.title;
      }

      if (input.level !== undefined && input.level !== (existing.level ?? "")) {
        valuesToUpdate.level = input.level || null;
      }

      if (input.status && input.status !== (existing.status ?? "active")) {
        valuesToUpdate.status = input.status;
      }

      if (input.city !== undefined && input.city !== (existing.city ?? "")) {
        valuesToUpdate.city = input.city || null;
      }

      if (
        input.responses !== undefined &&
        input.responses !== (existing.responses ?? 0)
      ) {
        valuesToUpdate.responses = input.responses;
      }

      if (
        input.workType !== undefined &&
        input.workType !== (existing.workType ?? "")
      ) {
        valuesToUpdate.workType = input.workType || null;
      }

      if (
        input.salaryExpectation !== undefined &&
        input.salaryExpectation !== existing.salaryExpectation
      ) {
        valuesToUpdate.salaryExpectation = input.salaryExpectation;
      }

      if (
        input.salaryCurrency !== undefined &&
        input.salaryCurrency !== toSalaryCurrency(existing.salaryCurrency)
      ) {
        valuesToUpdate.salaryCurrency = input.salaryCurrency;
      }

      if (
        input.workScheduleStart !== undefined &&
        input.workScheduleStart !== (existing.workScheduleStart ?? "")
      ) {
        valuesToUpdate.workScheduleStart = input.workScheduleStart || null;
      }

      if (
        input.workScheduleEnd !== undefined &&
        input.workScheduleEnd !== (existing.workScheduleEnd ?? "")
      ) {
        valuesToUpdate.workScheduleEnd = input.workScheduleEnd || null;
      }

      if (
        input.comments !== undefined &&
        input.comments !== (existing.comments ?? "")
      ) {
        valuesToUpdate.comments = input.comments || null;
      }

      if (input.tasks !== undefined && input.tasks !== (existing.tasks ?? "")) {
        valuesToUpdate.tasks = input.tasks || null;
      }

      if (input.team !== undefined && input.team !== (existing.team ?? "")) {
        valuesToUpdate.team = input.team || null;
      }

      if (
        input.companyDescription !== undefined &&
        input.companyDescription !== (existing.companyDescription ?? "")
      ) {
        valuesToUpdate.companyDescription = input.companyDescription || null;
      }

      if (Object.keys(valuesToUpdate).length === 0) {
        return formatVacancy(existing);
      }

      const updatedRows = await ctx.db
        .update(vacancies)
        .set(valuesToUpdate)
        .where(
          and(
            eq(vacancies.id, input.id),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .returning();

      const updated = updatedRows[0];
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update vacancy",
        });
      }

      const actorName =
        ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";
      const changedStatus = valuesToUpdate.status ?? null;

      try {
        await ctx.db.insert(recentActivityLogs).values({
          entityType: "vacancy",
          entityId: updated.id,
          companyId: userCompanyId,
          actorUserId: ctx.session?.user?.id ?? null,
          actorName,
          action: changedStatus
            ? "Изменил(а) статус вакансии"
            : "Обновил(а) вакансию",
          targetName: updated.title,
          targetStatus: changedStatus ?? "Профиль обновлен",
        });
      } catch (error) {
        console.error("Failed to write recent activity log for vacancy", error);
      }

      return formatVacancy(updated);
    }),

  isTelegramEnabled: protectedProcedure.query(async ({ ctx }) => {
    if (!isTelegramConfigured()) {
      return { enabled: false };
    }

    // Check if the user's company has at least one Telegram channel
    const companyId = await getUserCompanyId(ctx.db, ctx.session?.user?.id);

    if (!companyId) {
      return { enabled: false };
    }

    const channels = await ctx.db
      .select({ id: companyTelegramChannels.id })
      .from(companyTelegramChannels)
      .where(eq(companyTelegramChannels.companyId, companyId))
      .limit(1);

    return { enabled: channels.length > 0 };
  }),

  postVacancyToTelegram: protectedProcedure
    .input(z.object({ vacancyId: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      if (!isTelegramConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Telegram не настроен",
        });
      }

      const companyId = await requireCurrentUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, input.vacancyId),
            eq(vacancies.companyId, companyId),
          ),
        )
        .limit(1);

      const vacancy = rows[0];
      if (!vacancy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Вакансия не найдена",
        });
      }

      if (!vacancy.companyId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "У вакансии не указана компания",
        });
      }

      const channels = await ctx.db
        .select()
        .from(companyTelegramChannels)
        .where(eq(companyTelegramChannels.companyId, companyId));

      if (channels.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "У компании не настроены Telegram-каналы",
        });
      }

      const keyword = generateVacancyKeyword(vacancy.id, vacancy.companyId);
      const formatted = formatVacancy(vacancy);
      const message = formatTelegramVacancy(formatted, keyword);

      // Post to all company channels
      const errors: string[] = [];
      for (const channel of channels) {
        try {
          await sendTelegramMessage(message, channel.channelId);
        } catch (err) {
          errors.push(
            `Канал ${channel.channelId}: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`,
          );
        }
      }

      if (errors.length === channels.length) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Не удалось отправить ни в один канал:\n${errors.join("\n")}`,
        });
      }

      return {
        success: true,
        keyword,
        sentTo: channels.length - errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    }),
});
