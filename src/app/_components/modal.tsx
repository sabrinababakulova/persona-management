"use client";

import { useEffect, useRef } from "react";
import type { ModalProps } from "~/types/components/modal-props";

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

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeOnEscapeRef.current = closeOnEscape;
  }, [closeOnEscape]);

  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const titleId = title ? "modal-title" : undefined;
  const descriptionId = description ? "modal-description" : undefined;
  const labelledBy = ariaLabelledBy ?? titleId;
  const describedBy = ariaDescribedBy ?? descriptionId;

  return (
    <div
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-center justify-center p-5 ${containerClassName ?? ""}`}
      role="dialog"
    >
      <button
        aria-label={closeButtonLabel}
        className={`absolute inset-0 bg-black/20 ${overlayClassName ?? ""}`}
        onClick={closeOnBackdropClick ? onClose : undefined}
        type="button"
      />

      <div
        className={`relative w-full rounded-[8px] border border-border-input bg-white p-5 shadow-[6px_6px_26.2px_0px_rgba(43,48,66,0.10)] ${maxWidthClassName} ${panelClassName ?? ""}`}
        ref={dialogPanelRef}
        tabIndex={-1}
      >
        <div className={`flex flex-col gap-4 ${contentClassName ?? ""}`}>
          {title && (
            <h2
              className={`font-semibold text-[22px] text-text-heading leading-none tracking-[-0.44px] ${titleClassName ?? ""}`}
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
