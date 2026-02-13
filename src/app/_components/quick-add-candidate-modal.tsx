"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "~/app/candidates/create/components/dropdown";
import { DEFAULT_CANDIDATE_LOOKUPS } from "~/shared/candidate-lookups";
import {
  AIGenerationIcon,
  FileUploadIcon,
  SmallChevronDownIcon,
} from "./icons";

type SelectOption = { value: string; label: string };

export type QuickAddCandidatePayload = {
  fullName: string;
  contactType: string;
  contactValue: string;
  source: string;
};

type QuickAddCandidateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddMoreData?: () => void;
  onSaveCandidate?: (payload: QuickAddCandidatePayload) => void;
  isSaving?: boolean;
  errorMessage?: string | null;
  contactTypeOptions?: SelectOption[];
  sourceOptions?: SelectOption[];
};

export function QuickAddCandidateModal({
  isOpen,
  onClose,
  onAddMoreData,
  onSaveCandidate,
  isSaving = false,
  errorMessage,
  contactTypeOptions = DEFAULT_CANDIDATE_LOOKUPS.contactTypes,
  sourceOptions = DEFAULT_CANDIDATE_LOOKUPS.sources,
}: QuickAddCandidateModalProps) {
  const dialogPanelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [fullName, setFullName] = useState("");
  const [contactValue, setContactValue] = useState("");
  const [contactType, setContactType] = useState(
    contactTypeOptions[0]?.value ?? "",
  );
  const [source, setSource] = useState(sourceOptions[0]?.value ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setContactType(contactTypeOptions[0]?.value ?? "");
  }, [contactTypeOptions]);

  useEffect(() => {
    setSource(sourceOptions[0]?.value ?? "");
  }, [sourceOptions]);

  useEffect(() => {
    if (!isOpen) {
      setFullName("");
      setContactValue("");
      setContactType(contactTypeOptions[0]?.value ?? "");
      setSource(sourceOptions[0]?.value ?? "");
      setLocalError(null);
    }
  }, [contactTypeOptions, isOpen, sourceOptions]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousActiveElementRef.current =
      document.activeElement as HTMLElement | null;
    dialogPanelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = dialogPanelRef.current;
      if (!panel) {
        return;
      }

      const focusableSelectors = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ];

      const focusableElements = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelectors.join(",")),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    if (!fullName.trim()) {
      setLocalError("Введите Ф.И.О");
      return;
    }

    setLocalError(null);
    onSaveCandidate?.({
      fullName: fullName.trim(),
      contactType,
      contactValue: contactValue.trim(),
      source,
    });
  };

  return (
    <div
      aria-labelledby="quick-add-candidate-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      role="dialog"
    >
      <button
        aria-label="Закрыть модальное окно"
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        type="button"
      />

      <div
        className="relative w-full max-w-[500px] rounded-[8px] border border-border-input bg-white p-5 shadow-[6px_6px_26.2px_0px_rgba(43,48,66,0.10)]"
        ref={dialogPanelRef}
        tabIndex={-1}
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2
              className="font-semibold text-[20px] text-text-heading leading-[1.1] tracking-[-0.4px]"
              id="quick-add-candidate-modal-title"
            >
              Быстрое добавление кандидата
            </h2>
            <button
              className="flex items-center gap-2 rounded-[6px] border border-border-input bg-bg-input p-2 text-[14px] text-text-placeholder leading-none tracking-[-0.28px]"
              type="button"
            >
              Новый
              <SmallChevronDownIcon className="h-[10px] w-[10px]" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label
              className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
              htmlFor="quick-add-fullname"
            >
              Ф.И.О
            </label>
            <input
              className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
              id="quick-add-fullname"
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Введите полное имя"
              type="text"
              value={fullName}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]">
                Контакты
              </p>
              <button
                className="text-[30px] text-primary-blue leading-none"
                type="button"
              >
                +
              </button>
            </div>
            <div className="flex items-end gap-4">
              <input
                className="h-12 w-full max-w-[294px] rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                onChange={(event) => setContactValue(event.target.value)}
                placeholder="@username или номер телефона"
                type="text"
                value={contactValue}
              />
              <Dropdown
                className="min-w-[150px]"
                fieldClassName="h-12 bg-bg-input"
                hideLabel
                iconClassName="h-5 w-5 right-2 text-text-placeholder"
                id="quick-add-contact-type"
                label="Тип контакта"
                onChange={setContactType}
                options={contactTypeOptions}
                value={contactType}
              />
            </div>
          </div>

          <Dropdown
            fieldClassName="bg-bg-input"
            id="quick-add-source"
            label="Источник"
            onChange={setSource}
            options={sourceOptions}
            value={source}
          />

          <div className="flex flex-col gap-1">
            <p className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]">
              Резюме
            </p>
            <div className="flex h-24 w-full flex-col items-center justify-center rounded-[6px] border border-border-input border-dashed bg-bg-input px-3 py-[14px]">
              <div className="flex items-center gap-2">
                <FileUploadIcon className="h-5 w-5 text-text-placeholder" />
                <span className="font-medium text-[16px] text-text-placeholder leading-[1.4] tracking-[-0.32px]">
                  Upload pdf file
                </span>
              </div>
              <p className="font-normal text-[12px] text-text-disabled leading-[1.4] tracking-[-0.24px]">
                File should be less than 120MB
              </p>
            </div>
            <p className="flex gap-1 font-medium text-[#9747FF] text-[12px] leading-[1.4] tracking-[-0.24px]">
              <span className="flex font-bold">
                <AIGenerationIcon />
                AI
              </span>
              Мы проанализируем резюме и сохраним информацию о кандидате
            </p>
          </div>

          {(localError ?? errorMessage) && (
            <p className="text-[14px] text-accent-red tracking-[-0.28px]">
              {localError ?? errorMessage}
            </p>
          )}

          <div className="flex h-10 items-start justify-between">
            <Link
              className="flex h-full w-[240px] items-center justify-center rounded-[6px] bg-primary-blue-light p-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px]"
              href="/candidates/create"
              onClick={onAddMoreData}
            >
              Добавить больше данных
            </Link>
            <button
              className="flex h-full items-center justify-center rounded-[6px] bg-primary-blue p-4 font-semibold text-[16px] text-white leading-none tracking-[-0.32px] disabled:opacity-60"
              disabled={isSaving}
              onClick={handleSave}
              type="button"
            >
              {isSaving ? "Сохранение..." : "Сохранить кандидата"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
