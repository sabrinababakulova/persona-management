"use client";

import { useEffect, useRef } from "react";

type WelcomeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const dialogPanelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

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

  return (
    <div
      aria-labelledby="welcome-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-6 pt-5"
      role="dialog"
    >
      <button
        aria-label="Закрыть приветственное окно"
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        type="button"
      />
      <div
        className="relative w-full max-w-[500px] rounded-[8px] border border-border-input bg-white p-5 shadow-[6px_6px_26.2px_0px_rgba(43,48,66,0.10)]"
        ref={dialogPanelRef}
        tabIndex={-1}
      >
        <div className="flex flex-col gap-4 text-text-heading">
          <h2
            className="font-bold text-[24px] leading-none tracking-[-0.48px]"
            id="welcome-modal-title"
          >
            Добро пожаловать в YesHunt!
          </h2>
          <p className="font-normal text-[16px] leading-[1.2] tracking-[-0.32px]">
            Вы присоединились как рекрутер компании ООО Инкорпорейтед.
          </p>
        </div>
      </div>
    </div>
  );
}
