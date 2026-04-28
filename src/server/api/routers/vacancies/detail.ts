import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getOptionalCompanyId } from "~/server/api/router-utils/company";
import { protectedProcedure } from "~/server/api/trpc";
import {
  candidateStatusOptions,
  candidateVacancies,
  vacancies,
  vacancyPublications,
} from "~/server/db/schema";
import {
  fetchHhVacancyApplicants,
  fetchHhVacancyById,
} from "~/server/services/hh";
import { resolveCompanyHhAuth } from "~/server/services/hh-company-account";
import { buildCandidateResumeUrl } from "~/server/storage/resume-storage";

import {
  vacancyIdInputSchema,
  vacancyPublicationListInputSchema,
} from "./schemas";
import {
  formatVacancy,
  formatVacancyPublication,
  getVacancyRelatedCandidates,
  isHhVacancyId,
} from "./shared";

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
      const hhAccount = await resolveCompanyHhAuth(ctx.db, userCompanyId);

      if (!hhAccount?.accessToken) {
        return null;
      }

      try {
        const hhVacancy = await fetchHhVacancyById(
          hhVacancyId,
          hhAccount.accessToken,
        );

        let relatedCandidates: {
          id: string;
          fullName: string;
          status: string | null;
        }[] = [];

        try {
          relatedCandidates = await fetchHhVacancyApplicants(
            hhVacancyId,
            hhAccount.accessToken,
          );
        } catch (error) {
          console.error("Failed to fetch HH vacancy applicants", {
            hhVacancyId,
            companyId: userCompanyId,
            error,
          });
        }

        return {
          id: input.id,
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
          companyId: userCompanyId,
          publishedAt: hhVacancy.publishedAt,
          source: "hh.uz" as const,
          externalUrl: hhVacancy.externalUrl,
          publications: [],
          relatedCandidates,
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
        and(eq(vacancies.id, input.id), eq(vacancies.companyId, userCompanyId)),
      )
      .limit(1);

    const vacancy = rows[0];
    if (!vacancy) {
      return null;
    }

    const [relatedCandidateRows, publicationRows] = await Promise.all([
      getVacancyRelatedCandidates(ctx.db, vacancy.id, userCompanyId),
      ctx.db
        .select({
          id: vacancyPublications.id,
          vacancyId: vacancyPublications.vacancyId,
          name: vacancyPublications.name,
          description: vacancyPublications.description,
          isActive: vacancyPublications.isActive,
          sources: vacancyPublications.sources,
          createdAt: vacancyPublications.createdAt,
          updatedAt: vacancyPublications.updatedAt,
        })
        .from(vacancyPublications)
        .where(eq(vacancyPublications.vacancyId, vacancy.id))
        .orderBy(desc(vacancyPublications.createdAt)),
    ]);

    return {
      ...formatVacancy(vacancy, relatedCandidateRows.length),
      publications: publicationRows.map(formatVacancyPublication),
      relatedCandidates: relatedCandidateRows,
    };
  });

export const listVacancyPublicationsProcedure = protectedProcedure
  .input(vacancyPublicationListInputSchema)
  .query(async ({ ctx, input }) => {
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session.user.id,
    );

    if (!userCompanyId || isHhVacancyId(input.vacancyId)) {
      return [];
    }

    const conditions = [
      eq(vacancyPublications.vacancyId, input.vacancyId),
      eq(vacancies.companyId, userCompanyId),
    ];

    if (input.activeOnly) {
      conditions.push(eq(vacancyPublications.isActive, true));
    }

    const rows = await ctx.db
      .select({
        id: vacancyPublications.id,
        vacancyId: vacancyPublications.vacancyId,
        name: vacancyPublications.name,
        description: vacancyPublications.description,
        isActive: vacancyPublications.isActive,
        sources: vacancyPublications.sources,
        createdAt: vacancyPublications.createdAt,
        updatedAt: vacancyPublications.updatedAt,
      })
      .from(vacancyPublications)
      .innerJoin(vacancies, eq(vacancyPublications.vacancyId, vacancies.id))
      .where(and(...conditions))
      .orderBy(desc(vacancyPublications.createdAt));

    return rows.map(formatVacancyPublication);
  });

export const getVacancyPublicationProcedure = protectedProcedure
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
      .select({
        id: vacancyPublications.id,
        vacancyId: vacancyPublications.vacancyId,
        name: vacancyPublications.name,
        description: vacancyPublications.description,
        isActive: vacancyPublications.isActive,
        sources: vacancyPublications.sources,
        createdAt: vacancyPublications.createdAt,
        updatedAt: vacancyPublications.updatedAt,
      })
      .from(vacancyPublications)
      .innerJoin(vacancies, eq(vacancyPublications.vacancyId, vacancies.id))
      .where(
        and(
          eq(vacancyPublications.id, input.id),
          eq(vacancies.companyId, userCompanyId),
        ),
      )
      .limit(1);

    const publication = rows[0];
    return publication ? formatVacancyPublication(publication) : null;
  });

export const getVacancyFunnelProcedure = protectedProcedure
  .input(vacancyIdInputSchema)
  .query(async ({ ctx, input }) => {
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
      const hhAccount = await resolveCompanyHhAuth(ctx.db, userCompanyId);

      if (!hhAccount?.accessToken) {
        return null;
      }

      try {
        const hhVacancy = await fetchHhVacancyById(
          hhVacancyId,
          hhAccount.accessToken,
        );
        const relatedCandidates = await fetchHhVacancyApplicants(
          hhVacancyId,
          hhAccount.accessToken,
        ).catch(() => []);

        const normalizedCandidates = relatedCandidates.map((candidate) => ({
          id: candidate.id,
          fullName: candidate.fullName,
          status: candidate.status ?? "Без статуса",
          city: "",
          experience: "",
          matchScore: 0,
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
        }));

        return {
          id: input.id,
          title: hhVacancy.title,
          level: hhVacancy.level ?? "",
          city: hhVacancy.city ?? "",
          source: "hh.uz" as const,
          candidates: normalizedCandidates,
          stages: stageRows.map((stage) => ({
            value: stage.value,
            label: stage.label,
            candidates: normalizedCandidates.filter(
              (candidate) => candidate.status === stage.value,
            ),
          })),
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
        level: vacancies.level,
        city: vacancies.city,
      })
      .from(vacancies)
      .where(
        and(eq(vacancies.id, input.id), eq(vacancies.companyId, userCompanyId)),
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

    const normalizedCandidates = candidateRows.map((candidate) => {
      const contacts =
        ((candidate.contacts ?? []) as { type: string; value: string }[]) ?? [];
      const phone = contacts.find((item) => item.type === "phone")?.value ?? "";
      const telegram =
        contacts.find((item) => item.type === "telegram")?.value ?? "";
      const email = contacts.find((item) => item.type === "email")?.value ?? "";
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
      source: "local" as const,
      candidates: normalizedCandidates,
      stages: stageRows.map((stage) => ({
        value: stage.value,
        label: stage.label,
        candidates: normalizedCandidates.filter(
          (candidate) => candidate.status === stage.value,
        ),
      })),
    };
  });
