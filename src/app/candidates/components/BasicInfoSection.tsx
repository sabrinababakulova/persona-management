"use client";

import { ChevronUpIcon, CloseIcon, PlusIcon } from "~/app/_components/icons";
import { Dropdown } from "../../_components/dropdown";
import { Input } from "../../_components/input";
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
  contactSources: SelectOption[];
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
  contactSources,
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
            <Input
              className={errors.fullName ? "border-red-500" : undefined}
              id="fullName"
              label="Ф.И.О"
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
              <Input
                className={errors.city ? "border-red-500" : undefined}
                id="city"
                label="Город"
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
              <Dropdown
                id="currentPosition"
                label="Должность"
                onChange={(value) => onInputChange("currentPosition", value)}
                options={positions}
                placeholder="Выберите должность"
                value={currentPosition}
              />
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
              <div className="flex w-full items-center gap-2" key={contact.id}>
                <div className="min-w-0 flex-1">
                  <Input
                    hideLabel
                    label="Контакт"
                    onChange={(e) =>
                      onContactChange(contact.id, "value", e.target.value)
                    }
                    placeholder="@username или номер телефона"
                    type="text"
                    value={contact.value}
                  />
                </div>
                <Dropdown
                  className="min-w-[220px] flex-1"
                  hideLabel
                  iconClassName="h-4 w-4 right-2 text-text-placeholder"
                  label="Тип контакта"
                  onChange={(value) =>
                    onContactChange(contact.id, "type", value)
                  }
                  options={contactSources}
                  value={contact.type}
                />
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
            <Dropdown
              id="source"
              label="Источник"
              onChange={(value) => onInputChange("source", value)}
              options={sources}
              placeholder="Выберите источник"
              value={source}
            />
          </div>
        </div>
      )}
    </div>
  );
}
