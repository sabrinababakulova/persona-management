"use client";

import { ChevronUpIcon, CloseIcon, PlusIcon } from "~/app/_components/icons";
import { Input } from "~/app/_components/input";
import { Textarea } from "~/app/_components/textarea";
import type { BackgroundDetailsSectionProps } from "~/types/candidates/background-details-section";

function getFieldError(
  errors: BackgroundDetailsSectionProps["errors"],
  path: string,
) {
  return errors[path];
}

export function BackgroundDetailsSection({
  isOpen,
  onToggle,
  errors,
  workExperience,
  education,
  onAddWorkExperience,
  onRemoveWorkExperience,
  onWorkExperienceChange,
  onAddEducation,
  onRemoveEducation,
  onEducationChange,
}: BackgroundDetailsSectionProps) {
  return (
    <div className="mb-6">
      <button
        className="flex w-full items-center justify-between py-4"
        onClick={onToggle}
        type="button"
      >
        <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
          Опыт и образование
        </h2>
        <ChevronUpIcon
          className={`h-4 w-4 text-text-placeholder transition-transform ${
            isOpen ? "" : "rotate-180"
          }`}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-8 pt-2">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[18px] text-text-heading leading-[1.2] tracking-[-0.36px]">
                Опыт работы
              </h3>
              <button
                className="text-primary-blue hover:text-primary-blue-hover"
                onClick={onAddWorkExperience}
                type="button"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>

            {workExperience.map((item, index) => (
              <div
                className="rounded-[8px] border border-border-input bg-bg-input p-4"
                key={item.id}
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-medium text-[16px] text-text-heading leading-[1.3] tracking-[-0.32px]">
                    Место работы {index + 1}
                  </p>
                  {workExperience.length > 1 && (
                    <button
                      className="text-text-disabled hover:text-accent-red"
                      onClick={() => onRemoveWorkExperience(item.id)}
                      type="button"
                    >
                      <CloseIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Input
                        className={
                          getFieldError(
                            errors,
                            `workExperience.${index}.company`,
                          )
                            ? "border-red-500"
                            : undefined
                        }
                        label="Компания"
                        onChange={(event) =>
                          onWorkExperienceChange(
                            item.id,
                            "company",
                            event.target.value,
                          )
                        }
                        placeholder="Например, Tech Solutions Inc."
                        type="text"
                        value={item.company}
                      />
                      {getFieldError(
                        errors,
                        `workExperience.${index}.company`,
                      ) && (
                        <p className="text-[12px] text-red-500">
                          {getFieldError(
                            errors,
                            `workExperience.${index}.company`,
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Input
                        className={
                          getFieldError(
                            errors,
                            `workExperience.${index}.position`,
                          )
                            ? "border-red-500"
                            : undefined
                        }
                        label="Должность"
                        onChange={(event) =>
                          onWorkExperienceChange(
                            item.id,
                            "position",
                            event.target.value,
                          )
                        }
                        placeholder="Например, Network Engineer"
                        type="text"
                        value={item.position}
                      />
                      {getFieldError(
                        errors,
                        `workExperience.${index}.position`,
                      ) && (
                        <p className="text-[12px] text-red-500">
                          {getFieldError(
                            errors,
                            `workExperience.${index}.position`,
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Input
                      className={
                        getFieldError(errors, `workExperience.${index}.period`)
                          ? "border-red-500"
                          : undefined
                      }
                      label="Период"
                      onChange={(event) =>
                        onWorkExperienceChange(
                          item.id,
                          "period",
                          event.target.value,
                        )
                      }
                      placeholder="Например, Январь 2024 - Сейчас"
                      type="text"
                      value={item.period}
                    />
                    {getFieldError(
                      errors,
                      `workExperience.${index}.period`,
                    ) && (
                      <p className="text-[12px] text-red-500">
                        {getFieldError(
                          errors,
                          `workExperience.${index}.period`,
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Textarea
                      className={
                        getFieldError(
                          errors,
                          `workExperience.${index}.description`,
                        )
                          ? "border-red-500"
                          : undefined
                      }
                      label="Описание обязанностей"
                      onChange={(event) =>
                        onWorkExperienceChange(
                          item.id,
                          "description",
                          event.target.value,
                        )
                      }
                      placeholder={
                        "Каждая новая строка будет сохранена как отдельный пункт"
                      }
                      value={item.description}
                    />
                    {getFieldError(
                      errors,
                      `workExperience.${index}.description`,
                    ) && (
                      <p className="text-[12px] text-red-500">
                        {getFieldError(
                          errors,
                          `workExperience.${index}.description`,
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[18px] text-text-heading leading-[1.2] tracking-[-0.36px]">
                Образование
              </h3>
              <button
                className="text-primary-blue hover:text-primary-blue-hover"
                onClick={onAddEducation}
                type="button"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>

            {education.map((item, index) => (
              <div
                className="rounded-[8px] border border-border-input bg-bg-input p-4"
                key={item.id}
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-medium text-[16px] text-text-heading leading-[1.3] tracking-[-0.32px]">
                    Образование {index + 1}
                  </p>
                  {education.length > 1 && (
                    <button
                      className="text-text-disabled hover:text-accent-red"
                      onClick={() => onRemoveEducation(item.id)}
                      type="button"
                    >
                      <CloseIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <Input
                        className={
                          getFieldError(
                            errors,
                            `education.${index}.institution`,
                          )
                            ? "border-red-500"
                            : undefined
                        }
                        label="Учебное заведение"
                        onChange={(event) =>
                          onEducationChange(
                            item.id,
                            "institution",
                            event.target.value,
                          )
                        }
                        placeholder="Например, Inha University in Tashkent"
                        type="text"
                        value={item.institution}
                      />
                      {getFieldError(
                        errors,
                        `education.${index}.institution`,
                      ) && (
                        <p className="text-[12px] text-red-500">
                          {getFieldError(
                            errors,
                            `education.${index}.institution`,
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Input
                        className={
                          getFieldError(errors, `education.${index}.gpa`)
                            ? "border-red-500"
                            : undefined
                        }
                        label="GPA / оценка"
                        onChange={(event) =>
                          onEducationChange(item.id, "gpa", event.target.value)
                        }
                        placeholder="Например, GPA 4.5"
                        type="text"
                        value={item.gpa}
                      />
                      {getFieldError(errors, `education.${index}.gpa`) && (
                        <p className="text-[12px] text-red-500">
                          {getFieldError(errors, `education.${index}.gpa`)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Input
                        className={
                          getFieldError(errors, `education.${index}.period`)
                            ? "border-red-500"
                            : undefined
                        }
                        label="Период обучения"
                        onChange={(event) =>
                          onEducationChange(
                            item.id,
                            "period",
                            event.target.value,
                          )
                        }
                        placeholder="Например, Январь 2020 - Июнь 2024"
                        type="text"
                        value={item.period}
                      />
                      {getFieldError(errors, `education.${index}.period`) && (
                        <p className="text-[12px] text-red-500">
                          {getFieldError(errors, `education.${index}.period`)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
