import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import {
  buildActivityPreview,
  writeRecentActivityLog,
} from "~/server/activity/recent-activity";
import {
  getOptionalCompanyId,
  getRequiredCompanyId,
} from "~/server/api/router-utils/company";
import { protectedProcedure } from "~/server/api/trpc";
import { candidates, companyHhAccounts } from "~/server/db/schema";
import { generateCandidateAiAnalysis } from "~/server/resume/generate-candidate-ai-analysis";
import {
  fetchHhResumeById,
  isHhConfigured,
  refreshHhAccessToken,
} from "~/server/services/hh";

import { candidateIdInputSchema, candidateNoteInputSchema } from "./schemas";
import {
  buildCandidateDetailResponse,
  formatHhCandidateForAiAnalysis,
  getStoredCandidateRecord,
  toStoredCandidateContacts,
} from "./shared";

export const getCandidateProcedure = protectedProcedure
  .input(candidateIdInputSchema)
  .query(async ({ ctx, input }) => {
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session.user.id,
    );
    if (!userCompanyId) {
      return null;
    }

    const storedCandidate = await getStoredCandidateRecord(
      ctx.db,
      userCompanyId,
      input.id,
    );

    if (input.id.startsWith("hh_")) {
      const resumeId = input.id.slice(3);

      const hhAccountRows = await ctx.db
        .select({
          id: companyHhAccounts.id,
          accessToken: companyHhAccounts.accessToken,
          refreshToken: companyHhAccounts.refreshToken,
        })
        .from(companyHhAccounts)
        .where(eq(companyHhAccounts.companyId, userCompanyId))
        .limit(1);

      const hhAccount = hhAccountRows[0];
      let accessToken = hhAccount?.accessToken ?? undefined;
      const refreshToken = hhAccount?.refreshToken ?? undefined;

      if (!accessToken && refreshToken && isHhConfigured() && hhAccount?.id) {
        try {
          const refreshed = await refreshHhAccessToken(refreshToken);
          accessToken = refreshed.accessToken;
          await ctx.db
            .update(companyHhAccounts)
            .set({
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
            })
            .where(eq(companyHhAccounts.id, hhAccount.id));
        } catch (error) {
          console.error("Failed to refresh HH token for candidate fetch", {
            error,
          });
        }
      }

      if (!accessToken) {
        return storedCandidate
          ? buildCandidateDetailResponse({
              db: ctx.db,
              companyId: userCompanyId,
              candidate: storedCandidate,
            })
          : null;
      }

      try {
        const hhCandidate = await fetchHhResumeById(resumeId, accessToken);
        let aiAnalysis = storedCandidate?.aiAnalysis?.trim() ?? "";

        if (!aiAnalysis) {
          const aiAnalysisResult = await generateCandidateAiAnalysis({
            resumeText: formatHhCandidateForAiAnalysis(hhCandidate),
            sourceLabel: "резюме hh.uz",
          });

          if (aiAnalysisResult.status === "success") {
            aiAnalysis = aiAnalysisResult.text;
          }
        }

        const importedCandidate = {
          id: input.id,
          fullName: hhCandidate.fullName,
          city: hhCandidate.city || null,
          salaryExpectation:
            hhCandidate.salaryExpectation > 0
              ? hhCandidate.salaryExpectation
              : null,
          salaryCurrency: hhCandidate.salaryCurrency,
          currentPosition: hhCandidate.currentPosition || null,
          source: "hh.uz",
          status: storedCandidate?.status ?? "new",
          resumeFileId: storedCandidate?.resumeFileId ?? null,
          resumeFileName: storedCandidate?.resumeFileName ?? null,
          resumeFileSize: storedCandidate?.resumeFileSize ?? null,
          experience: hhCandidate.experience || null,
          matchScore: storedCandidate?.matchScore ?? null,
          aiAnalysis: aiAnalysis || null,
          contacts: toStoredCandidateContacts(hhCandidate),
          skills: hhCandidate.skills,
          languages: hhCandidate.languages,
          tags: storedCandidate?.tags ?? [],
          workExperience: hhCandidate.workExperience,
          education: hhCandidate.education,
          notes: storedCandidate?.notes ?? [],
          companyId: userCompanyId,
        };
        const { id, ...set } = importedCandidate;

        await ctx.db
          .insert(candidates)
          .values(importedCandidate)
          .onConflictDoUpdate({
            target: candidates.id,
            set,
          });

        const persistedCandidate = await getStoredCandidateRecord(
          ctx.db,
          userCompanyId,
          input.id,
        );

        if (!persistedCandidate) {
          return null;
        }

        return buildCandidateDetailResponse({
          db: ctx.db,
          companyId: userCompanyId,
          candidate: persistedCandidate,
          resumeNameOverride: "Резюме на hh.uz",
          resumeUrlOverride: hhCandidate.resumeUrl,
        });
      } catch (error) {
        console.error("Failed to fetch HH resume for candidate page", {
          resumeId,
          companyId: userCompanyId,
          error,
        });
        return storedCandidate
          ? buildCandidateDetailResponse({
              db: ctx.db,
              companyId: userCompanyId,
              candidate: storedCandidate,
            })
          : null;
      }
    }

    if (!storedCandidate) {
      return null;
    }

    return buildCandidateDetailResponse({
      db: ctx.db,
      companyId: userCompanyId,
      candidate: storedCandidate,
    });
  });

export const addCandidateNoteProcedure = protectedProcedure
  .input(candidateNoteInputSchema)
  .mutation(async ({ ctx, input }) => {
    const userCompanyId = await getRequiredCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    const candidateRows = await ctx.db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        companyId: candidates.companyId,
        notes: candidates.notes,
      })
      .from(candidates)
      .where(
        and(
          eq(candidates.id, input.candidateId),
          eq(candidates.companyId, userCompanyId),
        ),
      )
      .limit(1);

    const candidate = candidateRows[0];
    if (!candidate) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Кандидат не найден",
      });
    }

    const authorName =
      ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";
    const newNote = {
      id: crypto.randomUUID(),
      content: input.content,
      author: authorName,
      createdAt: new Date().toISOString(),
    };
    const existingNotes = (candidate.notes ?? []) as {
      id: string;
      content: string;
      author: string;
      createdAt: string;
    }[];
    const updatedNotes = [newNote, ...existingNotes];

    await ctx.db
      .update(candidates)
      .set({
        notes: updatedNotes,
      })
      .where(
        and(
          eq(candidates.id, input.candidateId),
          eq(candidates.companyId, userCompanyId),
        ),
      );

    await writeRecentActivityLog(ctx.db, {
      entityType: "candidate",
      entityId: input.candidateId,
      companyId: userCompanyId,
      actorUserId: ctx.session?.user?.id ?? null,
      actorName: authorName,
      action: "Сохранил(а) заметку",
      targetName: candidate.fullName,
      targetStatus: buildActivityPreview(input.content),
    });

    return newNote;
  });
