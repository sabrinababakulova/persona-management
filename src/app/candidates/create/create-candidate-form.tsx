"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dropdown } from "~/app/_components/dropdown";
import { FormProgress } from "~/app/_components/form-progress";
import { AIGenerationIcon } from "~/app/_components/icons";
import {
  ResumeFileUploader,
  type ResumeUploadMeta,
} from "~/app/_components/resume-file-uploader";
import { candidateFormSchema } from "~/schemas/candidate";
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

// Required fields for progress tracking
const REQUIRED_FIELDS = [
  { key: "fullName", label: "Ф.И.О" },
  { key: "city", label: "Город" },
  { key: "salaryExpectation", label: "Зарплата" },
] as const;

// Helper to generate unique IDs
const generateId = () => crypto.randomUUID();

export function CreateCandidateForm() {
  const router = useRouter();
  const utils = api.useUtils();
  const [candidateDraftId] = useState(() => crypto.randomUUID());
  const [basicInfoOpen, setBasicInfoOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  const [backgroundOpen, setBackgroundOpen] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [isResumeUploading, setIsResumeUploading] = useState(false);

  // Use non-suspense query so the page doesn't 500 if lookups fail.
  const {
    data: candidateLookups,
    isError: isLookupsError,
    isLoading: isLookupsLoading,
    refetch: refetchLookups,
  } = api.lookups.getCandidateCreateOptions.useQuery();

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

  const progress = calculateCandidateFormProgress(formData, REQUIRED_FIELDS);

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
  const createCandidate = api.candidates.createCandidate.useMutation({
    onSuccess: (createdCandidate) => {
      if (!createdCandidate) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            CREATE_CANDIDATE_SUCCESS_KEY,
            "Кандидат сохранен",
          );
        }
        router.push("/candidates");
        return;
      }

      void utils.candidates.getAllCandidates.invalidate();
      void utils.candidates.hasCandidates.invalidate();

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          CREATE_CANDIDATE_SUCCESS_KEY,
          "Кандидат успешно добавлен",
        );
      }
      router.push("/candidates");
    },
    onError: (error) => {
      console.error("Failed to create candidate:", error);
      setErrors((prev) => ({
        ...prev,
        _form: error.message || "Не удалось сохранить кандидата",
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

    const dataToValidate = {
      ...formData,
      contacts: contacts.map((c) => ({ type: c.type, value: c.value })),
      languages: languages.map((l) => ({ name: l.name, level: l.level })),
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
      setErrors(newErrors);
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

    createCandidate.mutate({
      ...cleanedData,
      id: candidateDraftId,
    });
  };

  if (isLookupsLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-text-secondary">
        Загрузка справочников...
      </div>
    );
  }

  if (isLookupsError || !candidateLookups) {
    return (
      <div className="mx-auto mt-16 w-full max-w-[758px] rounded-[8px] border border-danger-red-bg bg-danger-red-bg p-6 text-danger-red">
        <p className="mb-4 text-[14px]">
          Не удалось загрузить справочники из базы данных.
        </p>
        <button
          className="rounded-[6px] bg-primary-blue px-4 py-2 text-[14px] text-bg-light hover:bg-primary-blue-hover"
          onClick={() => void refetchLookups()}
          type="button"
        >
          Повторить
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
      source: prefillData.source || prev.source,
      salaryExpectation:
        prefillData.salaryExpectation ?? prev.salaryExpectation,
      salaryCurrency: prefillData.salaryCurrency || prev.salaryCurrency,
      currentPosition: prefillData.currentPosition || prev.currentPosition,
      skills: prefillData.skills.length > 0 ? prefillData.skills : prev.skills,
      languages:
        prefillData.languages.length > 0
          ? prefillData.languages
          : prev.languages,
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

    setErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.fullName;
      delete nextErrors.city;
      delete nextErrors.salaryExpectation;
      return nextErrors;
    });
  };

  return (
    <div className="relative flex w-full min-w-0 justify-center">
      <div className="w-full max-w-[758px] px-6 pt-[104px] pb-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
            Добавление кандидата
          </h1>
          <Dropdown
            fieldClassName="h-8 px-2 py-2 pr-6 text-[14px] leading-none tracking-[-0.28px]"
            hideLabel
            iconClassName="right-2 text-text-placeholder"
            label="Статус"
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

        <section className="mb-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
              Резюме
            </h2>
            <button
              className="h-8 rounded-[6px] bg-chart-purple/30 px-4 font-semibold text-[14px] text-bg-light tracking-[-0.28px]"
              type="button"
            >
              Заполнить поля
            </button>
          </div>
          <ResumeFileUploader
            candidateId={candidateDraftId}
            currentResumeFileId={formData.resumeFileId}
            disabled={createCandidate.isPending}
            onUploaded={handleResumeUploaded}
            onUploadingChange={setIsResumeUploading}
          />
          <p className="flex items-center gap-1 font-medium text-[14px] text-chart-purple tracking-[-0.28px]">
            <AIGenerationIcon className="h-4 w-4" />
            AI Мы проанализируем резюме и автозаполним поля
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
          {errors._form && (
            <div className="mb-4 rounded-[6px] border border-danger-red-bg bg-danger-red-bg px-3 py-2 text-[14px] text-danger-red">
              {errors._form}
            </div>
          )}
          <button
            className="h-10 w-full rounded-[6px] bg-primary-blue px-6 font-semibold text-[16px] text-bg-light tracking-[-0.32px] hover:bg-primary-blue-hover disabled:opacity-50"
            disabled={createCandidate.isPending || isResumeUploading}
            onClick={handleSubmit}
            type="button"
          >
            {createCandidate.isPending
              ? "Сохранение..."
              : "Сохранить кандидата"}
          </button>
        </div>
      </div>
    </div>
  );
}
