"use client";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  PlusIcon,
} from "../../../_components/icons";
import type { LanguageItem, SelectOption } from "./types";

interface ConditionsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  salaryExpectation?: number;
  salaryCurrency: "UZS" | "USD";
  onSalaryChange: (value?: number) => void;
  onCurrencyChange: (value: "UZS" | "USD") => void;
  skills: string[];
  skillsOptions: string[];
  onToggleSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
  skillsDropdownOpen: boolean;
  onToggleSkillsDropdown: () => void;
  languages: LanguageItem[];
  languageOptions: SelectOption[];
  languageLevelOptions: SelectOption[];
  onAddLanguage: () => void;
  onRemoveLanguage: (id: string) => void;
  onLanguageChange: (
    id: string,
    field: "name" | "level",
    value: string,
  ) => void;
}

export function ConditionsSection({
  isOpen,
  onToggle,
  salaryExpectation,
  salaryCurrency,
  onSalaryChange,
  onCurrencyChange,
  skills,
  skillsOptions,
  onToggleSkill,
  onRemoveSkill,
  skillsDropdownOpen,
  onToggleSkillsDropdown,
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
        <h2 className="font-semibold text-[#1c1c1e] text-[22px] leading-[1.1] tracking-[-0.44px]">
          Условия
        </h2>
        <ChevronUpIcon
          className={`h-4 w-4 text-[#707a8d] transition-transform ${
            isOpen ? "" : "rotate-180"
          }`}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-6 pt-2">
          <div className="flex flex-col gap-2">
            <label
              className="font-medium text-[#21272a] text-[16px] leading-[1.4] tracking-[-0.32px]"
              htmlFor="salaryExpectation"
            >
              Зарплата
            </label>
            <div className="flex h-11 items-center overflow-hidden rounded-md border border-[#e5e9f2] bg-white">
              <input
                className="h-full flex-1 border-none bg-transparent px-3 text-[#1c1c1e] text-[16px] leading-[1.4] tracking-[-0.32px] placeholder-[#707a8d] focus:outline-none"
                id="salaryExpectation"
                onChange={(e) =>
                  onSalaryChange(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="Введите сумму"
                type="number"
                value={salaryExpectation ?? ""}
              />
              <div className="mr-2 flex overflow-hidden rounded-md border border-[#e5e9f2]">
                <button
                  className={`px-2 py-1.5 font-semibold text-[12px] tracking-[-0.24px] ${
                    salaryCurrency === "UZS"
                      ? "bg-[rgba(68,145,255,0.16)] text-primary-blue"
                      : "bg-white text-[#c1c8d4]"
                  }`}
                  onClick={() => onCurrencyChange("UZS")}
                  type="button"
                >
                  UZS
                </button>
                <button
                  className={`px-2 py-1.5 font-semibold text-[12px] tracking-[-0.24px] ${
                    salaryCurrency === "USD"
                      ? "bg-[rgba(68,145,255,0.16)] text-primary-blue"
                      : "bg-white text-[#c1c8d4]"
                  }`}
                  onClick={() => onCurrencyChange("USD")}
                  type="button"
                >
                  USD
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-medium text-[#21272a] text-[16px] leading-[1.4] tracking-[-0.32px]">
              Ключевые навыки
            </span>
            <div className="relative">
              <button
                className="flex h-11 w-full items-center justify-between rounded-md border border-[#e5e9f2] bg-white px-3 text-left text-[16px] leading-[1.4] tracking-[-0.32px] focus:border-primary-blue focus:outline-none"
                onClick={onToggleSkillsDropdown}
                type="button"
              >
                <span
                  className={
                    skills.length > 0 ? "text-[#1c1c1e]" : "text-[#707a8d]"
                  }
                >
                  {skills.length > 0
                    ? `${skills.length} навыков выбрано`
                    : "Выберите навыки"}
                </span>
                <ChevronDownIcon className="h-5 w-5 text-[#707a8d]" />
              </button>

              {skillsDropdownOpen && skillsOptions.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-[#e5e9f2] bg-white shadow-lg">
                  {skillsOptions.map((skill) => (
                    <button
                      className={`w-full px-3 py-2 text-left text-[14px] hover:bg-[#f1f4f8] ${
                        skills.includes(skill)
                          ? "bg-[rgba(68,145,255,0.16)] text-primary-blue"
                          : "text-[#1c1c1e]"
                      }`}
                      key={skill}
                      onClick={() => onToggleSkill(skill)}
                      type="button"
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {skills.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-[rgba(68,145,255,0.16)] px-2 py-1 text-[14px] text-primary-blue"
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
              <span className="font-medium text-[#21272a] text-[16px] leading-[1.4] tracking-[-0.32px]">
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
            {languages.map((language) => (
              <div className="flex items-center gap-2" key={language.id}>
                <div className="relative flex-1">
                  <select
                    className="h-11 w-full appearance-none rounded-md border border-[#e5e9f2] bg-white px-3 pr-10 text-[#707a8d] text-[16px] leading-[1.4] tracking-[-0.32px] focus:border-primary-blue focus:outline-none"
                    onChange={(e) =>
                      onLanguageChange(language.id, "name", e.target.value)
                    }
                    value={language.name}
                  >
                    <option value="">Выберите язык</option>
                    {languageOptions.map((lang) => (
                      <option key={lang.value} value={lang.label}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-[#707a8d]" />
                </div>
                <div className="relative w-40">
                  <select
                    className="h-11 w-full appearance-none rounded-md border border-[#e5e9f2] bg-white px-3 pr-10 text-[#707a8d] text-[16px] leading-[1.4] tracking-[-0.32px] focus:border-primary-blue focus:outline-none"
                    onChange={(e) =>
                      onLanguageChange(language.id, "level", e.target.value)
                    }
                    value={language.level}
                  >
                    <option value="">Уровень</option>
                    {languageLevelOptions.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-[#707a8d]" />
                </div>
                {languages.length > 1 && (
                  <button
                    className="text-[#c1c8d4] hover:text-[#e01d5e]"
                    onClick={() => onRemoveLanguage(language.id)}
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
  );
}
