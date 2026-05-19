"use client";

import type { ConditionsSectionProps } from "~/types/candidates/conditions-section";
import { Dropdown } from "../../_components/dropdown";
import { ChevronUpIcon, CloseIcon, PlusIcon } from "../../_components/icons";
import { Input } from "../../_components/input";

export function ConditionsSection({
  isOpen,
  onToggle,
  errors,
  salaryExpectation,
  salaryCurrency,
  onSalaryChange,
  onCurrencyChange,
  skills,
  skillsOptions,
  onToggleSkill,
  onRemoveSkill,
  languages,
  languageOptions,
  languageLevelOptions,
  onAddLanguage,
  onRemoveLanguage,
  onLanguageChange,
}: ConditionsSectionProps) {
  return (
    <div className="mb-6">
      <button
        className="flex w-full items-center justify-between py-4"
        onClick={onToggle}
        type="button"
      >
        <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
          Условия
        </h2>
        <ChevronUpIcon
          className={`h-4 w-4 text-text-placeholder transition-transform ${
            isOpen ? "" : "rotate-180"
          }`}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-6 pt-2">
          <Input
            endAdornment={
              <div className="flex overflow-hidden rounded-md border border-border-input">
                <button
                  aria-pressed={salaryCurrency === "UZS"}
                  className={`px-2 py-1.5 font-semibold text-[12px] tracking-[-0.24px] ${
                    salaryCurrency === "UZS"
                      ? "bg-primary-blue-light text-primary-blue"
                      : "bg-bg-light text-text-disabled"
                  }`}
                  onClick={() => onCurrencyChange("UZS")}
                  type="button"
                >
                  UZS
                </button>
                <button
                  aria-pressed={salaryCurrency === "USD"}
                  className={`px-2 py-1.5 font-semibold text-[12px] tracking-[-0.24px] ${
                    salaryCurrency === "USD"
                      ? "bg-primary-blue-light text-primary-blue"
                      : "bg-bg-light text-text-disabled"
                  }`}
                  onClick={() => onCurrencyChange("USD")}
                  type="button"
                >
                  USD
                </button>
              </div>
            }
            id="salaryExpectation"
            inputClassName="placeholder:text-text-placeholder"
            label="Зарплата"
            onChange={(e) =>
              onSalaryChange(
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            placeholder="Введите сумму"
            type="number"
            value={salaryExpectation ?? ""}
          />

          <div className="flex flex-col gap-2">
            <Dropdown
              iconClassName="h-5 w-5 text-text-placeholder"
              id="skills"
              label="Ключевые навыки"
              onChange={(value) => {
                if (value) {
                  onToggleSkill(value);
                }
              }}
              options={skillsOptions.map((skill) => ({
                value: skill,
                label: skill,
              }))}
              placeholder={
                skills.length > 0
                  ? `${skills.length} навыков выбрано`
                  : "Выберите навыки"
              }
              value=""
            />

            {skills.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-primary-blue-light px-2 py-1 text-[14px] text-primary-blue"
                    key={skill}
                  >
                    <button onClick={() => onRemoveSkill(skill)} type="button">
                      <CloseIcon className="h-3 w-3" />
                    </button>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]">
                Языки
              </span>
              <button
                className="text-primary-blue hover:text-primary-blue/80"
                onClick={onAddLanguage}
                type="button"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
            {languages.map((language, index) => {
              const languageError =
                errors[`languages.${index}.name`] ??
                errors[`languages.${index}.level`];

              return (
                <div className="flex flex-col gap-1" key={language.id}>
                  <div className="flex items-center gap-2">
                    <Dropdown
                      className="flex-1"
                      hideLabel
                      iconClassName="h-5 w-5 text-text-placeholder"
                      label="Язык"
                      onChange={(value) =>
                        onLanguageChange(language.id, "name", value)
                      }
                      options={languageOptions.map((lang) => ({
                        value: lang.label,
                        label: lang.label,
                      }))}
                      placeholder="Выберите язык"
                      value={language.name}
                    />
                    <Dropdown
                      className="w-40"
                      hideLabel
                      iconClassName="h-5 w-5 text-text-placeholder"
                      label="Уровень"
                      onChange={(value) =>
                        onLanguageChange(language.id, "level", value)
                      }
                      options={languageLevelOptions}
                      placeholder="Уровень"
                      value={language.level}
                    />
                    {languages.length > 1 && (
                      <button
                        className="text-text-disabled hover:text-accent-red"
                        onClick={() => onRemoveLanguage(language.id)}
                        type="button"
                      >
                        <CloseIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  {languageError && (
                    <p className="text-[12px] text-danger-red">
                      {languageError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
