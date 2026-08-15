"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
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

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{ opacity: 1 }}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          aria-modal="true"
          className={`fixed inset-0 isolate z-[100] flex items-end justify-center overflow-y-auto overscroll-contain p-0 sm:items-center sm:p-6 ${containerClassName ?? ""}`}
          exit={{ opacity: 1 }}
          initial={{ opacity: 1 }}
          role="dialog"
        >
          <motion.div
            animate={{ opacity: 1 }}
            aria-hidden="true"
            className={`absolute inset-0 bg-bg-overlay-modal backdrop-blur-[6px] ${overlayClassName ?? ""}`}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            transition={{ duration: 0.22, ease: MODAL_EASE }}
          />

          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`relative z-10 max-h-[min(92dvh,760px)] w-full overflow-y-auto overscroll-contain rounded-t-[22px] border border-white/80 bg-bg-light p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-dialog outline-none sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:p-6 ${maxWidthClassName} ${panelClassName ?? ""}`}
            exit={{
              opacity: 0,
              scale: 0.992,
              y: 6,
              transition: { duration: 0.18, ease: MODAL_EASE },
            }}
            initial={{ opacity: 0, scale: 0.985, y: 12 }}
            ref={dialogPanelRef}
            tabIndex={-1}
            transition={{ duration: 0.26, ease: MODAL_EASE }}
          >
            <button
              aria-label={resolvedCloseButtonLabel}
              className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-placeholder transition-colors hover:bg-bg-hover hover:text-text-heading active:bg-border-light"
              onClick={onClose}
              type="button"
            >
              <CloseIcon className="h-4 w-4" />
            </button>

            <div className={`flex flex-col gap-4 ${contentClassName ?? ""}`}>
              {title && (
                <h2
                  className={`pr-10 font-semibold text-text-heading text-xl leading-tight tracking-tight ${titleClassName ?? ""}`}
                  id={titleId}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  className={`text-sm text-text-secondary leading-5 ${descriptionClassName ?? ""}`}
                  id={descriptionId}
                >
                  {description}
                </p>
              )}
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
