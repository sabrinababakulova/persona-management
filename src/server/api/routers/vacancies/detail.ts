import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getRequestLocale } from "~/i18n/server-locale";
import { getOptionalCompanyId } from "~/server/api/router-utils/company";
import { protectedProcedure } from "~/server/api/trpc";
import {
  candidateStatusOptions,
  candidateVacancies,
  vacancies,
  vacancyTelegramPosts,
} from "~/server/db/schema";
import {
  fetchHhVacancyApplicants,
  fetchHhVacancyById,
  fetchHhVacancyDetail,
  type HhVacancyDetail,
  isHhAccessError,
} from "~/server/services/hh";
import { sanitizeHhDescriptionHtml } from "~/server/services/hh/sanitize-html";
import { resolveUserHhAuth } from "~/server/services/hh-company-account";
import {
  fetchPersonHunterVacancyById,
  getPersonHunterApiKey,
  isPersonHunterConfigured,
} from "~/server/services/person-hunter";
import { buildCandidateResumeUrl } from "~/server/storage/resume-storage";
import {
  getLocalizedStringList,
  getLocalizedText,
} from "~/shared/localized-ai";
import { formatExperienceMonths } from "~/utils/russian-plural";

import {
  vacancyFunnelInputSchema,
  vacancyIdInputSchema,
  vacancyPublicationListInputSchema,
} from "./schemas";
import {
  getVacanciesRelatedCandidates,
  isHhVacancyId,
  isUserVisibleOrWarehouseVacancy,
  isUserVisibleVacancy,
} from "./shared";

const DEFAULT_FUNNEL_PAGE_SIZE = 10;

type FunnelStageRow = {
  value: string;
  label: string;
};

type FunnelFilterableCandidate = {
  status: string;
  fullName: string;
  city: string;
  currentPosition: string;
  currentCompany: string;
  source: string;
  matchScore: number;
};

