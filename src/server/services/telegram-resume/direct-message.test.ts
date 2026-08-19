import { describe, expect, test } from "bun:test";

import { generateVacancyKeyword } from "~/utils/generate-vacancy-keyword";

import {
  extractTelegramVacancyKeywordCandidates,
  resolveTelegramPublicationKeywordTarget,
} from "./direct-message";

describe("Telegram vacancy keyword extraction", () => {
  test("finds keyword-shaped tokens anywhere in a document caption", () => {
    expect(
      extractTelegramVacancyKeywordCandidates(
        "Отклик на вакансию. Код: A1b2C3d4. Резюме во вложении.",
      ),
    ).toEqual(["a1b2c3d4"]);
  });

  test("preserves all-numeric keywords and removes duplicates", () => {
    expect(
      extractTelegramVacancyKeywordCandidates("12345678 и снова 12345678"),
    ).toEqual(["12345678"]);
  });

  test("does not extract a token embedded in a longer hexadecimal value", () => {
    expect(
      extractTelegramVacancyKeywordCandidates("префикс aa1b2c3d4ff суффикс"),
    ).toEqual([]);
  });

  test("returns no candidates for an empty caption", () => {
    expect(extractTelegramVacancyKeywordCandidates(undefined)).toEqual([]);
  });
});

describe("Telegram publication keyword routing", () => {
  const publication = {
    id: "publication-id",
    parentId: "base-vacancy-id",
    companyId: "company-id",
  };
  const keyword = generateVacancyKeyword(publication.id, publication.companyId);

  test("resolves a recognized publication keyword to its base vacancy", () => {
    expect(
      resolveTelegramPublicationKeywordTarget({
        companyIds: ["company-id"],
        keywordCandidates: [keyword],
        publications: [publication],
      }),
    ).toEqual({
      outcome: "resolved",
      companyId: "company-id",
      vacancyId: "base-vacancy-id",
    });
  });

  test("does not authorize a keyword owned by another company", () => {
    expect(
      resolveTelegramPublicationKeywordTarget({
        companyIds: ["different-company"],
        keywordCandidates: [keyword],
        publications: [publication],
      }),
    ).toEqual({ outcome: "no_match" });
  });

  test("rejects captions that resolve to more than one vacancy", () => {
    const second = {
      id: "second-publication",
      parentId: "second-base-vacancy",
      companyId: "company-id",
    };
    expect(
      resolveTelegramPublicationKeywordTarget({
        companyIds: ["company-id"],
        keywordCandidates: [
          keyword,
          generateVacancyKeyword(second.id, second.companyId),
        ],
        publications: [publication, second],
      }),
    ).toEqual({ outcome: "ambiguous" });
  });
});
