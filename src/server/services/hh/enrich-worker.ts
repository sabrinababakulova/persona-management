import { and, eq, ne, sql } from "drizzle-orm";
import {
  formatHhCandidateForAiAnalysis,
  toStoredCandidateContacts,
} from "~/server/api/routers/candidates/shared";
import {
  candidates,
  candidateVacancies,
  hhEnrichmentJobs,
  vacancies,
} from "~/server/db/schema";
import { generateCandidateAiAnalysis } from "~/server/resume/generate-candidate-ai-analysis";
import { generateCandidateVacancyMatch } from "~/server/resume/generate-candidate-vacancy-match";
import {
  type CompanyHhAccount,
  resolveCompanyHhAccounts,
} from "~/server/services/hh-company-account";

import { fetchHhResumeById } from "./resumes";
import { type HhResumeCandidate, isHhAccessError } from "./shared";

type DatabaseClient = typeof import("~/server/db").db;

/** A job is abandoned to `failed` after this many tries. */
const MAX_ATTEMPTS = 5;
/** `processing` rows older than this are assumed crashed and re-queued. */
const STALE_LOCK_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 5;

export type DrainHhEnrichmentResult = {
  claimed: number;
  enriched: number;
  retried: number;
  failed: number;
};

/** Exponential backoff (minutes), capped, for a failed attempt. */
function backoffDate(attempts: number): Date {
  const minutes = Math.min(2 ** attempts, 60);
  return new Date(Date.now() + minutes * 60 * 1000);
}

type ClaimedJob = { id: string; candidateId: string; attempts: number };

/**
 * Drains a bounded batch of the hh.uz enrichment queue (Layer 2).
 *
 * Each job turns a discovery stub into a full candidate profile: it fetches the
 * structured hh.uz resume (no PDF) and, once, an AI analysis. Jobs are claimed
 * with `FOR UPDATE SKIP LOCKED` so multiple workers can run concurrently.
 */
export async function drainHhEnrichmentJobs(input: {
  db: DatabaseClient;
  batchSize?: number;
}): Promise<DrainHhEnrichmentResult> {
  const { db } = input;
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;

  // Reaper: return jobs abandoned by a crashed worker to the queue.
  await db.execute(sql`
    UPDATE "hh_enrichment_job" SET "status" = 'pending', "locked_at" = NULL
    WHERE "status" = 'processing'
      AND "locked_at" < now() - ${`${STALE_LOCK_MS} milliseconds`}::interval
  `);

  const claimedRows = (await db.execute(sql`
    UPDATE "hh_enrichment_job"
    SET "status" = 'processing', "locked_at" = now()
    WHERE "id" IN (
      SELECT "id" FROM "hh_enrichment_job"
      WHERE "status" = 'pending' AND "run_after" <= now()
      ORDER BY "run_after"
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    RETURNING "id", "candidate_id" AS "candidateId", "attempts"
  `)) as unknown as ClaimedJob[];

  const result: DrainHhEnrichmentResult = {
    claimed: claimedRows.length,
    enriched: 0,
    retried: 0,
    failed: 0,
  };

  // Resolve each company's connected hh.uz accounts at most once per drain.
  const accountsByCompany = new Map<string, CompanyHhAccount[]>();

  for (const job of claimedRows) {
    const outcome = await processJob(db, job, accountsByCompany);
    result[outcome] += 1;
  }

  return result;
}

