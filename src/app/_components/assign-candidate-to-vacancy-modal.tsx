"use client";

import { useEffect, useState } from "react";
import { CandidateSelector } from "./candidate-selector";
import { Modal } from "./modal";

type AssignCandidateToVacancyModalProps = {
  errorMessage?: string;
  isAssigning?: boolean;
  isOpen: boolean;
  onAssignCandidate: (candidateId: string) => void;
  onClose: () => void;
  stageLabel: string;
  vacancyId: string;
};

export function AssignCandidateToVacancyModal({
  errorMessage,
  isAssigning = false,
  isOpen,
  onAssignCandidate,
  onClose,
  stageLabel,
  vacancyId,
}: AssignCandidateToVacancyModalProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedCandidate(null);
      setLocalError(null);
    }
  }, [isOpen]);

  const handleAssign = () => {
    if (!selectedCandidate) {
      setLocalError("Выберите кандидата");
      return;
    }

    setLocalError(null);
    onAssignCandidate(selectedCandidate.id);
  };

  return (
    <Modal
      description={`Выберите кандидата, которого нужно добавить на этап "${stageLabel}".`}
      isOpen={isOpen}
      maxWidthClassName="max-w-[520px]"
      onClose={onClose}
      title="Добавить кандидата"
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-[6px] bg-primary-blue-light px-3 py-2 text-[14px] text-primary-blue leading-[1.4] tracking-[-0.28px]">
          Этап: {stageLabel}
        </div>

        <CandidateSelector
          disabled={isAssigning}
          label="Кандидат"
          onChange={setSelectedCandidate}
          selectedCandidateId={selectedCandidate?.id}
          selectedCandidateLabel={selectedCandidate?.label}
          vacancyId={vacancyId}
        />

        {(localError ?? errorMessage) && (
          <p className="text-[14px] text-accent-red tracking-[-0.28px]">
            {localError ?? errorMessage}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            className="h-10 rounded-[6px] border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover"
            disabled={isAssigning}
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="h-10 rounded-[6px] bg-primary-blue px-4 font-semibold text-[16px] text-white leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isAssigning}
            onClick={handleAssign}
            type="button"
          >
            {isAssigning ? "Добавление..." : "Добавить кандидата"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
