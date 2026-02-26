"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Dropdown } from "~/app/_components/dropdown";
import { FormProgress } from "~/app/_components/form-progress";
import { SideMenu } from "~/app/_components/sideMenu";
import { DEFAULT_VACANCY_LOOKUPS } from "~/shared/vacancy-lookups";
import { api } from "~/trpc/react";
import type { Vacancy } from "~/types/pages/vacancies-page";

const SIDE_MENU_ITEMS = [{ id: "description", label: "Описание вакансии" }];

type VacancyStatus = Vacancy["status"];

function isVacancyStatus(value: string): value is VacancyStatus {
  return ["active", "draft", "paused", "closed", "archive"].includes(value);
}

type VacancyCreateFormData = {
  title: string;
  level: string;
  city: string;
  workType: string;
  responses: number;
  description: string;
  status: VacancyStatus;
};

const REQUIRED_FIELDS: Array<{
  key: keyof Pick<VacancyCreateFormData, "title" | "city" | "workType">;
  label: string;
}> = [
  { key: "title", label: "Название вакансии" },
  { key: "city", label: "Город" },
  { key: "workType", label: "Тип работы" },
];

export default function CreateVacancyPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const [activeSectionId, setActiveSectionId] = useState<string>("description");
  const [errors, setErrors] = useState<{
    title?: string;
    _form?: string;
  }>({});

  const [formData, setFormData] = useState<VacancyCreateFormData>({
    title: "",
    level: "",
    city: "",
    workType: "",
    responses: 0,
    description: "",
    status: "draft",
  });

  const { data: vacancyLookupsData } =
    api.lookups.getVacancyCreateOptions.useQuery();
  const vacancyLookups = vacancyLookupsData ?? DEFAULT_VACANCY_LOOKUPS;

  const createVacancy = api.vacancies.createVacancy.useMutation({
    onSuccess: async () => {
      await utils.vacancies.getAllVacancies.invalidate();
      router.push("/vacancies");
    },
    onError: (error) => {
      setErrors((prev) => ({
        ...prev,
        _form: error.message || "Не удалось создать вакансию",
      }));
    },
  });

  const progress = useMemo(() => {
    let filled = 0;
    const missing: string[] = [];

    for (const field of REQUIRED_FIELDS) {
      const value = formData[field.key];
      if (typeof value === "string" && value.trim() !== "") {
        filled += 1;
      } else {
        missing.push(field.label);
      }
    }

    return {
      percentage: Math.round((filled / REQUIRED_FIELDS.length) * 100),
      filled,
      total: REQUIRED_FIELDS.length,
      missing,
    };
  }, [formData]);

  const handleInputChange = <K extends keyof VacancyCreateFormData>(
    field: K,
    value: VacancyCreateFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "title" && errors.title) {
      setErrors((prev) => ({ ...prev, title: undefined }));
    }
  };

  const handleSubmit = () => {
    const title = formData.title.trim();

    if (!title) {
      setErrors((prev) => ({
        ...prev,
        title: "Введите название вакансии",
      }));
      return;
    }

    setErrors({});
    createVacancy.mutate({
      title,
      level: formData.level.trim() || undefined,
      city: formData.city.trim() || undefined,
      workType: formData.workType.trim() || undefined,
      responses: Math.max(0, Number(formData.responses) || 0),
      status: formData.status,
    });
  };

  return (
    <main className="h-full bg-white">
      <div className="mx-auto w-full max-w-[1280px] px-4 pt-8 pb-10 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
            Добавление вакансии
          </h1>
          <Dropdown
            fieldClassName="h-8 px-2 py-2 pr-6 text-[14px] leading-none tracking-[-0.28px]"
            hideLabel
            iconClassName="right-2 h-4 w-4 text-text-placeholder"
            label="Статус"
            onChange={(value) => {
              if (isVacancyStatus(value)) {
                handleInputChange("status", value);
              }
            }}
            options={vacancyLookups.statusOptions}
            value={formData.status}
          />
        </div>

        <FormProgress
          filled={progress.filled}
          missing={progress.missing}
          percentage={progress.percentage}
          total={progress.total}
        />

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
          <div className="w-full lg:max-w-[300px]">
            <SideMenu
              activeId={activeSectionId}
              items={SIDE_MENU_ITEMS}
              onSelect={setActiveSectionId}
            />
          </div>

          <section className="min-w-0 flex-1 rounded-[8px] border border-border-input bg-white p-4 lg:p-6">
            <h2 className="mb-6 font-semibold text-[24px] text-text-heading leading-none tracking-[-0.48px]">
              Описание вакансии
            </h2>

            {/* <VacancyDescription
              
              city={formData.city}
              level={formData.level}
              title={formData.title}
            /> */}

            {errors.title && (
              <div className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
                {errors.title}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                className="rounded-[8px] bg-primary-blue px-5 py-2.5 font-medium text-[14px] text-white transition-colors hover:bg-primary-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={createVacancy.isPending}
                onClick={handleSubmit}
                type="button"
              >
                {createVacancy.isPending
                  ? "Сохранение..."
                  : "Сохранить вакансию"}
              </button>
            </div>

            {errors._form && (
              <div className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
                {errors._form}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