function buildPaginatedFunnelStages<T extends FunnelFilterableCandidate>(
  stages: FunnelStageRow[],
  candidates: T[],
  input: z.infer<typeof vacancyFunnelInputSchema>,
) {
  const search = input.search?.trim().toLowerCase() ?? "";
  const city = input.city?.trim().toLowerCase() ?? "";
  const sources = new Set(input.sources?.filter(Boolean) ?? []);
  const statuses = new Set(input.statuses?.filter(Boolean) ?? []);
  const paginationByStage = new Map(
    input.stagePagination?.map((pagination) => [
      pagination.stage,
      pagination,
    ]) ?? [],
  );

  const filteredCandidates = candidates
    .filter((candidate) => {
      if (search) {
        const haystack = [
          candidate.fullName,
          candidate.currentPosition,
          candidate.currentCompany,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      if (city && !candidate.city.toLowerCase().includes(city)) {
        return false;
      }
      if (sources.size > 0 && !sources.has(candidate.source)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return stages
    .filter((stage) => statuses.size === 0 || statuses.has(stage.value))
    .map((stage) => {
      const stageCandidates = filteredCandidates.filter(
        (candidate) => candidate.status === stage.value,
      );
      const pagination = paginationByStage.get(stage.value);
      const limit = pagination?.limit ?? DEFAULT_FUNNEL_PAGE_SIZE;
      const offset = pagination?.offset ?? 0;

      return {
        value: stage.value,
        label: stage.label,
        candidates: stageCandidates.slice(offset, offset + limit),
        total: stageCandidates.length,
        limit,
        offset,
      };
    });
}

export const getVacancyProcedure = protectedProcedure
  .input(vacancyIdInputSchema)
  .query(async ({ ctx, input }) => {
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session.user.id,
    );

    if (!userCompanyId) {
      return null;
    }

    if (isHhVacancyId(input.id)) {
      const hhVacancyId = input.id.slice(3);
      const hhAccount = await resolveUserHhAuth(ctx.db, ctx.session.user.id);

      if (!hhAccount?.accessToken) {
        return null;
      }

      try {
        // Fetch the full hh.uz detail in parallel with the slimmer "by id" payload (status,
        // responses, externalUrl) and the applicants list. The detail call gives us every
        // field the form needs (areaId, employmentId, scheduleId, experienceId,
        // professionalRoleId, vacancyTypeId, billingTypeId, salary range, descriptionHtml,
        // contact phone)
        // while `fetchHhVacancyById` still owns the canonical status/responses/externalUrl
        // mapping used elsewhere.
        const [hhVacancy, hhDetail, relatedCandidatesResult] =
          await Promise.all([
            fetchHhVacancyById(hhVacancyId, hhAccount.accessToken),
            fetchHhVacancyDetail(hhVacancyId, hhAccount.accessToken).catch(
              (error: unknown) => {
                console.error("Failed to fetch HH vacancy detail", {
                  hhVacancyId,
                  companyId: userCompanyId,
                  error,
                });
                return null;
              },
            ),
            fetchHhVacancyApplicants(hhVacancyId, hhAccount.accessToken).catch(
              (error: unknown) => {
                console.error("Failed to fetch HH vacancy applicants", {
                  hhVacancyId,
                  companyId: userCompanyId,
                  error,
                });
                return [] as {
                  id: string;
                  fullName: string;
                  status: string | null;
                }[];
              },
            ),
          ]);

        const merged = mapHhDetailToVacancyShape(hhDetail);

        return {
          id: input.id,
          title: hhVacancy.title,
          status: hhVacancy.status,
          responses: hhVacancy.responses,
          areaId: merged.areaId,
          employmentId: merged.employmentId,
          scheduleId: merged.scheduleId,
          experienceId: merged.experienceId,
          professionalRoleId: merged.professionalRoleId,
          vacancyTypeId: merged.vacancyTypeId,
          billingTypeId: merged.billingTypeId,
          salaryFrom: merged.salaryFrom,
          salaryTo: merged.salaryTo,
          salaryCurrency: merged.salaryCurrency,
          descriptionHtml: merged.descriptionHtml,
          contactPhone: merged.contactPhone,
          companyId: userCompanyId,
          hhVacancyId,
          hhDraftId: null,
          personHunterMeta: null,
          olxAdvertId: null,
          olxAdvertUrl: null,
          olxBrowserMeta: null,
          olxLastPublishedAt: null,
          olxLastError: null,
          telegramPostId: null,
          telegramFileId: null,
          publishedAt: hhVacancy.publishedAt,
          source: "hh.uz" as const,
          externalUrl: hhVacancy.externalUrl,
          relatedCandidates: relatedCandidatesResult,
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
          eq(vacancies.id, input.id),
          eq(vacancies.companyId, userCompanyId),
          await isUserVisibleOrWarehouseVacancy(
            ctx.db,
            input.id,
            userCompanyId,
          ),
        ),
      )
      .limit(1);

    const vacancy = rows[0];
    if (!vacancy) {
      return null;
    }
    return {
      ...vacancy,
      source: "local" as const,
    };
  });

/**
 * Loads the live PersonHunters representation of a publication so the publish form can be
 * re-populated when editing. Serves as a fallback for publications created before the
 * PersonHunters-specific fields were persisted locally (`personHunterMeta`), and reflects any
 * edits made directly on PersonHunters. Returns `null` when the publication isn't linked to
 * PersonHunters, the integration isn't configured, or the remote fetch fails — so the form
 * degrades gracefully to whatever local data it already has.
 */
export const getPersonHunterPublicationProcedure = protectedProcedure
  .input(vacancyIdInputSchema)
  .query(async ({ ctx, input }) => {
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session.user.id,
    );
    if (!userCompanyId) {
      return null;
    }

    const rows = await ctx.db
      .select({ personHunterVacancyId: vacancies.personHunterVacancyId })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.id, input.id),
          eq(vacancies.companyId, userCompanyId),
          isUserVisibleVacancy(),
        ),
      )
      .limit(1);

    const personHunterVacancyId = rows[0]?.personHunterVacancyId;
    if (!personHunterVacancyId || !isPersonHunterConfigured()) {
      return null;
    }

    try {
      const vacancy = await fetchPersonHunterVacancyById(
        personHunterVacancyId,
        {
          accessToken: getPersonHunterApiKey(),
        },
      );

      return {
        name: vacancy.name,
        description: vacancy.description,
        duties: vacancy.duties,
        requirements: vacancy.requirements,
        conditions: vacancy.conditions,
        industryId: vacancy.industry?.id ?? null,
        countryId: vacancy.country?.id ?? null,
        regionId: vacancy.region?.id ?? null,
        cityId: vacancy.city?.id ?? null,
        statusId: vacancy.status?.id ?? null,
        experienceFrom: vacancy.experienceFrom,
        experienceTo: vacancy.experienceTo,
        employmentIds: vacancy.employments.map((item) => item.id),
        scheduleIds: vacancy.schedules.map((item) => item.id),
        payFrom: vacancy.payFrom,
        payTo: vacancy.payTo,
      };
    } catch (error) {
      console.error("Failed to load PersonHunters vacancy for editing", {
        vacancyId: input.id,
        personHunterVacancyId,
        error,
      });
      // Returning null here used to render the edit form with empty fields,
      // which then overwrote the live PersonHunters vacancy with blanks on save.
      // A failed load must stop the user, not hand them a blank form.
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Не удалось загрузить вакансию с PersonHunters. Попробуйте позже.",
      });
    }
  });

