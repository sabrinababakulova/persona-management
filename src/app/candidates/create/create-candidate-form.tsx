"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { z } from "zod";
import { Dropdown } from "~/app/_components/dropdown";
import { AIGenerationIcon, FileUploadIcon } from "~/app/_components/icons";
import { DEFAULT_CANDIDATE_LOOKUPS } from "~/shared/candidate-lookups";
import { api } from "~/trpc/react";
import { BasicInfoSection } from "../components/BasicInfoSection";
import { ConditionsSection } from "../components/ConditionsSection";
import type { ContactItem, Errors, LanguageItem } from "../components/types";

const CREATE_CANDIDATE_SUCCESS_KEY = "candidate-create-success";

// Zod validation schema
const contactSchema = z.object({
  type: z.string().min(1, "Выберите тип контакта"),
  value: z.string().min(1, "Контакт обязателен"),
});

const languageSchema = z.object({
  name: z.string().min(1, "Выберите язык"),
  level: z.string().min(1, "Выберите уровень"),
});

const candidateFormSchema = z.object({
  fullName: z.string().min(1, "Ф.И.О обязательно"),
  city: z.string().min(1, "Город обязателен"),
  contacts: z.array(contactSchema).default([]),
  source: z.string().optional(),
  salaryExpectation: z.number().min(0).optional(),
  salaryCurrency: z.enum(["UZS", "USD"]).default("UZS"),
  currentPosition: z.string().optional(),
  skills: z.array(z.string()).default([]),
  languages: z.array(languageSchema).default([]),
  status: z.string().default("new"),
  resumeUrl: z.string().optional(),
  resumeFileName: z.string().optional(),
});

type CandidateFormData = z.infer<typeof candidateFormSchema>;

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
  const [basicInfoOpen, setBasicInfoOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  const [errors, setErrors] = useState<Errors>({});

  // Use non-suspense query so the page doesn't 500 if lookups fail.
  const { data: lookups } = api.lookups.getCandidateCreateOptions.useQuery(
    undefined,
    {
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  );
  const candidateLookups = lookups ?? DEFAULT_CANDIDATE_LOOKUPS;

  // Form state
  const [formData, setFormData] = useState<CandidateFormData>({
    fullName: "",
    city: "",
    contacts: [{ type: "telegram", value: "" }],
    source: "",
    salaryExpectation: undefined,
    salaryCurrency: "UZS",
    currentPosition: "",
    skills: [],
    languages: [{ name: "", level: "" }],
    status: "new",
    resumeUrl: "",
    resumeFileName: "",
  });

  // Contacts and languages with IDs for stable keys
  const [contacts, setContacts] = useState<ContactItem[]>([
    { id: generateId(), type: "telegram", value: "" },
  ]);

  const [languages, setLanguages] = useState<LanguageItem[]>([
    { id: generateId(), name: "", level: "" },
  ]);

  // Calculate progress
  const calculateProgress = useCallback(() => {
    let filled = 0;
    const total = REQUIRED_FIELDS.length;
    const missing: string[] = [];

    for (const field of REQUIRED_FIELDS) {
      const value = formData[field.key as keyof CandidateFormData];
      if (value && (typeof value !== "string" || value.trim() !== "")) {
        filled++;
      } else {
        missing.push(field.label);
      }
    }

    return {
      percentage: Math.round((filled / total) * 100),
      filled,
      total,
      missing,
    };
  }, [formData]);

  const progress = calculateProgress();

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

      const parts = createdCandidate.fullName.split(" ");
      utils.candidates.getAllCandidates.setData(undefined, (existing = []) => [
        {
          id: createdCandidate.id,
          name: parts.slice(0, 2).join(" "),
          patronymic: parts.slice(2).join(" "),
          city: createdCandidate.city ?? "",
          stage: "offer",
          otherResponses: [],
          createdAt: createdCandidate.createdAt
            ? new Date(createdCandidate.createdAt).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "",
          source: createdCandidate.source ?? "",
        },
        ...existing,
      ]);
      void utils.candidates.getAllCandidates.invalidate();

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
    },
  });

  // Form handlers
  const handleInputChange = (
    field: keyof CandidateFormData,
    value: unknown,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleContactChange = (
    id: string,
    field: "type" | "value",
    value: string,
  ) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact,
      ),
    );
  };

  const addContact = () => {
    const newContact: ContactItem = {
      id: generateId(),
      type: "telegram",
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
    setLanguages((prev) =>
      prev.map((language) =>
        language.id === id ? { ...language, [field]: value } : language,
      ),
    );
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
    const dataToValidate = {
      ...formData,
      contacts: contacts.map((c) => ({ type: c.type, value: c.value })),
      languages: languages.map((l) => ({ name: l.name, level: l.level })),
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
    };

    createCandidate.mutate(cleanedData);
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

        <div className="mb-9 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[14px] text-primary-blue tracking-[-0.28px]">
              {progress.percentage}% заполнено
            </span>
            <span className="text-[12px] text-text-placeholder tracking-[-0.24px]">
              {progress.filled} из {progress.total} полей
            </span>
          </div>
          <div className="h-2 w-full rounded-[10px] bg-border-input">
            <div
              className="h-full rounded-[10px] bg-primary-blue transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          {progress.missing.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[14px] tracking-[-0.28px]">
              <span className="text-text-placeholder">Осталось заполнить:</span>
              {progress.missing.map((field) => (
                <span className="font-medium text-accent-red" key={field}>
                  {field}
                </span>
              ))}
            </div>
          )}
        </div>

        <section className="mb-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
              Резюме
            </h2>
            <button
              className="h-8 rounded-[6px] bg-[#9747ff]/30 px-4 font-semibold text-[14px] text-white tracking-[-0.28px]"
              type="button"
            >
              Заполнить поля
            </button>
          </div>
          <div className="flex h-24 w-full flex-col items-center justify-center rounded-[6px] border border-border-input border-dashed bg-bg-input px-3 py-[14px]">
            <div className="flex items-center gap-2">
              <FileUploadIcon className="h-5 w-5 text-text-placeholder" />
              <span className="font-medium text-[16px] text-text-placeholder leading-[1.4] tracking-[-0.32px]">
                Upload pdf file
              </span>
            </div>
            <p className="font-normal text-[12px] text-text-disabled leading-[1.4] tracking-[-0.24px]">
              File should be less than 120MB
            </p>
          </div>
          <p className="flex items-center gap-1 font-medium text-[#9747FF] text-[14px] tracking-[-0.28px]">
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

        <div className="mt-8">
          <button
            className="h-10 w-full rounded-[6px] bg-primary-blue px-6 font-semibold text-[16px] text-white tracking-[-0.32px] hover:bg-primary-blue-hover disabled:opacity-50"
            disabled={createCandidate.isPending}
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
