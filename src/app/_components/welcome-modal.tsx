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
        <h2 className="font-bold text-xl leading-none" id="welcome-modal-title">
          Добро пожаловать в YesHunt!
        </h2>
        <p
          className="font-normal text-base leading-[1.2]"
          id="welcome-modal-description"
        >
          Вы присоединились как рекрутер компании ООО Инкорпорейтед.
        </p>
      </div>

      <button
        className="ui-button ui-button-primary w-full"
        onClick={onClose}
        type="button"
      >
        Начать работу
      </button>
    </Modal>
  );
}
