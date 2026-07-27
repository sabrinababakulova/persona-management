"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import type { ModalProps } from "~/types/components/modal-props";
import { CloseIcon } from "./icons";
import { AnimatePresence, motion } from "./motion-system";

const MODAL_EASE = [0.22, 1, 0.36, 1] as const;

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
  closeButtonLabel,
}: ModalProps) {
  const t = useTranslations("Components");
  const resolvedCloseButtonLabel = closeButtonLabel ?? t("closeModal");
  const dialogPanelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  const generatedId = useId();

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
    const frameId = window.requestAnimationFrame(() => {
      dialogPanelRef.current?.focus();
    });

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
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [isOpen]);

  const titleId = title ? `${generatedId}-title` : undefined;
  const descriptionId = description ? `${generatedId}-description` : undefined;
  const labelledBy = ariaLabelledBy ?? titleId;
  const describedBy = ariaDescribedBy ?? descriptionId;

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{ opacity: 1 }}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          aria-modal="true"
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${containerClassName ?? ""}`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          role="dialog"
          transition={{ duration: 0.2, ease: MODAL_EASE }}
        >
          <motion.button
            animate={{ opacity: 1 }}
            aria-label={resolvedCloseButtonLabel}
            className={`absolute inset-0 bg-text-heading/20 ${overlayClassName ?? ""}`}
            data-motion="none"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            transition={{ duration: 0.2 }}
            type="button"
          />

          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`relative w-full rounded-xl border border-border-input bg-bg-light p-5 shadow-modal sm:p-6 ${maxWidthClassName} ${panelClassName ?? ""}`}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            initial={{ opacity: 0, scale: 0.965, y: 18 }}
            ref={dialogPanelRef}
            tabIndex={-1}
            transition={{ duration: 0.28, ease: MODAL_EASE }}
          >
            <motion.button
              aria-label={resolvedCloseButtonLabel}
              className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-placeholder transition-colors hover:bg-bg-hover hover:text-text-heading"
              onClick={onClose}
              type="button"
              whileHover={{ rotate: 6, scale: 1.06 }}
              whileTap={{ scale: 0.9 }}
            >
              <CloseIcon className="h-4 w-4" />
            </motion.button>

            <div className={`flex flex-col gap-4 ${contentClassName ?? ""}`}>
              {title && (
                <motion.h2
                  animate={{ opacity: 1, y: 0 }}
                  className={`pr-10 font-semibold text-text-heading text-xl leading-tight tracking-tight ${titleClassName ?? ""}`}
                  id={titleId}
                  initial={{ opacity: 0, y: 5 }}
                  transition={{ delay: 0.05, duration: 0.22 }}
                >
                  {title}
                </motion.h2>
              )}
              {description && (
                <motion.p
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-sm text-text-secondary leading-5 ${descriptionClassName ?? ""}`}
                  id={descriptionId}
                  initial={{ opacity: 0, y: 5 }}
                  transition={{ delay: 0.08, duration: 0.22 }}
                >
                  {description}
                </motion.p>
              )}
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
