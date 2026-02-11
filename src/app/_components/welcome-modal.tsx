"use client";

import { useEffect } from "react";

type WelcomeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
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
      <div className="relative w-full max-w-[500px] rounded-[8px] border border-border-input bg-white p-5 shadow-[6px_6px_26.2px_0px_rgba(43,48,66,0.10)]">
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
