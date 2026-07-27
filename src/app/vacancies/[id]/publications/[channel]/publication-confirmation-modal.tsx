"use client";

import { useTranslations } from "next-intl";
import { Modal } from "~/app/_components/modal";
import { LoadingButtonContent } from "~/app/_components/motion-system";

type PublicationConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  isPending?: boolean;
  onClose: () => void;
  onReject: () => void;
  onConfirm: () => void;
  rejectLabel?: string;
  confirmLabel?: string;
};

export function PublicationConfirmationModal({
  isOpen,
  title,
  description,
  isPending = false,
  onClose,
  onReject,
  onConfirm,
  rejectLabel,
  confirmLabel,
}: PublicationConfirmationModalProps) {
  const t = useTranslations("Publications");
  const commonT = useTranslations("Common");

  return (
    <Modal
      description={description ?? t("hh.confirmDescription")}
      isOpen={isOpen}
      maxWidthClassName="max-w-[420px]"
      onClose={onClose}
      title={title}
    >
      <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
        <button
          className="ui-button ui-button-secondary"
          disabled={isPending}
          onClick={onReject}
          type="button"
        >
          {rejectLabel ?? commonT("no")}
        </button>
        <button
          className="ui-button ui-button-primary"
          disabled={isPending}
          onClick={onConfirm}
          type="button"
        >
          <LoadingButtonContent
            isLoading={isPending}
            label={confirmLabel ?? commonT("yes")}
            loadingLabel={commonT("working")}
          />
        </button>
      </div>
    </Modal>
  );
}
