"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { LookupOption } from "~/types/shared/candidate-lookups";
import { Checkbox } from "./checkbox";
import { Dropdown } from "./dropdown";
import { Input } from "./input";
import { Modal } from "./modal";

export type FilterModalFilters = {
  statuses: string[];
  city: string;
  sources: string[];
};

export const EMPTY_FILTER_MODAL_FILTERS: FilterModalFilters = {
  statuses: [],
  city: "",
  sources: [],
};

export function countActiveFilters(filters: FilterModalFilters): number {
  return (
    filters.statuses.length +
    (filters.city.trim() ? 1 : 0) +
    filters.sources.length
  );
}

type FilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterModalFilters) => void;
  initialFilters: FilterModalFilters;
  statusOptions: LookupOption[];
  cityOptions?: LookupOption[];
  sourceOptions?: LookupOption[];
};

export function FilterModal({
  isOpen,
  onClose,
  onApply,
  initialFilters,
  statusOptions,
  cityOptions,
  sourceOptions,
}: FilterModalProps) {
  const t = useTranslations("Components");
  const [draft, setDraft] = useState<FilterModalFilters>(initialFilters);
  const initialFiltersRef = useRef(initialFilters);

  useEffect(() => {
    initialFiltersRef.current = initialFilters;
  });

  useEffect(() => {
    if (isOpen) {
      setDraft(initialFiltersRef.current);
    }
  }, [isOpen]);

  const toggleStatus = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(value)
        ? prev.statuses.filter((s) => s !== value)
        : [...prev.statuses, value],
    }));
  };

  const toggleSource = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      sources: prev.sources.includes(value)
        ? prev.sources.filter((s) => s !== value)
        : [...prev.sources, value],
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      maxWidthClassName="max-w-[480px]"
      onClose={onClose}
      title={t("filters")}
    >
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-3 font-medium text-sm text-text-secondary">
            {t("status")}
          </div>
          <div className="flex flex-col gap-2.5">
            {statusOptions.map((option) => (
              <div className="flex items-center gap-3" key={option.value}>
                <Checkbox
                  checked={draft.statuses.includes(option.value)}
                  onChange={() => toggleStatus(option.value)}
                />
                <button
                  className="text-left text-sm text-text-heading"
                  onClick={() => toggleStatus(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-border-input" />

        <div>
          <div className="mb-3 font-medium text-sm text-text-secondary">
            {t("city")}
          </div>
          {cityOptions && cityOptions.length > 0 ? (
            <Dropdown
              hideLabel
              label={t("city")}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, city: value }))
              }
              options={cityOptions}
              placeholder={t("selectCity")}
              value={draft.city}
            />
          ) : (
            <Input
              hideLabel
              label={t("city")}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, city: e.target.value }))
              }
              placeholder={t("enterCity")}
              value={draft.city}
            />
          )}
        </div>

        {sourceOptions && sourceOptions.length > 0 && (
          <>
            <div className="h-px bg-border-input" />
            <div>
              <div className="mb-3 font-medium text-sm text-text-secondary">
                {t("source")}
              </div>
              <div className="flex flex-col gap-2.5">
                {sourceOptions.map((option) => (
                  <div className="flex items-center gap-3" key={option.value}>
                    <Checkbox
                      checked={draft.sources.includes(option.value)}
                      onChange={() => toggleSource(option.value)}
                    />
                    <button
                      className="text-left text-sm text-text-heading"
                      onClick={() => toggleSource(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-1">
          <button
            className="ui-button ui-button-secondary flex-1"
            onClick={() => onApply(EMPTY_FILTER_MODAL_FILTERS)}
            type="button"
          >
            {t("reset")}
          </button>
          <button
            className="ui-button ui-button-primary flex-1"
            onClick={() => onApply(draft)}
            type="button"
          >
            {t("apply")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