async function processJob(
  db: DatabaseClient,
  job: ClaimedJob,
  accountsByCompany: Map<string, CompanyHhAccount[]>,
): Promise<"enriched" | "retried" | "failed"> {
  try {
    const candidateRows = await db
      .select({
        id: candidates.id,
        companyId: candidates.companyId,
        hhResumeId: candidates.hhResumeId,
        profileLocked: candidates.profileLocked,
        aiAnalysis: candidates.aiAnalysis,
      })
      .from(candidates)
      .where(eq(candidates.id, job.candidateId))
      .limit(1);

    const candidate = candidateRows[0];
    if (!candidate?.hhResumeId || !candidate.companyId) {
      // Nothing to enrich (deleted, or no resume id) — terminal.
      return finishJob(db, job, "failed", "Candidate has no hh.uz resume id");
    }

    if (!accountsByCompany.has(candidate.companyId)) {
      accountsByCompany.set(
        candidate.companyId,
        await resolveCompanyHhAccounts(db, candidate.companyId),
      );
    }
    const accounts = accountsByCompany.get(candidate.companyId) ?? [];
    if (accounts.length === 0) {
      // hh.uz disconnected — retry later, this is not the candidate's fault.
      return retryJob(db, job, "hh.uz account is not connected");
    }

    // A resume is only readable by the employer whose vacancy the candidate
    // applied to. With several employers connected, try each until one can
    // read it; an access error just means "wrong employer", so move on.
    let resume: HhResumeCandidate | null = null;
    for (const account of accounts) {
      try {
        resume = await fetchHhResumeById(
          candidate.hhResumeId,
          account.accessToken,
        );
        break;
      } catch (error) {
        if (isHhAccessError(error)) {
          continue;
        }
        throw error;
      }
    }
    if (!resume) {
      return finishJob(
        db,
        job,
        "failed",
        "No connected hh.uz account can access this resume",
      );
    }

    const profileUpdate = candidate.profileLocked
      ? {}
      : {
          fullName: resume.fullName,
          city: resume.city || null,
          salaryExpectation:
            resume.salaryExpectation > 0 ? resume.salaryExpectation : null,
          salaryCurrency: resume.salaryCurrency,
          currentPosition: resume.currentPosition || null,
          experience: resume.experience || null,
          skills: resume.skills,
          languages: resume.languages,
          contacts: toStoredCandidateContacts(resume),
          workExperience: resume.workExperience,
          education: resume.education,
        };

    let aiAnalysis = candidate.aiAnalysis?.trim() ?? "";
    let aiErrorMessage: string | null = null;
    if (!aiAnalysis) {
      const analysis = await generateCandidateAiAnalysis(
        {
          resumeText: formatHhCandidateForAiAnalysis(resume),
          sourceLabel: "резюме hh.uz",
        },
        {
          db,
          userId: undefined,
          companyId: candidate.companyId,
          candidateId: candidate.id,
          operation: "hh_candidate_resume_ai_analysis",
        },
      );
      if (analysis.status === "success") {
        aiAnalysis = analysis.text;
      } else {
        aiErrorMessage =
          analysis.errorMessage || "Failed to generate candidate AI analysis";
      }
    }

    await db
      .update(candidates)
      .set({
        ...profileUpdate,
        hhResumeUrl: resume.resumeUrl || null,
        hhResumeFetchedAt: new Date(),
        hhSyncedAt: new Date(),
        ...(aiAnalysis ? { aiAnalysis } : {}),
      })
      .where(eq(candidates.id, candidate.id));

    // Match scoring runs alongside AI analysis — it shares the same source data
    // (the parsed hh.uz resume) and the same observability surface. Archived
    // vacancies are intentionally skipped via the `vacancies.status` filter so
    // we never spend tokens on a stub the recruiter has already retired.
    await computeMatchScores({
      db,
      candidateId: candidate.id,
      companyId: candidate.companyId,
      resume,
    });

    if (aiErrorMessage) {
      return retryJob(db, job, aiErrorMessage);
    }

    return finishJob(db, job, "done", null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown enrichment error";

    // A deleted/forbidden resume will never succeed — fail it fast.
    if (isHhAccessError(error)) {
      return finishJob(db, job, "failed", message);
    }
    return retryJob(db, job, message);
  }
}

async function retryJob(
  db: DatabaseClient,
  job: ClaimedJob,
  message: string,
): Promise<"retried" | "failed"> {
  const attempts = job.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await finishJob(db, job, "failed", message);
    return "failed";
  }

  await db
    .update(hhEnrichmentJobs)
    .set({
      status: "pending",
      attempts,
      runAfter: backoffDate(attempts),
      lockedAt: null,
      lastError: message,
    })
    .where(eq(hhEnrichmentJobs.id, job.id));

  return "retried";
}

