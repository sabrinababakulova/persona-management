"use client";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  PlusIcon,
} from "../../../_components/icons";
import type { ContactItem, Errors, SelectOption } from "./types";

interface BasicInfoSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  errors: Errors;
  fullName: string;
  city: string;
  currentPosition: string;
  source: string;
  contacts: ContactItem[];
  contactTypes: SelectOption[];
  positions: SelectOption[];
  sources: SelectOption[];
  onInputChange: (
    field: "fullName" | "city" | "currentPosition" | "source",
    value: string,
  ) => void;
  onAddContact: () => void;
  onRemoveContact: (id: string) => void;
  onContactChange: (id: string, field: "type" | "value", value: string) => void;
}

export function BasicInfoSection({
  isOpen,
  onToggle,
  errors,
  fullName,
  city,
  currentPosition,
  source,
  contacts,
  contactTypes,
  positions,
  sources,
  onInputChange,
  onAddContact,
  onRemoveContact,
  onContactChange,
}: BasicInfoSectionProps) {
  return (
    <div className="mb-6">
      <button
        className="flex w-full items-center justify-between py-4"
        onClick={onToggle}
        type="button"
      >
        <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
          Основная информация
        </h2>
        <ChevronUpIcon
          className={`h-4 w-4 text-text-placeholder transition-transform ${
            isOpen ? "" : "rotate-180"
          }`}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-6 pt-2">
          <div className="flex flex-col gap-2">
            <label
              className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
              htmlFor="fullName"
            >
              Ф.И.О
            </label>
            <input
              className={`h-11 w-full rounded-md border ${
                errors.fullName ? "border-red-500" : "border-border-input"
              } bg-white px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder-text-placeholder focus:border-primary-blue focus:outline-none`}
              id="fullName"
              onChange={(e) => onInputChange("fullName", e.target.value)}
              placeholder="Введите полное имя"
              type="text"
              value={fullName}
            />
            {errors.fullName && (
              <p className="text-[12px] text-red-500">{errors.fullName}</p>
            )}
          </div>

          <div className="flex gap-6">
            <div className="flex flex-1 flex-col gap-2">
              <label
                className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                htmlFor="city"
              >
                Город
              </label>
              <input
                className={`h-11 w-full rounded-md border ${
                  errors.city ? "border-red-500" : "border-border-input"
                } bg-white px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder-text-placeholder focus:border-primary-blue focus:outline-none`}
                id="city"
                onChange={(e) => onInputChange("city", e.target.value)}
                placeholder="Введите город"
                type="text"
                value={city}
              />
              {errors.city && (
                <p className="text-[12px] text-red-500">{errors.city}</p>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <label
                className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                htmlFor="currentPosition"
              >
                Должность
              </label>
              <div className="relative">
                <select
                  className="h-11 w-full appearance-none rounded-md border border-border-input bg-white px-3 pr-10 text-[16px] text-text-placeholder leading-[1.4] tracking-[-0.32px] focus:border-primary-blue focus:outline-none"
                  id="currentPosition"
                  onChange={(e) =>
                    onInputChange("currentPosition", e.target.value)
                  }
                  value={currentPosition}
                >
                  <option value="">Выберите должность</option>
                  {positions.map((position) => (
                    <option key={position.value} value={position.value}>
                      {position.label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-text-placeholder" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]">
                Контакты
              </span>
              <button
                className="text-primary-blue hover:text-primary-blue/80"
                onClick={onAddContact}
                type="button"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
            {contacts.map((contact) => (
              <div className="flex items-center gap-2" key={contact.id}>
                <input
                  className="h-11 flex-1 rounded-md border border-border-input bg-white px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder-text-placeholder focus:border-primary-blue focus:outline-none"
                  onChange={(e) =>
                    onContactChange(contact.id, "value", e.target.value)
                  }
                  placeholder="@username или номер телефона"
                  type="text"
                  value={contact.value}
                />
                <div className="relative">
                  <select
                    className="h-11 appearance-none rounded-md border border-border-input bg-white px-3 pr-8 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] focus:border-primary-blue focus:outline-none"
                    onChange={(e) =>
                      onContactChange(contact.id, "type", e.target.value)
                    }
                    value={contact.type}
                  >
                    {contactTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-text-placeholder" />
                </div>
                {contacts.length > 1 && (
                  <button
                    className="text-text-disabled hover:text-accent-red"
                    onClick={() => onRemoveContact(contact.id)}
                    type="button"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <label
              className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
              htmlFor="source"
            >
              Источник
            </label>
            <div className="relative">
              <select
                className="h-11 w-full appearance-none rounded-md border border-border-input bg-white px-3 pr-10 text-[16px] text-text-placeholder leading-[1.4] tracking-[-0.32px] focus:border-primary-blue focus:outline-none"
                id="source"
                onChange={(e) => onInputChange("source", e.target.value)}
                value={source}
              >
                <option value="">Выберите источник</option>
                {sources.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-text-placeholder" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
