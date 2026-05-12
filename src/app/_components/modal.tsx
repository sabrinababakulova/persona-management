"use client";

import { useEffect, useRef } from "react";
import type { ModalProps } from "~/types/components/modal-props";
import { CloseIcon } from "./icons";
import { usePresence } from "./use-presence";

export function Modal({
  isOpen,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  title,
  description,
  children,
  containerClassName,
  overlayClassName,
  panelClassName,
  contentClassName,
  maxWidthClassName = "max-w-[420px]",
  titleClassName,
  descriptionClassName,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  closeButtonLabel = "Закрыть модальное окно",
}: ModalProps) {
  const dialogPanelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  const { shouldRender, isVisible } = usePresence(isOpen, 220);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeOnEscapeRef.current = closeOnEscape;
  }, [closeOnEscape]);

  useEffect(() => {
    if (!shouldRender || !isOpen) {
      return;
    }

    previousActiveElementRef.current =
      document.activeElement as HTMLElement | null;
    dialogPanelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscapeRef.current) {
        onCloseRef.current();
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
  }, [isOpen, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  const titleId = title ? "modal-title" : undefined;
  const descriptionId = description ? "modal-description" : undefined;
  const labelledBy = ariaLabelledBy ?? titleId;
  const describedBy = ariaDescribedBy ?? descriptionId;

  return (
    <div
      aria-describedby={describedBy}
      aria-hidden={!isOpen}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-center justify-center p-5 transition-opacity duration-200 ease-out ${isVisible ? "opacity-100" : "pointer-events-none opacity-0"} ${containerClassName ?? ""}`}
      role="dialog"
    >
      <button
        aria-label={closeButtonLabel}
        className={`absolute inset-0 bg-text-heading/20 transition-opacity duration-200 ease-out ${isVisible ? "opacity-100" : "opacity-0"} ${overlayClassName ?? ""}`}
        data-motion="none"
        onClick={closeOnBackdropClick ? onClose : undefined}
        type="button"
      />

      <div
        className={`relative w-full rounded-[8px] border border-border-input bg-bg-light p-5 shadow-modal transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.98] opacity-0"} ${maxWidthClassName} ${panelClassName ?? ""}`}
        ref={dialogPanelRef}
        tabIndex={-1}
      >
        <button
          aria-label={closeButtonLabel}
          className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-text-placeholder transition-colors hover:bg-bg-hover hover:text-text-heading"
          onClick={onClose}
          type="button"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        <div className={`flex flex-col gap-4 ${contentClassName ?? ""}`}>
          {title && (
            <h2
              className={`pr-10 font-semibold text-[22px] text-text-heading leading-none tracking-[-0.44px] ${titleClassName ?? ""}`}
              id={titleId}
            >
              {title}
            </h2>
          )}
          {description && (
            <p
              className={`text-[14px] text-text-secondary leading-[1.4] tracking-[-0.28px] ${descriptionClassName ?? ""}`}
              id={descriptionId}
            >
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
