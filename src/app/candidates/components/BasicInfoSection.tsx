"use client";

import { ChevronUpIcon, CloseIcon, PlusIcon } from "~/app/_components/icons";
import type { BasicInfoSectionProps } from "~/types/candidates/basic-info-section";
import { Dropdown } from "../../_components/dropdown";
import { Input } from "../../_components/input";

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
    <section className="surface-card mb-5 p-5 sm:p-6">
      <button
        className="flex w-full items-center justify-between"
        onClick={onToggle}
        type="button"
      >
        <h2 className="section-title">Основная информация</h2>
        <ChevronUpIcon
          className={`h-4 w-4 text-text-placeholder transition-transform ${
            isOpen ? "" : "rotate-180"
          }`}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-5 pt-5">
          <div className="flex flex-col gap-2">
            <Input
              className={errors.fullName ? "border-danger-red" : undefined}
              id="fullName"
              label="Ф.И.О"
              onChange={(e) => onInputChange("fullName", e.target.value)}
              placeholder="Введите полное имя"
              type="text"
              value={fullName}
            />
            {errors.fullName && (
              <p className="text-danger-red text-xs">{errors.fullName}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-1 flex-col gap-2">
              <Input
                className={errors.city ? "border-danger-red" : undefined}
                id="city"
                label="Город"
                onChange={(e) => onInputChange("city", e.target.value)}
                placeholder="Введите город"
                type="text"
                value={city}
              />
              {errors.city && (
                <p className="text-danger-red text-xs">{errors.city}</p>
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
              <span className="font-semibold text-sm text-text-label leading-5">
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
              <div
                className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
                key={contact.id}
              >
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
                  className="min-w-0 flex-1 sm:min-w-52"
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
    </section>
  );
}
