"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { z } from "zod";
import { api } from "~/trpc/react";
import { BasicInfoSection } from "./components/BasicInfoSection";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { ConditionsSection } from "./components/ConditionsSection";
import { HeaderSummary } from "./components/HeaderSummary";
import { SidebarMenu } from "./components/SidebarMenu";
import type { ContactItem, Errors, LanguageItem } from "./components/types";

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

// Menu items for left sidebar
const MENU_ITEMS = [
  { id: "basic", label: "Основная информация" },
  { id: "requirements", label: "Требования и Навыки" },
];

export function CreateCandidateForm() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("basic");
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

  // Skills dropdown state
  const [skillsDropdownOpen, setSkillsDropdownOpen] = useState(false);

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
    onSuccess: () => {
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

  if (!lookups) {
    return null;
  }

  return (
    <main className="relative flex flex-1 overflow-auto bg-white">
      <div className="flex w-full gap-10 px-10">
        <SidebarMenu
          activeId={activeSection}
          items={MENU_ITEMS}
          onSelect={setActiveSection}
        />

        <div className="flex-1 pt-4 pb-12">
          <Breadcrumbs label="Новый кандидат" />

          <HeaderSummary
            onStatusChange={(value) => handleInputChange("status", value)}
            progress={progress}
            status={formData.status}
            statusOptions={lookups.statusOptions}
            subtitle={{
              position: formData.currentPosition || "Должность",
              city: formData.city || "Город",
            }}
            title={formData.fullName || "Новый кандидат"}
          />

          <div className="max-w-[640px]">
            <BasicInfoSection
              city={formData.city}
              contacts={contacts}
              contactTypes={lookups.contactTypes}
              currentPosition={formData.currentPosition ?? ""}
              errors={errors}
              fullName={formData.fullName}
              isOpen={basicInfoOpen}
              onAddContact={addContact}
              onContactChange={handleContactChange}
              onInputChange={(field, value) => handleInputChange(field, value)}
              onRemoveContact={removeContact}
              onToggle={() => setBasicInfoOpen(!basicInfoOpen)}
              positions={lookups.positions}
              source={formData.source ?? ""}
              sources={lookups.sources}
            />

            <ConditionsSection
              isOpen={requirementsOpen}
              languageLevelOptions={lookups.languageLevels}
              languageOptions={lookups.languages}
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
              onToggleSkillsDropdown={() =>
                setSkillsDropdownOpen(!skillsDropdownOpen)
              }
              salaryCurrency={formData.salaryCurrency}
              salaryExpectation={formData.salaryExpectation}
              skills={formData.skills}
              skillsDropdownOpen={skillsDropdownOpen}
              skillsOptions={lookups.skills.map((s) => s.label)}
            />

            <div className="flex justify-end pt-6">
              <button
                className="rounded-md bg-primary-blue px-6 py-3 font-medium text-[16px] text-white tracking-[-0.32px] hover:bg-primary-blue/90 disabled:opacity-50"
                disabled={createCandidate.isPending}
                onClick={handleSubmit}
                type="button"
              >
                {createCandidate.isPending ? "Сохранение..." : "Следующий этап"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