/**
 * Pulls the hh.uz form-shape fields out of a {@link HhVacancyDetail} so callers can spread them
 * into a Vacancy response. Returns sensible empty defaults when `detail` is null (the hh.uz
 * call failed or the vacancy isn't linked).
 */
function mapHhDetailToVacancyShape(detail: HhVacancyDetail | null): {
  areaId: string;
  employmentId: string;
  scheduleId: string;
  experienceId: string;
  professionalRoleId: string;
  vacancyTypeId: string;
  billingTypeId: string;
  salaryFrom: number | undefined;
  salaryTo: number | undefined;
  salaryCurrency: "UZS" | "USD";
  descriptionHtml: string;
  contactPhone: string;
} {
  if (!detail) {
    return {
      areaId: "",
      employmentId: "",
      scheduleId: "",
      experienceId: "",
      professionalRoleId: "",
      vacancyTypeId: "open",
      billingTypeId: "",
      salaryFrom: undefined,
      salaryTo: undefined,
      salaryCurrency: "UZS",
      descriptionHtml: "",
      contactPhone: "",
    };
  }

  const phone = detail.contacts?.phones?.[0];
  const phoneParts = phone
    ? (phone.formatted ??
      [phone.country, phone.city, phone.number]
        .filter((part): part is string => Boolean(part))
        .join(" "))
    : "";

  return {
    areaId: detail.areaId ?? "",
    employmentId: detail.employmentId ?? "",
    scheduleId: detail.scheduleId ?? "",
    experienceId: detail.experienceId ?? "",
    professionalRoleId: detail.professionalRoleIds[0] ?? "",
    vacancyTypeId: detail.vacancyTypeId ?? "open",
    billingTypeId: detail.billingTypeId ?? "",
    salaryFrom: detail.salary?.from ?? undefined,
    salaryTo: detail.salary?.to ?? undefined,
    salaryCurrency: detail.salary?.currency === "USD" ? "USD" : "UZS",
    descriptionHtml: detail.descriptionHtml ?? "",
    contactPhone: phoneParts,
  };
}

