"use client";

import { Modal } from "~/app/_components/modal";

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
          className="h-10 rounded-[6px] border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={onReject}
          type="button"
        >
          {rejectLabel}
        </button>
        <button
          className="flex h-10 items-center gap-2 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={onConfirm}
          type="button"
        >
          {isPending && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-blue/30 border-t-primary-blue" />
          )}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
