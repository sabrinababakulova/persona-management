"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { SelectOption } from "~/types/candidates/components";
import { ChevronDownIcon, SearchIcon } from "./icons";
import { AnimatePresence, motion } from "./motion-system";

const SELECT_EASE = [0.22, 1, 0.36, 1] as const;

type SearchableSelectProps = {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  hideLabel?: boolean;
  className?: string;
  fieldClassName?: string;
  iconClassName?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase("ru");
}

export function SearchableSelect({
  label,
  options,
  placeholder,
  value,
  onChange,
  id,
  hideLabel = false,
  className,
  fieldClassName,
  iconClassName,
  disabled = false,
  searchPlaceholder,
  emptyMessage,
}: SearchableSelectProps) {
  const t = useTranslations("Components");
  const resolvedPlaceholder = placeholder ?? t("selectValue");
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("search");
  const resolvedEmptyMessage = emptyMessage ?? t("nothingFound");
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const panelId = `${selectId}-panel`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelPosition, setPanelPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      normalizeSearchValue(option.label).includes(normalizedQuery),
    );
  }, [options, searchQuery]);

  const updatePanelPosition = useCallback(() => {
    const buttonRect = buttonRef.current?.getBoundingClientRect();

    if (!buttonRect) {
      return;
    }

    setPanelPosition({
      left: buttonRect.left,
      top: buttonRect.bottom + 8,
      width: buttonRect.width,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      return;
    }

    searchInputRef.current?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isOpen, updatePanelPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePanelPosition();

    const frameId = window.requestAnimationFrame(() => {
      updatePanelPosition();
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen, updatePanelPosition]);

  const selectedLabel = selectedOption?.label ?? resolvedPlaceholder;

  return (
    <div
      className={`flex flex-col gap-1.5 ${className ?? ""}`}
      ref={containerRef}
    >
      <div className="flex w-full flex-col gap-1.5">
        <label
          className={
            hideLabel
              ? "sr-only"
              : "w-full font-semibold text-sm text-text-label leading-5"
          }
          htmlFor={selectId}
        >
          {label}
        </label>

        <div className="relative">
          <button
            aria-controls={panelId}
            aria-expanded={isOpen}
            className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border-input bg-bg-input px-3.5 text-left text-sm leading-5 transition-[border-color,background-color,box-shadow,color] duration-200 ease-out hover:border-border-control hover:bg-white focus:border-primary-blue focus:bg-white focus:outline-none ${
              value ? "text-text-heading" : "text-text-placeholder"
            } ${fieldClassName ?? ""} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
            disabled={disabled}
            id={selectId}
            onClick={() => {
              updatePanelPosition();
              setIsOpen((current) => !current);
            }}
            ref={buttonRef}
            type="button"
          >
            <span className="min-w-0 truncate">{selectedLabel}</span>
            <ChevronDownIcon
              className={`h-5 w-5 shrink-0 text-text-secondary transition-[transform,color] duration-200 ease-out ${
                isOpen ? "-rotate-180 text-primary-blue" : ""
              } ${iconClassName ?? ""}`}
            />
          </button>

          {panelPosition &&
            createPortal(
              <AnimatePresence>
                {isOpen ? (
                  <motion.div
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="overflow-hidden rounded-xl border border-border-input bg-bg-light shadow-menu"
                    exit={{ opacity: 0, scale: 0.985, y: -5 }}
                    id={panelId}
                    initial={{ opacity: 0, scale: 0.975, y: -8 }}
                    ref={panelRef}
                    style={{
                      left: panelPosition.left,
                      position: "fixed",
                      top: panelPosition.top,
                      transformOrigin: "top",
                      width: panelPosition.width,
                      zIndex: 1000,
                    }}
                    transition={{ duration: 0.2, ease: SELECT_EASE }}
                  >
                    <div className="border-border-input border-b p-3">
                      <div className="relative">
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-placeholder" />
                        <input
                          className="h-10 w-full rounded-lg border border-border-input bg-bg-input py-2 pr-3 pl-10 text-sm text-text-heading outline-none transition-[border-color,background-color] placeholder:text-text-placeholder hover:bg-white focus:border-primary-blue focus:bg-white"
                          onChange={(event) =>
                            setSearchQuery(event.target.value)
                          }
                          placeholder={resolvedSearchPlaceholder}
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                        />
                      </div>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto p-2">
                      {filteredOptions.length > 0 ? (
                        <motion.div layout>
                          {filteredOptions.map((option, index) => (
                            <motion.button
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm leading-5 transition-colors hover:bg-bg-input ${
                                value === option.value
                                  ? "bg-primary-blue-light/60 text-primary-blue"
                                  : "text-text-heading"
                              }`}
                              initial={{ opacity: 0, x: -4 }}
                              key={option.value}
                              layout
                              onClick={() => {
                                onChange(option.value);
                                setSearchQuery("");
                                setIsOpen(false);
                              }}
                              title={option.label}
                              transition={{
                                delay: Math.min(index * 0.018, 0.12),
                                duration: 0.16,
                              }}
                              type="button"
                              whileTap={{ scale: 0.985 }}
                            >
                              <span className="min-w-0 truncate">
                                {option.label}
                              </span>
                            </motion.button>
                          ))}
                        </motion.div>
                      ) : (
                        <motion.div
                          animate={{ opacity: 1, y: 0 }}
                          className="flex min-h-28 items-center justify-center px-3 text-center text-sm text-text-placeholder"
                          initial={{ opacity: 0, y: 4 }}
                        >
                          {resolvedEmptyMessage}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>,
              document.body,
            )}
        </div>
      </div>
    </div>
  );
}
