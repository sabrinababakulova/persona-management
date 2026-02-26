"use client";

import { useState } from "react";
import { Dropdown } from "~/app/_components/dropdown";
import { api } from "~/trpc/react";
import type { Vacancy } from "~/types/pages/vacancies-page";
import type { VacancyLookups } from "~/types/shared/vacancy-lookups";

function isVacancyStatus(value: string): value is Vacancy["status"] {
  return ["active", "draft", "paused", "closed", "archive"].includes(value);
}

type VacancyDescriptionEditProps = {
  title: string;
  level: string;
  city: string;
  vacancyId: string;
  status: Vacancy["status"];
  vacancyLookups: VacancyLookups;
};

export function VacancyDescription(props: VacancyDescriptionEditProps) {
  const { title, level, city, status } = props;

  const utils = api.useUtils();

  const [formError, setFormError] = useState<string>();
  const [isRecentlySaved, setIsRecentlySaved] = useState(false);

  const updateVacancy = api.vacancies.updateVacancy.useMutation({
    onSuccess: async () => {
      setFormError(undefined);
      setIsRecentlySaved(true);

      await Promise.all([
        utils.vacancies.getVacancyById.invalidate({ id: props.vacancyId }),
        utils.vacancies.getAllVacancies.invalidate(),
      ]);
    },
    onError: (error) => {
      setFormError(error.message || "Не удалось сохранить изменения");
      setIsRecentlySaved(false);
    },
  });

  const handleStatusChange = (value: string) => {
    if (!isVacancyStatus(value) || value === status) {
      return;
    }

    setIsRecentlySaved(false);
    updateVacancy.mutate(
      { id: props.vacancyId, status: value },
      {
        onError: () => {
          console.log("smth went wrong");
        },
      },
    );
  };

  return (
    <div>
      <div className="w-full bg-white pt-8 pb-6">
        <div className="flex w-full items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col items-start justify-center gap-2.5">
            <p className="truncate font-bold text-[32px] text-text-heading leading-none tracking-[-0.64px]">
              {title.trim() || "Название вакансии"}
            </p>
            <div className="flex items-center gap-2">
              <p className="font-medium text-[20px] text-text-secondary leading-none tracking-[-0.4px]">
                {level.trim() || "Уровень"}
              </p>
              <span
                aria-hidden="true"
                className="h-[14px] w-px bg-border-input"
              />
              <p className="font-medium text-[20px] text-text-secondary leading-none tracking-[-0.4px]">
                {city.trim() || "Город"}
              </p>
            </div>
          </div>

          <div className="w-[140px] shrink-0">
            <Dropdown
              fieldClassName="h-8 px-2 py-2 pr-6 text-[14px] leading-none tracking-[-0.28px]"
              hideLabel
              iconClassName="right-2 h-4 w-4 text-text-placeholder"
              label="Статус"
              onChange={handleStatusChange}
              options={props.vacancyLookups.statusOptions}
              value={status}
            />
          </div>
        </div>
      </div>

      {formError && (
        <div className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
          {formError}
        </div>
      )}

      {!formError && isRecentlySaved && (
        <div className="mt-4 rounded-[6px] border border-green-200 bg-green-50 px-3 py-2 text-[14px] text-green-700">
          Изменения сохранены
        </div>
      )}
    </div>
  );
}
