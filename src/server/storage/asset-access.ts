import { and, eq } from "drizzle-orm";

import { candidates, companies, users, vacancies } from "~/server/db/schema";

type DatabaseClient = typeof import("~/server/db").db;

/**
 * Whether `fileId` is an asset the signed-in user is allowed to fetch through the proxy.
 *
 * The proxy streams files using the server's static Directus token, which can read every asset
 * in the instance — so the id alone must never be the authorization. A file qualifies when it
 * is referenced by a row the caller can already see:
 *
 * - their own avatar (an account without a company still has one),
 * - a colleague's avatar, or their company's logo,
 * - a publication image on one of their company's vacancies.
 *
 * Candidate resumes are deliberately absent: they are served by
 * `/api/candidates/[candidateId]/resume`, which applies its own company scoping and, for
 * hh.uz-sourced rows, streams from hh.uz instead. Matching them here as well is a cheap extra
 * guard against a resume id being pasted into an `<img>`.
 */
export async function canUserReadDirectusAsset(
  db: DatabaseClient,
  input: { userId: string; companyId: string | null; fileId: string },
): Promise<boolean> {
  const { userId, companyId, fileId } = input;

  const [ownAvatar] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.avatarFileId, fileId)))
    .limit(1);

  if (ownAvatar) {
    return true;
  }

  if (!companyId) {
    return false;
  }

  const [colleagueAvatar] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.avatarFileId, fileId)))
    .limit(1);

  if (colleagueAvatar) {
    return true;
  }

  const [companyLogo] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.logoFileId, fileId)))
    .limit(1);

  if (companyLogo) {
    return true;
  }

  const [vacancyAsset] = await db
    .select({ id: vacancies.id })
    .from(vacancies)
    .where(
      and(
        eq(vacancies.companyId, companyId),
        eq(vacancies.telegramFileId, fileId),
      ),
    )
    .limit(1);

  if (vacancyAsset) {
    return true;
  }

  const [candidateAsset] = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(
      and(
        eq(candidates.companyId, companyId),
        eq(candidates.resumeFileId, fileId),
      ),
    )
    .limit(1);

  return Boolean(candidateAsset);
}