/**
 * Scores the candidate against every non-archived vacancy they have applied
 * to and persists each score on `candidateVacancies.matchScore`. The maximum
 * across the candidate's active applications is also mirrored onto
 * `candidates.matchScore` so the candidate-detail card (which has no vacancy
 * context) has a sensible default value to render.
 *
 * Failures for one (candidate, vacancy) pair never abort the others — the
 * enrichment job has already done its expensive work (resume + AI summary) so
 * we degrade gracefully and let the next sync run retry the gaps.
 */
async function computeMatchScores(input: {
  db: DatabaseClient;
  candidateId: string;
  companyId: string;
  resume: HhResumeCandidate;
}): Promise<void> {
  const { db, candidateId, companyId, resume } = input;

  const pairs = await db
    .select({
      applicationId: candidateVacancies.id,
      vacancyId: vacancies.id,
      title: vacancies.title,
      descriptionHtml: vacancies.descriptionHtml,
      areaId: vacancies.areaId,
      employmentId: vacancies.employmentId,
      scheduleId: vacancies.scheduleId,
      experienceId: vacancies.experienceId,
      professionalRoleId: vacancies.professionalRoleId,
      vacancyTypeId: vacancies.vacancyTypeId,
      salaryFrom: vacancies.salaryFrom,
      salaryTo: vacancies.salaryTo,
      salaryCurrency: vacancies.salaryCurrency,
    })
    .from(candidateVacancies)
    .innerJoin(vacancies, eq(candidateVacancies.vacancyId, vacancies.id))
    .where(
      and(
        eq(candidateVacancies.candidateId, candidateId),
        eq(vacancies.companyId, companyId),
        // Archived vacancies are intentionally excluded — recruiter retired them.
        ne(vacancies.status, "archive"),
      ),
    );

  if (pairs.length === 0) {
    return;
  }

  const candidatePayload = {
    fullName: resume.fullName,
    city: resume.city,
    experience: resume.experience,
    currentPosition: resume.currentPosition,
    skills: resume.skills,
    languages: resume.languages,
    workExperience: resume.workExperience,
    education: resume.education,
    salaryExpectation:
      resume.salaryExpectation > 0 ? resume.salaryExpectation : null,
    salaryCurrency: resume.salaryCurrency,
  };

  let bestScore: number | null = null;

  for (const pair of pairs) {
    const matchResult = await generateCandidateVacancyMatch(
      {
        vacancy: {
          title: pair.title,
          descriptionHtml: pair.descriptionHtml,
          areaId: pair.areaId,
          employmentId: pair.employmentId,
          scheduleId: pair.scheduleId,
          experienceId: pair.experienceId,
          professionalRoleId: pair.professionalRoleId,
          vacancyTypeId: pair.vacancyTypeId,
          salaryFrom: pair.salaryFrom,
          salaryTo: pair.salaryTo,
          salaryCurrency: pair.salaryCurrency,
        },
        candidate: candidatePayload,
      },
      {
        db,
        companyId,
        candidateId,
        operation: "hh_candidate_vacancy_match",
      },
    );

    if (matchResult.status !== "success") {
      console.error("Candidate-vacancy match failed", {
        candidateId,
        vacancyId: pair.vacancyId,
        errorMessage: matchResult.errorMessage,
      });
      continue;
    }

    await db
      .update(candidateVacancies)
      .set({ matchScore: matchResult.score })
      .where(eq(candidateVacancies.id, pair.applicationId));

    if (bestScore === null || matchResult.score > bestScore) {
      bestScore = matchResult.score;
    }
  }

  if (bestScore !== null) {
    await db
      .update(candidates)
      .set({ matchScore: bestScore })
      .where(eq(candidates.id, candidateId));
  }
}

async function finishJob(
  db: DatabaseClient,
  job: ClaimedJob,
  status: "done" | "failed",
  message: string | null,
): Promise<"enriched" | "failed"> {
  await db
    .update(hhEnrichmentJobs)
    .set({
      status,
      attempts: job.attempts + 1,
      lockedAt: null,
      lastError: message,
    })
    .where(eq(hhEnrichmentJobs.id, job.id));

  return status === "done" ? "enriched" : "failed";
}