export const getHhVacancyDetailProcedure = protectedProcedure
  .input(vacancyIdInputSchema)
  .query(async ({ ctx, input }) => {
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session.user.id,
    );

    if (!userCompanyId) {
      return null;
    }

    let hhVacancyId: string | null = null;

    if (isHhVacancyId(input.id)) {
      hhVacancyId = input.id.slice(3);
    } else {
      const rows = await ctx.db
        .select({ hhVacancyId: vacancies.hhVacancyId })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, input.id),
            eq(vacancies.companyId, userCompanyId),
            isUserVisibleVacancy(),
          ),
        )
        .limit(1);

      hhVacancyId = rows[0]?.hhVacancyId ?? null;
    }

    if (!hhVacancyId) {
      return null;
    }

    const hhAccount = await resolveUserHhAuth(ctx.db, ctx.session.user.id);
    if (!hhAccount?.accessToken) {
      return null;
    }

    try {
      const detail = await fetchHhVacancyDetail(
        hhVacancyId,
        hhAccount.accessToken,
      );
      return {
        ...detail,
        descriptionHtml: sanitizeHhDescriptionHtml(detail.descriptionHtml),
      };
    } catch (error) {
      console.error("Failed to fetch HH vacancy detail", {
        hhVacancyId,
        companyId: userCompanyId,
        error,
      });
      // `null` is reserved for "this vacancy has no hh.uz counterpart" (handled
      // above). A reachable-but-failing hh.uz is a real error, and collapsing it
      // into null made the page look like the vacancy did not exist.
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Не удалось загрузить вакансию с hh.uz. Попробуйте позже.",
      });
    }
  });

export const listVacancyPublicationsProcedure = protectedProcedure
  .input(vacancyPublicationListInputSchema)
  .query(async ({ ctx, input }) => {
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session.user.id,
    );

    if (!userCompanyId) {
      return [];
    }

    const conditions = [
      eq(vacancies.companyId, userCompanyId),
      eq(vacancies.isPublication, true),
      isUserVisibleVacancy(),
      eq(vacancies.parentId, input.parentVacancyId),
    ];

    const rows = await ctx.db
      .select({
        id: vacancies.id,
        parentId: vacancies.parentId,
        title: vacancies.title,
        status: vacancies.status,
        responses: vacancies.responses,
        areaId: vacancies.areaId,
        employmentId: vacancies.employmentId,
        scheduleId: vacancies.scheduleId,
        experienceId: vacancies.experienceId,
        professionalRoleId: vacancies.professionalRoleId,
        vacancyTypeId: vacancies.vacancyTypeId,
        billingTypeId: vacancies.billingTypeId,
        salaryFrom: vacancies.salaryFrom,
        salaryTo: vacancies.salaryTo,
        salaryCurrency: vacancies.salaryCurrency,
        descriptionHtml: vacancies.descriptionHtml,
        contactPhone: vacancies.contactPhone,
        isActive: vacancies.isActive,
        createdAt: vacancies.createdAt,
        destination: vacancies.destination,
        hhVacancyId: vacancies.hhVacancyId,
        hhDraftId: vacancies.hhDraftId,
        personHunterVacancyId: vacancies.personHunterVacancyId,
        personHunterUniqueCode: vacancies.personHunterUniqueCode,
        olxAdvertId: vacancies.olxAdvertId,
        olxAdvertUrl: vacancies.olxAdvertUrl,
        olxBrowserMeta: vacancies.olxBrowserMeta,
        telegramPostId: vacancies.telegramPostId,
      })
      .from(vacancies)
      .where(and(...conditions))
      .orderBy(desc(vacancies.createdAt));

    return rows;
  });

