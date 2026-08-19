import { and, eq, inArray } from "drizzle-orm";

import { getCompanyTelegramResumeWarehouse } from "~/server/company/telegram-resume-warehouse";
import {
  telegramChannelAdmins,
  userTelegramChannels,
  vacancies,
} from "~/server/db/schema";
import { generateVacancyKeyword } from "~/utils/generate-vacancy-keyword";

type DatabaseClient = typeof import("~/server/db").db;

export type TelegramDirectResumeTargetResult =
  | {
      outcome: "resolved";
      companyId: string;
      vacancyId: string;
      destination: "warehouse" | "vacancy";
    }
  | {
      outcome:
        | "admin_not_linked"
        | "ambiguous_company"
        | "ambiguous_keyword"
        | "warehouse_missing";
    };

/**
 * Vacancy publication keywords are eight lowercase SHA-256 hex characters.
 * We collect every keyword-shaped token and verify it against the sender's
 * companies later, so phone numbers and salary amounts do not route a resume
 * unless they actually equal a published vacancy keyword.
 */
export function extractTelegramVacancyKeywordCandidates(
  caption: string | null | undefined,
): string[] {
  const tokens = caption?.match(/(?<![a-f0-9])[a-f0-9]{8}(?![a-f0-9])/gi) ?? [];
  return [...new Set(tokens.map((token) => token.toLowerCase()))];
}

export type TelegramPublicationKeywordSource = {
  id: string;
  parentId: string;
  companyId: string | null;
};

export type TelegramPublicationKeywordTarget =
  | { outcome: "no_match" }
  | { outcome: "ambiguous" }
  | {
      outcome: "resolved";
      companyId: string;
      vacancyId: string;
    };

export function resolveTelegramPublicationKeywordTarget(input: {
  companyIds: string[];
  keywordCandidates: string[];
  publications: TelegramPublicationKeywordSource[];
}): TelegramPublicationKeywordTarget {
  const allowedCompanies = new Set(input.companyIds);
  const candidateKeywords = new Set(
    input.keywordCandidates.map((keyword) => keyword.toLowerCase()),
  );
  const targets = new Map<string, { companyId: string; vacancyId: string }>();

  for (const publication of input.publications) {
    if (
      !publication.companyId ||
      !allowedCompanies.has(publication.companyId)
    ) {
      continue;
    }
    const keyword = generateVacancyKeyword(
      publication.id,
      publication.companyId,
    );
    if (!candidateKeywords.has(keyword)) {
      continue;
    }
    const key = `${publication.companyId}:${publication.parentId}`;
    targets.set(key, {
      companyId: publication.companyId,
      vacancyId: publication.parentId,
    });
  }

  if (targets.size > 1) {
    return { outcome: "ambiguous" };
  }

  const target = [...targets.values()][0];
  return target ? { outcome: "resolved", ...target } : { outcome: "no_match" };
}

async function getAdminCompanyIds(
  db: DatabaseClient,
  telegramUserId: string,
): Promise<string[]> {
  const rows = await db
    .select({ companyId: userTelegramChannels.companyId })
    .from(telegramChannelAdmins)
    .innerJoin(
      userTelegramChannels,
      eq(telegramChannelAdmins.channelId, userTelegramChannels.id),
    )
    .where(eq(telegramChannelAdmins.telegramUserId, telegramUserId));

  return [...new Set(rows.map((row) => row.companyId))];
}

/**
 * Resolves a private bot upload without ever trusting a company/vacancy id
 * supplied by Telegram. The activated channel-admin relation is the tenant
 * boundary. A recognized publication keyword selects its parent/base vacancy;
 * otherwise an unambiguous admin is routed to their company's warehouse.
 */
export async function resolveTelegramDirectResumeTarget(input: {
  db: DatabaseClient;
  telegramUserId: string;
  caption?: string | null;
}): Promise<TelegramDirectResumeTargetResult> {
  const companyIds = await getAdminCompanyIds(input.db, input.telegramUserId);
  if (companyIds.length === 0) {
    return { outcome: "admin_not_linked" };
  }

  const keywordCandidates = extractTelegramVacancyKeywordCandidates(
    input.caption,
  );
  if (keywordCandidates.length > 0) {
    const publicationRows = await input.db
      .select({
        id: vacancies.id,
        parentId: vacancies.parentId,
        companyId: vacancies.companyId,
      })
      .from(vacancies)
      .where(
        and(
          inArray(vacancies.companyId, companyIds),
          eq(vacancies.isPublication, true),
          eq(vacancies.destination, "telegram"),
        ),
      );

    const keywordTarget = resolveTelegramPublicationKeywordTarget({
      companyIds,
      keywordCandidates,
      publications: publicationRows,
    });
    if (keywordTarget.outcome === "ambiguous") {
      return { outcome: "ambiguous_keyword" };
    }

    if (keywordTarget.outcome === "resolved") {
      const [baseVacancy] = await input.db
        .select({ id: vacancies.id })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, keywordTarget.vacancyId),
            eq(vacancies.companyId, keywordTarget.companyId),
            eq(vacancies.isPublication, false),
            eq(vacancies.isInternal, false),
          ),
        )
        .limit(1);

      if (baseVacancy) {
        return {
          outcome: "resolved",
          companyId: keywordTarget.companyId,
          vacancyId: baseVacancy.id,
          destination: "vacancy",
        };
      }
    }
  }

  if (companyIds.length !== 1) {
    return { outcome: "ambiguous_company" };
  }

  const companyId = companyIds[0];
  if (!companyId) {
    return { outcome: "admin_not_linked" };
  }
  const warehouse = await getCompanyTelegramResumeWarehouse(
    input.db,
    companyId,
  );
  if (!warehouse) {
    return { outcome: "warehouse_missing" };
  }

  return {
    outcome: "resolved",
    companyId,
    vacancyId: warehouse.id,
    destination: "warehouse",
  };
}
