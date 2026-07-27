"use client";

import { useTranslations } from "next-intl";
import type { WelcomeModalProps } from "~/types/components/welcome-modal-props";
import { PeopleIcon } from "./icons/PeopleIcon";
import { Modal } from "./modal";

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const t = useTranslations("Components");

  return (
    <Modal
      ariaDescribedBy="welcome-modal-description"
      ariaLabelledBy="welcome-modal-title"
      closeButtonLabel={t("closeWelcome")}
      contentClassName="items-center gap-8 text-center"
      isOpen={isOpen}
      maxWidthClassName="max-w-[384px]"
      onClose={onClose}
      panelClassName="items-center"
    >
      <PeopleIcon className="h-[209px] w-[240px] shrink-0" />

      <div className="flex w-full flex-col gap-4 text-center text-text-heading">
        <h2 className="font-bold text-xl leading-none" id="welcome-modal-title">
          {t("welcomeTitle")}
        </h2>
        <p
          className="font-normal text-base leading-[1.2]"
          id="welcome-modal-description"
        >
          {t("welcomeDescription")}
        </p>
      </div>

      <button
        className="ui-button ui-button-primary w-full"
        onClick={onClose}
        type="button"
      >
        {t("startWorking")}
      </button>
    </Modal>
  );
}
