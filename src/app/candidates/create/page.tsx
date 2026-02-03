"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { z } from "zod";
import { api } from "~/trpc/react";
import {
  BellIcon,
  ChevronDownIcon,
  GlobeIcon,
  SearchIcon,
} from "../../_components/icons";

// Zod validation schema
const contactSchema = z.object({
  type: z.enum(["telegram", "phone", "email", "whatsapp"]),
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

interface ContactItem {
  id: string;
  type: "telegram" | "phone" | "email" | "whatsapp";
  value: string;
}

interface LanguageItem {
  id: string;
  name: string;
  level: string;
}

// Icons
function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Expand</title>
      <path
        d="M5 15l7-7 7 7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Add</title>
      <path
        d="M12 4v16m8-8H4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>File</title>
      <path
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>AI</title>
      <path
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Close</title>
      <path
        d="M6 18L18 6M6 6l12 12"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

// Constants
const CONTACT_TYPES = [
  { value: "telegram", label: "Telegram" },
  { value: "phone", label: "Телефон" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

const SOURCES = [
  { value: "hh.uz", label: "hh.uz" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "telegram", label: "Telegram" },
  { value: "referral", label: "Реферал" },
  { value: "other", label: "Другое" },
];

const POSITIONS = [
  { value: "frontend_developer", label: "Frontend Developer" },
  { value: "backend_developer", label: "Backend Developer" },
  { value: "fullstack_developer", label: "Fullstack Developer" },
  { value: "product_designer", label: "Product Designer" },
  { value: "graphic_designer", label: "Graphic Designer" },
  { value: "project_manager", label: "Project Manager" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "marketing_manager", label: "Marketing Manager" },
];

const SKILLS = [
  "React",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "Python",
  "Figma",
  "Adobe Photoshop",
  "Adobe Illustrator",
  "Коммуникабельность",
  "Креативность",
  "Управление проектами",
  "Аналитика",
];

const LANGUAGES = [
  { value: "russian", label: "Русский" },
  { value: "uzbek", label: "Узбекский" },
  { value: "english", label: "Английский" },
  { value: "german", label: "Немецкий" },
  { value: "french", label: "Французский" },
  { value: "spanish", label: "Испанский" },
  { value: "korean", label: "Корейский" },
  { value: "chinese", label: "Китайский" },
];

const LANGUAGE_LEVELS = [
  { value: "A1", label: "A1 - Начальный" },
  { value: "A2", label: "A2 - Элементарный" },
  { value: "B1", label: "B1 - Средний" },
  { value: "B2", label: "B2 - Выше среднего" },
  { value: "C1", label: "C1 - Продвинутый" },
  { value: "C2", label: "C2 - Владение в совершенстве" },
];

const STATUS_OPTIONS = [
  { value: "new", label: "Новый" },
  { value: "screening", label: "Скрининг" },
  { value: "interview", label: "Интервью" },
  { value: "offer", label: "Оффер" },
  { value: "hired", label: "Нанят" },
  { value: "rejected", label: "Отклонен" },
];

// Required fields for progress tracking
const REQUIRED_FIELDS = [
  { key: "fullName", label: "Ф.И.О" },
  { key: "city", label: "Город" },
  { key: "salaryExpectation", label: "Зарплатные ожидания" },
] as const;

// Helper to generate unique IDs
const generateId = () => crypto.randomUUID();

export default function CreateCandidatePage() {
  const router = useRouter();
  const [basicInfoOpen, setBasicInfoOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    // Clear error when user starts typing
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
    // Sync with formData
    setFormData((prev) => ({
      ...prev,
      contacts: contacts.map((c) =>
        c.id === id
          ? {
            type: field === "type" ? (value as ContactItem["type"]) : c.type,
            value: field === "value" ? value : c.value,
          }
          : { type: c.type, value: c.value },
      ),
    }));
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

  // Form submission
  const handleSubmit = () => {
    // Prepare data with current contacts and languages
    const dataToValidate = {
      ...formData,
      contacts: contacts.map((c) => ({ type: c.type, value: c.value })),
      languages: languages.map((l) => ({ name: l.name, level: l.level })),
    };

    // Validate with zod
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

    // Filter out empty contacts and languages
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
    <>
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-header-border border-b bg-white px-4 py-4 lg:px-8">
          {/* Search */}
          <div className="relative w-full max-w-md">
            <SearchIcon className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-xl border border-border-light bg-bg-light py-3 pr-4 pl-12 text-gray-700 placeholder-gray-400 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
              placeholder="Что вы хотите найти?"
              type="text"
            />
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Language Selector */}
            <button
              className="hidden items-center gap-2 rounded-lg px-3 py-2 text-gray-600 hover:bg-bg-light sm:flex"
              type="button"
            >
              <GlobeIcon className="h-5 w-5" />
              <span>Ру</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>

            {/* Notifications */}
            <button
              className="relative rounded-lg p-2 text-gray-600 hover:bg-bg-light"
              type="button"
            >
              <BellIcon className="h-6 w-6" />
            </button>

            {/* Profile */}
            <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200">
              <Image
                alt="Profile"
                className="h-full w-full object-cover"
                height={40}
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Kerim"
                width={40}
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="mx-auto max-w-3xl p-4 lg:p-8">
          {/* Page Header */}
          <div className="mb-6">
            {/* Title Row */}
            <div className="flex items-start justify-between">
              <h1 className="font-bold text-2xl text-gray-900">
                Добавление кандидата
              </h1>

              {/* Status Dropdown */}
              <div className="relative">
                <select
                  className="appearance-none rounded-lg border border-border-light bg-white px-4 py-2 pr-8 text-gray-700 text-sm focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                  onChange={(e) => handleInputChange("status", e.target.value)}
                  value={formData.status}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            {/* Progress Section */}
            <div className="mt-4">
              {/* Progress Stats */}
              <div className="flex items-center justify-between">
                <span className="font-medium text-primary-blue text-sm">
                  {progress.percentage}% заполнено
                </span>
                <span className="text-gray-500 text-sm">
                  {progress.filled} из {progress.total} полей
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-primary-blue transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>

              {/* Missing Fields */}
              {progress.missing.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Осталось заполнить:</span>
                  {progress.missing.map((field, index) => (
                    <span key={field}>
                      <span className="text-pink-500">{field}</span>
                      {index < progress.missing.length - 1 && (
                        <span className="text-gray-400"> | </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resume Section */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-lg">Резюме</h2>
              <button
                className="rounded-lg bg-pink-500 px-4 py-2 font-medium text-sm text-white hover:bg-pink-600"
                type="button"
              >
                Заполнить поля
              </button>
            </div>

            {/* Upload Area */}
            <div className="rounded-xl border-2 border-border-light border-dashed bg-white p-8 text-center">
              <FileIcon className="mx-auto mb-2 h-10 w-10 text-gray-400" />
              <p className="font-medium text-gray-700">Upload pdf file</p>
              <p className="text-gray-500 text-sm">
                File should be less than 120MB
              </p>
            </div>

            {/* AI Notice */}
            <div className="mt-3 flex items-center gap-2 text-primary-blue text-sm">
              <SparklesIcon className="h-4 w-4" />
              <span>AI Мы проанализируем резюме и автозаполним поля</span>
            </div>
          </div>

          {/* Basic Information Section */}
          <div className="mb-6 rounded-xl border border-border-light bg-white">
            <button
              className="flex w-full items-center justify-between p-4"
              onClick={() => setBasicInfoOpen(!basicInfoOpen)}
              type="button"
            >
              <h2 className="font-semibold text-gray-900 text-lg">
                Основная информация
              </h2>
              <ChevronUpIcon
                className={`h-5 w-5 text-gray-400 transition-transform ${basicInfoOpen ? "" : "rotate-180"
                  }`}
              />
            </button>

            {basicInfoOpen && (
              <div className="border-border-light border-t p-4">
                {/* Full Name */}
                <div className="mb-4">
                  <label
                    className="mb-1 block font-medium text-gray-700 text-sm"
                    htmlFor="fullName"
                  >
                    Ф.И.О
                  </label>
                  <input
                    className={`w-full rounded-lg border ${errors.fullName ? "border-red-500" : "border-border-light"
                      } px-4 py-3 text-gray-700 placeholder-gray-400 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20`}
                    id="fullName"
                    onChange={(e) =>
                      handleInputChange("fullName", e.target.value)
                    }
                    placeholder="Введите полное имя"
                    type="text"
                    value={formData.fullName}
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-red-500 text-sm">
                      {errors.fullName}
                    </p>
                  )}
                </div>

                {/* City */}
                <div className="mb-4">
                  <label
                    className="mb-1 block font-medium text-gray-700 text-sm"
                    htmlFor="city"
                  >
                    Город
                  </label>
                  <input
                    className={`w-full rounded-lg border ${errors.city ? "border-red-500" : "border-border-light"
                      } px-4 py-3 text-gray-700 placeholder-gray-400 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20`}
                    id="city"
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="Введите название города"
                    type="text"
                    value={formData.city}
                  />
                  {errors.city && (
                    <p className="mt-1 text-red-500 text-sm">{errors.city}</p>
                  )}
                </div>

                {/* Contacts */}
                <div className="mb-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-gray-700 text-sm">
                      Контакты
                    </span>
                    <button
                      className="text-primary-blue hover:text-primary-blue/80"
                      onClick={addContact}
                      type="button"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                  </div>
                  {contacts.map((contact) => (
                    <div
                      className="mb-2 flex items-center gap-2"
                      key={contact.id}
                    >
                      <input
                        className="flex-1 rounded-lg border border-border-light px-4 py-3 text-gray-700 placeholder-gray-400 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                        onChange={(e) =>
                          handleContactChange(
                            contact.id,
                            "value",
                            e.target.value,
                          )
                        }
                        placeholder="@username или номер телефона"
                        type="text"
                        value={contact.value}
                      />
                      <div className="relative">
                        <select
                          className="appearance-none rounded-lg border border-border-light bg-white px-4 py-3 pr-8 text-gray-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                          onChange={(e) =>
                            handleContactChange(
                              contact.id,
                              "type",
                              e.target.value,
                            )
                          }
                          value={contact.type}
                        >
                          {CONTACT_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      </div>
                      {contacts.length > 1 && (
                        <button
                          className="text-gray-400 hover:text-red-500"
                          onClick={() => removeContact(contact.id)}
                          type="button"
                        >
                          <CloseIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Source */}
                <div>
                  <label
                    className="mb-1 block font-medium text-gray-700 text-sm"
                    htmlFor="source"
                  >
                    Источник
                  </label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-lg border border-border-light bg-white px-4 py-3 pr-8 text-gray-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                      id="source"
                      onChange={(e) =>
                        handleInputChange("source", e.target.value)
                      }
                      value={formData.source}
                    >
                      <option value="">Выберите источник</option>
                      {SOURCES.map((source) => (
                        <option key={source.value} value={source.value}>
                          {source.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Requirements and Skills Section */}
          <div className="mb-6 rounded-xl border border-border-light bg-white">
            <button
              className="flex w-full items-center justify-between p-4"
              onClick={() => setRequirementsOpen(!requirementsOpen)}
              type="button"
            >
              <h2 className="font-semibold text-gray-900 text-lg">
                Требования и Навыки
              </h2>
              <ChevronUpIcon
                className={`h-5 w-5 text-gray-400 transition-transform ${requirementsOpen ? "" : "rotate-180"
                  }`}
              />
            </button>

            {requirementsOpen && (
              <div className="border-border-light border-t p-4">
                {/* Salary Expectations */}
                <div className="mb-4">
                  <label
                    className="mb-1 block font-medium text-gray-700 text-sm"
                    htmlFor="salaryExpectation"
                  >
                    Зарплатные ожидания
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      className={`flex-1 rounded-lg border ${errors.salaryExpectation
                        ? "border-red-500"
                        : "border-border-light"
                        } px-4 py-3 text-gray-700 placeholder-gray-400 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20`}
                      id="salaryExpectation"
                      onChange={(e) =>
                        handleInputChange(
                          "salaryExpectation",
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      placeholder="Введите сумму"
                      type="number"
                      value={formData.salaryExpectation ?? ""}
                    />
                    <div className="flex overflow-hidden rounded-lg border border-border-light">
                      <button
                        className={`px-3 py-3 text-sm ${formData.salaryCurrency === "UZS"
                          ? "bg-primary-blue text-white"
                          : "bg-white text-gray-600"
                          }`}
                        onClick={() =>
                          handleInputChange("salaryCurrency", "UZS")
                        }
                        type="button"
                      >
                        UZS
                      </button>
                      <button
                        className={`px-3 py-3 text-sm ${formData.salaryCurrency === "USD"
                          ? "bg-primary-blue text-white"
                          : "bg-white text-gray-600"
                          }`}
                        onClick={() =>
                          handleInputChange("salaryCurrency", "USD")
                        }
                        type="button"
                      >
                        USD
                      </button>
                    </div>
                  </div>
                </div>

                {/* Current Position */}
                <div className="mb-4">
                  <label
                    className="mb-1 block font-medium text-gray-700 text-sm"
                    htmlFor="currentPosition"
                  >
                    Текущая должность
                  </label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-lg border border-border-light bg-white px-4 py-3 pr-8 text-gray-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                      id="currentPosition"
                      onChange={(e) =>
                        handleInputChange("currentPosition", e.target.value)
                      }
                      value={formData.currentPosition}
                    >
                      <option value="">
                        Введите название или выберите из списка
                      </option>
                      {POSITIONS.map((position) => (
                        <option key={position.value} value={position.value}>
                          {position.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                {/* Key Skills */}
                <div className="mb-4">
                  <span className="mb-1 block font-medium text-gray-700 text-sm">
                    Ключевые навыки
                  </span>
                  <div className="relative">
                    <button
                      className="w-full rounded-lg border border-border-light bg-white px-4 py-3 text-left text-gray-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                      onClick={() => setSkillsDropdownOpen(!skillsDropdownOpen)}
                      type="button"
                    >
                      {formData.skills.length > 0
                        ? `${formData.skills.length} навыков выбрано`
                        : "Введите название или выберите из списка"}
                      <ChevronDownIcon className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </button>

                    {skillsDropdownOpen && (
                      <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border-light bg-white shadow-lg">
                        {SKILLS.map((skill) => (
                          <button
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-bg-light ${formData.skills.includes(skill)
                              ? "bg-primary-blue/10 text-primary-blue"
                              : "text-gray-700"
                              }`}
                            key={skill}
                            onClick={() => toggleSkill(skill)}
                            type="button"
                          >
                            {skill}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected Skills Tags */}
                  {formData.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {formData.skills.map((skill) => (
                        <span
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-blue/10 px-3 py-1.5 text-primary-blue text-sm"
                          key={skill}
                        >
                          <button
                            onClick={() => removeSkill(skill)}
                            type="button"
                          >
                            <CloseIcon className="h-3 w-3" />
                          </button>
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Languages */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-gray-700 text-sm">
                      Языки
                    </span>
                    <button
                      className="text-primary-blue hover:text-primary-blue/80"
                      onClick={addLanguage}
                      type="button"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                  </div>
                  {languages.map((language) => (
                    <div
                      className="mb-2 flex items-center gap-2"
                      key={language.id}
                    >
                      <div className="relative flex-1">
                        <select
                          className="w-full appearance-none rounded-lg border border-border-light bg-white px-4 py-3 pr-8 text-gray-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                          onChange={(e) =>
                            handleLanguageChange(
                              language.id,
                              "name",
                              e.target.value,
                            )
                          }
                          value={language.name}
                        >
                          <option value="">Выберите язык</option>
                          {LANGUAGES.map((lang) => (
                            <option key={lang.value} value={lang.label}>
                              {lang.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      </div>
                      <div className="relative w-40">
                        <select
                          className="w-full appearance-none rounded-lg border border-border-light bg-white px-4 py-3 pr-8 text-gray-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                          onChange={(e) =>
                            handleLanguageChange(
                              language.id,
                              "level",
                              e.target.value,
                            )
                          }
                          value={language.level}
                        >
                          <option value="">Уровень</option>
                          {LANGUAGE_LEVELS.map((level) => (
                            <option key={level.value} value={level.value}>
                              {level.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      </div>
                      {languages.length > 1 && (
                        <button
                          className="text-gray-400 hover:text-red-500"
                          onClick={() => removeLanguage(language.id)}
                          type="button"
                        >
                          <CloseIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            className="w-full rounded-xl bg-primary-blue py-4 font-semibold text-white hover:bg-primary-blue/90 disabled:opacity-50"
            disabled={createCandidate.isPending}
            onClick={handleSubmit}
            type="button"
          >
            {createCandidate.isPending
              ? "Сохранение..."
              : "Сохранить кандидата"}
          </button>
        </div>
      </main>
    </>
  );
}
