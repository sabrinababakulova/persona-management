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
    <section className="surface-card mb-5 p-5 sm:p-6">
      <button
        className="flex w-full items-center justify-between"
        onClick={onToggle}
        type="button"
      >
        <h2 className="section-title">Опыт и образование</h2>
        <ChevronUpIcon
          className={`h-4 w-4 text-text-placeholder transition-transform ${
            isOpen ? "" : "rotate-180"
          }`}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-6 pt-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg text-text-heading leading-tight">
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
                className="rounded-lg border border-border-input bg-bg-input p-4"
                key={item.id}
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-sm text-text-heading leading-5">
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
                            ? "border-danger-red"
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
                        <p className="text-danger-red text-xs">
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
                            ? "border-danger-red"
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
                        <p className="text-danger-red text-xs">
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
                          ? "border-danger-red"
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
                      <p className="text-danger-red text-xs">
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
                          ? "border-danger-red"
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
                      <p className="text-danger-red text-xs">
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
              <h3 className="font-semibold text-lg text-text-heading leading-tight">
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
                className="rounded-lg border border-border-input bg-bg-input p-4"
                key={item.id}
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-sm text-text-heading leading-5">
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
                            ? "border-danger-red"
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
                        <p className="text-danger-red text-xs">
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
                            ? "border-danger-red"
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
                        <p className="text-danger-red text-xs">
                          {getFieldError(errors, `education.${index}.gpa`)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Input
                        className={
                          getFieldError(errors, `education.${index}.period`)
                            ? "border-danger-red"
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
                        <p className="text-danger-red text-xs">
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
    </section>
  );
}
