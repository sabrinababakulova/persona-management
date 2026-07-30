"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Dropdown } from "~/app/_components/dropdown";
import { FormProgress } from "~/app/_components/form-progress";
import { AIGenerationIcon } from "~/app/_components/icons";
import {
  FeedbackPresence,
  LoadingButtonContent,
  LoadingState,
} from "~/app/_components/motion-system";
import {
  ResumeFileUploader,
  type ResumeUploadMeta,
} from "~/app/_components/resume-file-uploader";
import { useLookupLocalizer } from "~/i18n/use-localized-lookups";
import { createCandidateFormSchema } from "~/schemas/candidate";
import { api } from "~/trpc/react";
import type { CandidateFormData } from "~/types/candidates/candidate-form-data";
import type {
  ContactItem,
  EducationFormItem,
  Errors,
  LanguageItem,
  WorkExperienceFormItem,
} from "~/types/candidates/components";
import { calculateCandidateFormProgress } from "~/utils/candidate-form-progress";
import { BackgroundDetailsSection } from "../components/BackgroundDetailsSection";
import { BasicInfoSection } from "../components/BasicInfoSection";
import { ConditionsSection } from "../components/ConditionsSection";

const CREATE_CANDIDATE_SUCCESS_KEY = "candidate-create-success";

// Helper to generate unique IDs
const generateId = () => crypto.randomUUID();

