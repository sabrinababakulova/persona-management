"use client";

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
  description = "Публикация будет опубликована на hh.uz",
  isPending = false,
  onClose,
  onReject,
  onConfirm,
  rejectLabel = "Нет",
  confirmLabel = "Да",
}: PublicationConfirmationModalProps) {
  return (
    <Modal
      description={description}
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
          {rejectLabel}
        </button>
        <button
          className="ui-button ui-button-primary"
          disabled={isPending}
          onClick={onConfirm}
          type="button"
        >
          <LoadingButtonContent
            isLoading={isPending}
            label={confirmLabel}
            loadingLabel="Выполняем..."
          />
        </button>
      </div>
    </Modal>
  );
}