export const getPublicationTelegramPostsProcedure = protectedProcedure
  .input(z.object({ publicationId: z.string().min(1).max(255) }))
  .query(async ({ ctx, input }) => {
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session.user.id,
    );

    if (!userCompanyId) {
      return [];
    }

    // Confirm the publication belongs to the caller's company before exposing its posts.
    const owns = await ctx.db
      .select({ id: vacancies.id })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.id, input.publicationId),
          eq(vacancies.companyId, userCompanyId),
          isUserVisibleVacancy(),
        ),
      )
      .limit(1);

    if (!owns[0]) {
      return [];
    }

    return ctx.db
      .select({
        id: vacancyTelegramPosts.id,
        channelId: vacancyTelegramPosts.channelId,
        messageUrl: vacancyTelegramPosts.messageUrl,
        createdAt: vacancyTelegramPosts.createdAt,
      })
      .from(vacancyTelegramPosts)
      .where(eq(vacancyTelegramPosts.publicationId, input.publicationId));
  });

export const getVacancyFunnelProcedure = protectedProcedure
  .input(vacancyFunnelInputSchema)
  .query(async ({ ctx, input }) => {
    const locale = getRequestLocale(ctx.headers);
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session.user.id,
    );

    if (!userCompanyId) {
      return null;
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

    if (isHhVacancyId(input.id)) {
      const hhVacancyId = input.id.slice(3);
      const hhAccount = await resolveUserHhAuth(ctx.db, ctx.session.user.id);

      if (!hhAccount?.accessToken) {
        return null;
      }

      try {
        const hhVacancy = await fetchHhVacancyById(
          hhVacancyId,
          hhAccount.accessToken,
        );
        let hhAccessDenied = false;
        const relatedCandidates = await fetchHhVacancyApplicants(
          hhVacancyId,
          hhAccount.accessToken,
        ).catch((error: unknown) => {
          if (isHhAccessError(error)) {
            hhAccessDenied = true;
          }
          return [];
        });

        const normalizedCandidates = relatedCandidates.map((candidate) => ({
          id: candidate.id,
          fullName: candidate.fullName,
          status: candidate.status ?? "new",
          city: "",
          experience: "",
          matchScore: 0,
          matchAnalysis: "",
          aiAnalysis: "",
          currentPosition: "",
          currentCompany: "",
          contacts: {
            email: "",
            phone: "",
            telegram: "",
          },
          languages: [] as { name: string; level: string }[],
          relatedVacancies: [] as { id: string; title: string }[],
          resumeUrl: "",
          salaryCurrency: "UZS",
          salaryExpectation: 0,
          skills: [] as string[],
          source: "hh.uz",
          tags: [] as string[],
          matchedSkills: [] as string[],
          missingSkills: [] as string[],
        }));

        const stages = buildPaginatedFunnelStages(
          stageRows,
          normalizedCandidates,
          input,
        );

        return {
          id: input.id,
          title: hhVacancy.title,
          areaId: "",
          experienceId: "",
          source: "hh.uz" as const,
          hhAccessDenied,
          candidates: stages.flatMap((stage) => stage.candidates),
          stages,
        };
      } catch (error) {
        console.error("Failed to fetch HH vacancy funnel", {
          companyId: userCompanyId,
          error,
          hhVacancyId,
        });

        return null;
      }
    }

    const rows = await ctx.db
      .select({
        id: vacancies.id,
        title: vacancies.title,
        areaId: vacancies.areaId,
        experienceId: vacancies.experienceId,
      })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.id, input.id),
          eq(vacancies.companyId, userCompanyId),
          await isUserVisibleOrWarehouseVacancy(
            ctx.db,
            input.id,
            userCompanyId,
          ),
        ),
      )
      .limit(1);

    const vacancy = rows[0];
    if (!vacancy) {
      return null;
    }

    const funnelVacancyRows = await ctx.db
      .select({ id: vacancies.id, hhVacancyId: vacancies.hhVacancyId })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.parentId, input.id),
          eq(vacancies.companyId, userCompanyId),
          isUserVisibleVacancy(),
        ),
      );
    const funnelVacancyIds = funnelVacancyRows.map((row) => row.id);
    const scopedVacancyIds =
      funnelVacancyIds.length > 0 ? funnelVacancyIds : [vacancy.id];

    const candidateRows = await getVacanciesRelatedCandidates(
      ctx.db,
      scopedVacancyIds,
      userCompanyId,
    );
    const uniqueCandidateRows = [
      ...new Map(
        candidateRows.map((candidate) => [candidate.id, candidate]),
      ).values(),
    ];

    const normalizedCandidates = uniqueCandidateRows.map((candidate) => {
      const contacts = candidate.contacts ?? [];
      const phone = contacts.find((item) => item.type === "phone")?.value ?? "";
      const telegram =
        contacts.find((item) => item.type === "telegram")?.value ?? "";
      const email = contacts.find((item) => item.type === "email")?.value ?? "";
      const workExperience = candidate.workExperience ?? [];
      const currentWorkplace =
        workExperience.find((item) => item.isCurrent) ?? workExperience[0];

      return {
        id: candidate.id,
        fullName: candidate.fullName,
        status: candidate.status ?? "new",
        city: candidate.city ?? "",
        experience: formatExperienceMonths(candidate.experience),
        matchScore: candidate.matchScore ?? candidate.candidateMatchScore ?? 0,
        matchAnalysis: getLocalizedText(
          candidate.matchAnalysisTranslations,
          locale,
          candidate.matchAnalysis ?? "",
        ),
        aiAnalysis: getLocalizedText(
          candidate.aiAnalysisTranslations,
          locale,
          candidate.aiAnalysis ?? "",
        ),
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
        matchedSkills: getLocalizedStringList(
          candidate.matchedSkillsTranslations,
          locale,
          (candidate.matchedSkills ?? []) as string[],
        ),
        missingSkills: getLocalizedStringList(
          candidate.missingSkillsTranslations,
          locale,
          (candidate.missingSkills ?? []) as string[],
        ),
        source: candidate.source ?? "",
        // Quick preview always has something to open: the uploaded resume when
        // one exists, otherwise the profile rendered to PDF on the fly.
        resumeUrl: candidate.resumeFileId
          ? buildCandidateResumeUrl(candidate.id)
          : `/api/candidates/${candidate.id}/profile-export?format=pdf&template=custom&disposition=inline`,
        relatedVacancies: [] as { id: string; title: string }[],
      };
    });
    const paginatedStages = buildPaginatedFunnelStages(
      stageRows,
      normalizedCandidates,
      input,
    );
    const paginatedCandidates = paginatedStages.flatMap(
      (stage) => stage.candidates,
    );
    const relatedVacancyRows =
      paginatedCandidates.length > 0
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
                  paginatedCandidates.map((candidate) => candidate.id),
                ),
                eq(vacancies.companyId, userCompanyId),
                isUserVisibleVacancy(),
              ),
            )
            .orderBy(desc(candidateVacancies.id))
        : [];

    const relatedVacanciesByCandidate = new Map<
      string,
      { id: string; title: string }[]
    >();
    const scopedVacancyIdSet = new Set(scopedVacancyIds);

    for (const row of relatedVacancyRows) {
      if (scopedVacancyIdSet.has(row.vacancyId)) {
        continue;
      }

      const existing = relatedVacanciesByCandidate.get(row.candidateId) ?? [];
      existing.push({ id: row.vacancyId, title: row.title });
      relatedVacanciesByCandidate.set(row.candidateId, existing);
    }

    const stages = paginatedStages.map((stage) => ({
      ...stage,
      candidates: stage.candidates.map((candidate) => ({
        ...candidate,
        relatedVacancies: relatedVacanciesByCandidate.get(candidate.id) ?? [],
      })),
    }));

    // hh.uz applicants are persisted by the candidate sync, so they arrive via
    // `getVacanciesRelatedCandidates` like any other candidate — no live fetch.
    return {
      id: vacancy.id,
      title: vacancy.title,
      areaId: vacancy.areaId ?? "",
      experienceId: vacancy.experienceId ?? "",
      source: "local" as const,
      hhAccessDenied: false,
      candidates: stages.flatMap((stage) => stage.candidates),
      stages,
    };
  });
