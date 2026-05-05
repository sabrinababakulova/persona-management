"use client";

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
import { usePresence } from "./use-presence";

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
  placeholder = "Выберите значение",
  value,
  onChange,
  id,
  hideLabel = false,
  className,
  fieldClassName,
  iconClassName,
  disabled = false,
  searchPlaceholder = "Поиск",
  emptyMessage = "Ничего не найдено",
}: SearchableSelectProps) {
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
  const { shouldRender, isVisible } = usePresence(isOpen, 180);

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
    if (!isOpen || !shouldRender) {
      return;
    }

    updatePanelPosition();

    const frameId = window.requestAnimationFrame(() => {
      updatePanelPosition();
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen, shouldRender, updatePanelPosition]);

  const selectedLabel = selectedOption?.label ?? placeholder;

  return (
    <div
      className={`flex flex-col gap-1 ${className ?? ""}`}
      ref={containerRef}
    >
      <div className="flex w-full flex-col gap-2">
        <label
          className={
            hideLabel
              ? "sr-only"
              : "w-full font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
          }
          htmlFor={selectId}
        >
          {label}
        </label>

        <div className="relative">
          <button
            aria-controls={panelId}
            aria-expanded={isOpen}
            className={`flex h-12 w-full items-center justify-between gap-2 rounded-md border border-border-input bg-bg-input px-3 text-left text-[16px] leading-[1.4] tracking-[-0.32px] transition-[border-color,background-color,box-shadow,color] duration-200 ease-out hover:border-border-control hover:bg-white focus:border-primary-blue focus:bg-white focus:outline-none ${
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
              className={`h-6 w-6 shrink-0 text-text-secondary transition-[transform,color] duration-200 ease-out ${
                isOpen ? "-rotate-180 text-primary-blue" : ""
              } ${iconClassName ?? ""}`}
            />
          </button>

          {shouldRender &&
            panelPosition &&
            createPortal(
              <div
                className={`overflow-hidden rounded-lg border border-border-input bg-bg-light shadow-toast transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isVisible
                    ? "translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
                }`}
                id={panelId}
                ref={panelRef}
                style={{
                  left: panelPosition.left,
                  position: "fixed",
                  top: panelPosition.top,
                  width: panelPosition.width,
                  zIndex: 1000,
                }}
              >
                <div className="border-border-input border-b p-3">
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-placeholder" />
                    <input
                      className="h-10 w-full rounded-md border border-border-input bg-bg-input py-2 pr-3 pl-10 text-[14px] text-text-heading outline-none transition-[border-color,background-color] placeholder:text-text-placeholder hover:bg-white focus:border-primary-blue focus:bg-white"
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={searchPlaceholder}
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                    />
                  </div>
                </div>

                <div className="max-h-[500px] overflow-y-auto p-2">
                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((option) => (
                      <button
                        className={`flex min-h-10 w-full items-center rounded-md px-3 py-2 text-left text-[14px] leading-[1.35] transition-colors hover:bg-bg-input ${
                          value === option.value
                            ? "bg-primary-blue-light/60 text-primary-blue"
                            : "text-text-heading"
                        }`}
                        key={option.value}
                        onClick={() => {
                          onChange(option.value);
                          setSearchQuery("");
                          setIsOpen(false);
                        }}
                        title={option.label}
                        type="button"
                      >
                        <span className="min-w-0 truncate">{option.label}</span>
                      </button>
                    ))
                  ) : (
                    <div className="flex min-h-28 items-center justify-center px-3 text-center text-[14px] text-text-placeholder">
                      {emptyMessage}
                    </div>
                  )}
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>
    </div>
  );
}
