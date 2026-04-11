"use client";

import type { WelcomeModalProps } from "~/types/components/welcome-modal-props";
import { PeopleIcon } from "./icons/PeopleIcon";
import { Modal } from "./modal";

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  return (
    <Modal
      ariaDescribedBy="welcome-modal-description"
      ariaLabelledBy="welcome-modal-title"
      closeButtonLabel="Закрыть приветственное окно"
      contentClassName="items-center gap-8 text-center"
      isOpen={isOpen}
      maxWidthClassName="max-w-[384px]"
      onClose={onClose}
      panelClassName="items-center"
    >
      <PeopleIcon className="h-[209px] w-[240px] shrink-0" />

      <div className="flex w-full flex-col gap-4 text-center text-text-heading">
        <h2
          className="font-bold text-[22px] leading-none tracking-[-0.44px]"
          id="welcome-modal-title"
        >
          Добро пожаловать в YesHunt!
        </h2>
        <p
          className="font-normal text-[16px] leading-[1.2] tracking-[-0.32px]"
          id="welcome-modal-description"
        >
          Вы присоединились как рекрутер компании ООО Инкорпорейтед.
        </p>
      </div>

      <button
        className="h-10 w-full rounded-[6px] bg-primary-blue font-medium text-[16px] text-bg-light tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue focus-visible:ring-offset-2"
        onClick={onClose}
        type="button"
      >
        Начать работу
      </button>
    </Modal>
  );
}
