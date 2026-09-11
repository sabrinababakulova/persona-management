import type { QuickAddCandidatePayload } from "~/types/components/quick-add-candidate-modal";
import type { RouterInputs } from "~/types/trpc/router-inputs";
import {
  RESUME_NOT_SPECIFIED_PLACEHOLDER,
  toCandidateSaveSafeResumePrefillData,
} from "~/utils/resume-prefill-helpers";

type CandidateCreateInput = RouterInputs["candidates"]["create"];

type BuildQuickCandidateCreateInputOptions = {
  defaultStatus?: string;
  fallbackCity: string;
  payload: QuickAddCandidatePayload;
};

/**
 * Converts the compact modal payload into the same complete candidate record
 * shape used by the full creation form.
 */
export function buildQuickCandidateCreateInput({
  defaultStatus,
  fallbackCity,
  payload,
}: BuildQuickCandidateCreateInputOptions): CandidateCreateInput {
  const prefill = payload.resumePrefillData
    ? toCandidateSaveSafeResumePrefillData(payload.resumePrefillData)
    : undefined;
  const directContacts: { type: string; value: string }[] = [];

  if (payload.email.trim()) {
    directContacts.push({
      type: "email",
      value: payload.email.trim().slice(0, 255),
    });
  }
  if (payload.contactValue.trim()) {
    directContacts.push({
      type: payload.contactType.trim().slice(0, 50),
      value: payload.contactValue.trim().slice(0, 255),
    });
  }

  // The visible email field is authoritative. Preserve every other contact
  // extracted from the résumé and remove exact duplicates.
  const parsedContacts = (prefill?.contacts ?? []).filter(
    (contact) => contact.type.trim().toLowerCase() !== "email",
  );
  const contacts: { type: string; value: string }[] = [];

  for (const parsedContact of [...directContacts, ...parsedContacts]) {
    const normalizedContact = {
      type: parsedContact.type.trim(),
      value: parsedContact.value.trim(),
    };
    if (!normalizedContact.type || !normalizedContact.value) {
      continue;
    }

    const isDuplicate = contacts.some(
      (contact) =>
        contact.type.toLowerCase() === normalizedContact.type.toLowerCase() &&
        contact.value.toLowerCase() === normalizedContact.value.toLowerCase(),
    );
    if (!isDuplicate) {
      contacts.push(normalizedContact);
    }
  }

  return {
    id: payload.candidateId,
    fullName:
      payload.fullName.trim().slice(0, 255) || RESUME_NOT_SPECIFIED_PLACEHOLDER,
    city: (prefill?.city || fallbackCity || RESUME_NOT_SPECIFIED_PLACEHOLDER)
      .trim()
      .slice(0, 255),
    contacts: contacts.slice(0, 20),
    source: payload.source || prefill?.source || undefined,
    salaryExpectation: prefill?.salaryExpectation,
    salaryCurrency: prefill?.salaryCurrency ?? "UZS",
    currentPosition: prefill?.currentPosition || undefined,
    skills: prefill?.skills ?? [],
    languages: prefill?.languages ?? [],
    workExperience: prefill?.workExperience ?? [],
    education: prefill?.education ?? [],
    status: payload.status || prefill?.status || defaultStatus,
    aiAnalysis: payload.aiAnalysis || undefined,
    aiAnalysisTranslations: payload.aiAnalysisTranslations,
    tags: payload.tags ?? [],
    resumeFileId: payload.resumeFileId || undefined,
    resumeFileName: payload.resumeFileName || undefined,
    resumeFileSize: payload.resumeFileSize || undefined,
  };
}
