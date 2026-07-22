"use client";

import { useEffect, useState } from "react";
import { CandidateSelector } from "./candidate-selector";
import { Modal } from "./modal";
import { FeedbackPresence, LoadingButtonContent } from "./motion-system";

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
        <div className="rounded-lg bg-primary-blue-light px-3 py-2 text-primary-blue text-sm leading-[1.4]">
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

        <FeedbackPresence show={Boolean(localError ?? errorMessage)}>
          <p className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
            {localError ?? errorMessage}
          </p>
        </FeedbackPresence>

        <div className="flex items-center justify-end gap-3">
          <button
            className="ui-button ui-button-secondary"
            disabled={isAssigning}
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="ui-button ui-button-primary"
            disabled={isAssigning}
            onClick={handleAssign}
            type="button"
          >
            <LoadingButtonContent
              isLoading={isAssigning}
              label="Добавить кандидата"
              loadingLabel="Добавление..."
            />
          </button>
        </div>
      </div>
    </Modal>
  );
}