export function CreateCandidateForm() {
  const t = useTranslations("CandidateForm");
  const common = useTranslations("Common");
  const validation = useTranslations("Validation");
  const localizeLookups = useLookupLocalizer();
  const router = useRouter();
  const utils = api.useUtils();
  const [candidateDraftId] = useState(() => crypto.randomUUID());
  const [basicInfoOpen, setBasicInfoOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  const [backgroundOpen, setBackgroundOpen] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [isResumeUploading, setIsResumeUploading] = useState(false);
  const candidateFormSchema = useMemo(
    () =>
      createCandidateFormSchema({
        contactType: validation("candidateContactType"),
        contactRequired: validation("candidateContactRequired"),
        language: validation("candidateLanguage"),
        languageLevel: validation("candidateLanguageLevel"),
        company: validation("candidateCompany"),
        position: validation("candidatePosition"),
        period: validation("candidatePeriod"),
        description: validation("candidateDescription"),
        experienceDescription: validation("candidateExperienceDescription"),
        institution: validation("candidateInstitution"),
        gpa: validation("candidateGpa"),
        educationPeriod: validation("candidateEducationPeriod"),
        fullName: validation("candidateFullName"),
        city: validation("candidateCity"),
      }),
    [validation],
  );

  // Use non-suspense query so the page doesn't 500 if lookups fail.
  const {
    data: rawCandidateLookups,
    isError: isLookupsError,
    isLoading: isLookupsLoading,
    refetch: refetchLookups,
  } = api.lookups.getCandidateCreateOptions.useQuery();
  const candidateLookups = useMemo(
    () =>
      rawCandidateLookups
        ? {
            ...rawCandidateLookups,
            contactTypes: localizeLookups(
              rawCandidateLookups.contactTypes,
              "contactTypes",
            ),
            sources: localizeLookups(rawCandidateLookups.sources, "sources"),
            positions: localizeLookups(
              rawCandidateLookups.positions,
              "positions",
            ),
            languages: localizeLookups(
              rawCandidateLookups.languages,
              "languages",
            ),
            languageLevels: localizeLookups(
              rawCandidateLookups.languageLevels,
              "languageLevels",
            ),
            statusOptions: localizeLookups(
              rawCandidateLookups.statusOptions,
              "candidateStatuses",
            ),
          }
        : undefined,
    [localizeLookups, rawCandidateLookups],
  );

  // Form state
  const [formData, setFormData] = useState<CandidateFormData>({
    fullName: "",
    city: "",
    contacts: [{ type: "", value: "" }],
    source: "",
    salaryExpectation: undefined,
    salaryCurrency: "UZS",
    currentPosition: "",
    skills: [],
    languages: [{ name: "", level: "" }],
    workExperience: [],
    education: [],
    status: "",
    aiAnalysis: "",
    resumeFileId: "",
    resumeFileName: "",
    resumeFileSize: "",
  });

  // Contacts and languages with IDs for stable keys
  const [contacts, setContacts] = useState<ContactItem[]>([
    { id: generateId(), type: "", value: "" },
  ]);

  const [languages, setLanguages] = useState<LanguageItem[]>([
    { id: generateId(), name: "", level: "" },
  ]);
  const [workExperience, setWorkExperience] = useState<
    WorkExperienceFormItem[]
  >([
    {
      id: generateId(),
      company: "",
      position: "",
      period: "",
      description: "",
    },
  ]);
  const [education, setEducation] = useState<EducationFormItem[]>([
    {
      id: generateId(),
      institution: "",
      gpa: "",
      period: "",
    },
  ]);

  const requiredFields = useMemo(
    () =>
      [
        { key: "fullName", label: t("fullName") },
        { key: "city", label: t("city") },
        { key: "salaryExpectation", label: t("salary") },
      ] as const,
    [t],
  );
  const progress = calculateCandidateFormProgress(formData, requiredFields);

  useEffect(() => {
    if (!candidateLookups) {
      return;
    }

    const firstContactType = candidateLookups.contactTypes[0]?.value ?? "";
    const firstStatus = candidateLookups.statusOptions[0]?.value ?? "";

    setContacts((prev) =>
      prev.map((contact) =>
        contact.type ? contact : { ...contact, type: firstContactType },
      ),
    );
    setFormData((prev) => ({
      ...prev,
      status: prev.status || firstStatus,
    }));
  }, [candidateLookups]);

  // Create candidate mutation
  const createCandidate = api.candidates.create.useMutation({
    onSuccess: (createdCandidate) => {
      if (!createdCandidate) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            CREATE_CANDIDATE_SUCCESS_KEY,
            t("candidateSaved"),
          );
        }
        router.push("/candidates");
        return;
      }

      void utils.candidates.list.invalidate();

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          CREATE_CANDIDATE_SUCCESS_KEY,
          t("candidateAdded"),
        );
      }
      router.push("/candidates");
    },
    onError: (error) => {
      console.error("Failed to create candidate:", error);
      setErrors((prev) => ({
        ...prev,
        _form: error.message || t("saveError"),
      }));
    },
  });

  // Form handlers
  const clearError = (path: string) => {
    setErrors((prev) => {
      if (!prev[path]) {
        return prev;
      }

      const nextErrors = { ...prev };
      delete nextErrors[path];
      return nextErrors;
    });
  };

  const handleInputChange = (
    field: keyof CandidateFormData,
    value: unknown,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  const handleContactChange = (
    id: string,
    field: "type" | "value",
    value: string,
  ) => {
    const contactIndex = contacts.findIndex((contact) => contact.id === id);
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact,
      ),
    );
    if (contactIndex >= 0) {
      clearError(`contacts.${contactIndex}.${field}`);
    }
  };

  const addContact = () => {
    const newContact: ContactItem = {
      id: generateId(),
      type: candidateLookups?.contactTypes[0]?.value ?? "",
      value: "",
    };
    setContacts((prev) => [...prev, newContact]);
  };

  const removeContact = (id: string) => {
    if (contacts.length > 1) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleLanguageChange = (
    id: string,
    field: "name" | "level",
    value: string,
  ) => {
    const languageIndex = languages.findIndex((language) => language.id === id);
    setLanguages((prev) =>
      prev.map((language) =>
        language.id === id ? { ...language, [field]: value } : language,
      ),
    );
    if (languageIndex >= 0) {
      clearError(`languages.${languageIndex}.${field}`);
    }
  };

  const addLanguage = () => {
    const newLanguage: LanguageItem = { id: generateId(), name: "", level: "" };
    setLanguages((prev) => [...prev, newLanguage]);
  };

  const removeLanguage = (id: string) => {
    if (languages.length > 1) {
      setLanguages((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const handleWorkExperienceChange = (
    id: string,
    field: "company" | "position" | "period" | "description",
    value: string,
  ) => {
    const workExperienceIndex = workExperience.findIndex(
      (item) => item.id === id,
    );
    setWorkExperience((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
    if (workExperienceIndex >= 0) {
      clearError(`workExperience.${workExperienceIndex}.${field}`);
    }
  };

  const addWorkExperience = () => {
    setWorkExperience((prev) => [
      ...prev,
      {
        id: generateId(),
        company: "",
        position: "",
        period: "",
        description: "",
      },
    ]);
  };

  const removeWorkExperience = (id: string) => {
    if (workExperience.length > 1) {
      setWorkExperience((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleEducationChange = (
    id: string,
    field: "institution" | "gpa" | "period",
    value: string,
  ) => {
    const educationIndex = education.findIndex((item) => item.id === id);
    setEducation((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
    if (educationIndex >= 0) {
      clearError(`education.${educationIndex}.${field}`);
    }
  };

  const addEducation = () => {
    setEducation((prev) => [
      ...prev,
      {
        id: generateId(),
        institution: "",
        gpa: "",
        period: "",
      },
    ]);
  };

  const removeEducation = (id: string) => {
    if (education.length > 1) {
      setEducation((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const toggleSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const removeSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  const handleSubmit = () => {
    const normalizedWorkExperience = workExperience
      .map((item) => ({
        company: item.company.trim(),
        position: item.position.trim(),
        period: item.period.trim(),
        description: item.description
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      }))
      .filter(
        (item) =>
          item.company ||
          item.position ||
          item.period ||
          item.description.length > 0,
      );

    const normalizedEducation = education
      .map((item) => ({
        institution: item.institution.trim(),
        gpa: item.gpa.trim(),
        period: item.period.trim(),
      }))
      .filter((item) => item.institution || item.gpa || item.period);

    // Drop fully-empty rows before validation so the default blank
    // contact/language rows can't silently block submission.
    const normalizedContacts = contacts
      .map((c) => ({ type: c.type.trim(), value: c.value.trim() }))
      .filter((c) => c.value !== "");

    const normalizedLanguages = languages
      .map((l) => ({ name: l.name.trim(), level: l.level.trim() }))
      .filter((l) => l.name !== "" || l.level !== "");

    const dataToValidate = {
      ...formData,
      contacts: normalizedContacts,
      languages: normalizedLanguages,
      workExperience: normalizedWorkExperience,
      education: normalizedEducation,
    };

    const result = candidateFormSchema.safeParse(dataToValidate);

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      for (const error of result.error.errors) {
        const path = error.path.join(".");
        newErrors[path] = error.message;
      }
      newErrors._form = t("validationError");
      setErrors(newErrors);
      // Expand every section so the highlighted fields are visible.
      setBasicInfoOpen(true);
      setRequirementsOpen(true);
      setBackgroundOpen(true);
      return;
    }

    const cleanedData = {
      ...result.data,
      contacts: result.data.contacts.filter((c) => c.value.trim() !== ""),
      languages: result.data.languages.filter(
        (l) => l.name.trim() !== "" && l.level.trim() !== "",
      ),
      workExperience: result.data.workExperience.filter(
        (item) =>
          item.company.trim() !== "" ||
          item.position.trim() !== "" ||
          item.period.trim() !== "" ||
          item.description.length > 0,
      ),
      education: result.data.education.filter(
        (item) =>
          item.institution.trim() !== "" ||
          item.gpa.trim() !== "" ||
          item.period.trim() !== "",
      ),
    };

    setErrors({});
    createCandidate.mutate({
      ...cleanedData,
      id: candidateDraftId,
    });
  };

  if (isLookupsLoading) {
    return (
      <LoadingState className="min-h-[50vh]" label={t("loadingLookups")} />
    );
  }

  if (isLookupsError || !candidateLookups) {
    return (
      <div className="mx-auto mt-16 w-full max-w-[758px] rounded-xl border border-danger-red-bg bg-danger-red-bg p-6 text-danger-red">
        <p className="mb-4 text-sm">{t("lookupsError")}</p>
        <button
          className="ui-button ui-button-primary"
          onClick={() => void refetchLookups()}
          type="button"
        >
          {common("retry")}
        </button>
      </div>
    );
  }

  const handleResumeUploaded = (uploadedResume: ResumeUploadMeta) => {
    const { prefillData } = uploadedResume;
    setFormData((prev) => ({
      ...prev,
      resumeFileId: uploadedResume.resumeFileId,
      resumeFileName: uploadedResume.resumeFileName,
      resumeFileSize: uploadedResume.resumeFileSize,
      aiAnalysis: uploadedResume.aiAnalysis,
      fullName: prefillData.fullName || prev.fullName,
      city: prefillData.city || prev.city,
      contacts:
        prefillData.contacts.length > 0 ? prefillData.contacts : prev.contacts,
      source: "local", // Source is always "local" for resume uploads
      salaryExpectation:
        prefillData.salaryExpectation ?? prev.salaryExpectation,
      salaryCurrency: prefillData.salaryCurrency || prev.salaryCurrency,
      currentPosition: prefillData.currentPosition || prev.currentPosition,
      skills: prefillData.skills.length > 0 ? prefillData.skills : prev.skills,
      languages:
        prefillData.languages.length > 0
          ? prefillData.languages
          : prev.languages,
      workExperience:
        prefillData.workExperience.length > 0
          ? prefillData.workExperience
          : prev.workExperience,
      education:
        prefillData.education.length > 0
          ? prefillData.education
          : prev.education,
      status: prefillData.status || prev.status,
    }));

    if (prefillData.contacts.length > 0) {
      setContacts(
        prefillData.contacts.map((contact) => ({
          id: generateId(),
          type: contact.type,
          value: contact.value,
        })),
      );
    }

    if (prefillData.languages.length > 0) {
      setLanguages(
        prefillData.languages.map((language) => ({
          id: generateId(),
          name: language.name,
          level: language.level,
        })),
      );
    }

    if (prefillData.workExperience.length > 0) {
      setWorkExperience(
        prefillData.workExperience.map((item) => ({
          id: generateId(),
          company: item.company,
          position: item.position,
          period: item.period,
          description: item.description.join("\n"),
        })),
      );
    }

    if (prefillData.education.length > 0) {
      setEducation(
        prefillData.education.map((item) => ({
          id: generateId(),
          institution: item.institution,
          gpa: item.gpa,
          period: item.period,
        })),
      );
    }

    setErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.fullName;
      delete nextErrors.city;
      delete nextErrors.salaryExpectation;
      for (const key of Object.keys(nextErrors)) {
        if (key.startsWith("workExperience.") || key.startsWith("education.")) {
          delete nextErrors[key];
        }
      }
      return nextErrors;
    });
  };

  return (
    <div className="relative flex w-full min-w-0 justify-center">
      <div className="app-page-narrow">
        <div className="page-header">
          <h1 className="page-title">{t("addCandidate")}</h1>
          <Dropdown
            fieldClassName="h-9 px-2 py-2 pr-6 text-sm leading-none"
            hideLabel
            iconClassName="right-2 text-text-placeholder"
            label={t("status")}
            onChange={(value) => handleInputChange("status", value)}
            options={candidateLookups.statusOptions}
            value={formData.status}
          />
        </div>

        <FormProgress
          filled={progress.filled}
          missing={progress.missing}
          percentage={progress.percentage}
          total={progress.total}
        />

        <section className="surface-card mb-5 flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="section-title">{t("resume")}</h2>
            <button
              className="ui-button bg-ai-violet/10 px-3 text-ai-violet hover:bg-ai-violet/15"
              type="button"
            >
              {t("fillFields")}
            </button>
          </div>
          <ResumeFileUploader
            candidateId={candidateDraftId}
            currentResumeFileId={formData.resumeFileId}
            disabled={createCandidate.isPending}
            onUploaded={handleResumeUploaded}
            onUploadingChange={setIsResumeUploading}
          />
          <p className="flex items-center gap-1.5 font-medium text-ai-violet text-sm">
            <AIGenerationIcon className="h-4 w-4" />
            AI {t("resumeAutofill")}
          </p>
        </section>

        <BasicInfoSection
          city={formData.city}
          contactSources={candidateLookups.contactTypes}
          contacts={contacts}
          currentPosition={formData.currentPosition ?? ""}
          errors={errors}
          fullName={formData.fullName}
          isOpen={basicInfoOpen}
          onAddContact={addContact}
          onContactChange={handleContactChange}
          onInputChange={(field, value) => handleInputChange(field, value)}
          onRemoveContact={removeContact}
          onToggle={() => setBasicInfoOpen(!basicInfoOpen)}
          positions={candidateLookups.positions}
          source={formData.source ?? ""}
          sources={candidateLookups.sources}
        />

        <ConditionsSection
          errors={errors}
          isOpen={requirementsOpen}
          languageLevelOptions={candidateLookups.languageLevels}
          languageOptions={candidateLookups.languages}
          languages={languages}
          onAddLanguage={addLanguage}
          onCurrencyChange={(value) =>
            handleInputChange("salaryCurrency", value)
          }
          onLanguageChange={handleLanguageChange}
          onRemoveLanguage={removeLanguage}
          onRemoveSkill={removeSkill}
          onSalaryChange={(value) =>
            handleInputChange("salaryExpectation", value)
          }
          onToggle={() => setRequirementsOpen(!requirementsOpen)}
          onToggleSkill={toggleSkill}
          salaryCurrency={formData.salaryCurrency}
          salaryExpectation={formData.salaryExpectation}
          skills={formData.skills}
          skillsOptions={candidateLookups.skills.map((s) => s.label)}
        />

        <BackgroundDetailsSection
          education={education}
          errors={errors}
          isOpen={backgroundOpen}
          onAddEducation={addEducation}
          onAddWorkExperience={addWorkExperience}
          onEducationChange={handleEducationChange}
          onRemoveEducation={removeEducation}
          onRemoveWorkExperience={removeWorkExperience}
          onToggle={() => setBackgroundOpen(!backgroundOpen)}
          onWorkExperienceChange={handleWorkExperienceChange}
          workExperience={workExperience}
        />

        <div className="mt-8">
          <FeedbackPresence show={Boolean(errors._form)}>
            <div className="mb-4 rounded-lg border border-danger-red-bg bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
              {errors._form}
            </div>
          </FeedbackPresence>
          <button
            className="ui-button ui-button-primary w-full"
            disabled={createCandidate.isPending || isResumeUploading}
            onClick={handleSubmit}
            type="button"
          >
            <LoadingButtonContent
              isLoading={createCandidate.isPending}
              label={t("saveCandidate")}
              loadingLabel={common("saving")}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
