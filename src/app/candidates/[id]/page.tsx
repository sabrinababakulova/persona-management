"use client";

import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { PencilIcon, PlusIcon, TrashIcon } from "~/app/_components/icons";
import { Modal } from "~/app/_components/modal";
import { Textarea } from "~/app/_components/textarea";
import { CandidateBackgroundCard } from "~/app/candidates/components/candidate-background-card";
import { CandidateStatusSelect } from "~/app/candidates/components/candidate-status-select";
import { CandidateSummaryCard } from "~/app/candidates/components/candidate-summary-card";
import { api } from "~/trpc/react";

export default function CandidateDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const candidateId = typeof params.id === "string" ? params.id : "";
  const fromVacancyId = searchParams.get("fromVacancyId")?.trim() || "";
  const fromVacancyTitle = searchParams.get("fromVacancyTitle")?.trim() || "";
  const utils = api.useUtils();
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const { data: candidate, isLoading } = api.candidates.get.useQuery({
    id: candidateId,
  });
  const { data: lookups } = api.lookups.getCandidateCreateOptions.useQuery();
  const statusOptions = lookups?.statusOptions ?? [];
  const addCandidateNote = api.candidates.addNote.useMutation({
    onSuccess: async () => {
      setNoteContent("");
      setNoteError(null);
      setIsAddNoteModalOpen(false);
      await utils.candidates.get.invalidate({ id: candidateId });
    },
    onError: (error) => {
      setNoteError(error.message || "Не удалось сохранить заметку");
    },
  });

  const closeAddNoteModal = () => {
    if (addCandidateNote.isPending) {
      return;
    }

    setIsAddNoteModalOpen(false);
    setNoteContent("");
    setNoteError(null);
  };

  const handleSaveNote = () => {
    const trimmedContent = noteContent.trim();

    if (!trimmedContent) {
      setNoteError("Введите комментарий");
      return;
    }

    setNoteError(null);
    addCandidateNote.mutate({
      candidateId,
      content: trimmedContent,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-text-secondary">Загрузка...</div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-text-secondary">Кандидат не найден</div>
      </div>
    );
  }

  const fromRelatedVacancy = fromVacancyId
    ? candidate.relatedVacancies.find((vacancy) => vacancy.id === fromVacancyId)
    : undefined;
  const hasFunnelSource = fromVacancyId.length > 0;
  const funnelVacancyTitle =
    fromVacancyTitle || fromRelatedVacancy?.title || "Вакансия";

  return (
    <>
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Page Content */}
        <div className="p-4 lg:p-8">
          <div className="mb-4">
            <Breadcrumbs
              label={candidate.name}
              parent={
                hasFunnelSource
                  ? {
                      href: `/vacancies/${fromVacancyId}/funnel`,
                      label: `${funnelVacancyTitle} / Воронка`,
                    }
                  : undefined
              }
              rootHref={hasFunnelSource ? "/vacancies" : "/candidates"}
              rootLabel={hasFunnelSource ? "Вакансии" : "Кандидаты"}
            />
          </div>

          {/* Page Title */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-bold text-2xl text-text-heading lg:text-3xl">
              Профиль кандидата
            </h1>

            <CandidateStatusSelect
              candidateId={candidate.id}
              candidateName={candidate.name}
              status={candidate.status}
              statusOptions={statusOptions}
            />
          </div>

          {candidate.hhResumeUrl && (
            <a
              className="mb-6 inline-flex items-center gap-2 rounded-[6px] border border-border-input bg-bg-input px-4 py-3 text-[14px] text-text-secondary hover:text-text-heading"
              href={candidate.hhResumeUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className="inline-flex items-center rounded-full bg-status-danger-soft px-2 py-0.5 font-semibold text-[11px] text-accent-red leading-none">
                hh.uz
              </span>
              Открыть профиль на hh.uz →
            </a>
          )}

          {/* Main Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column - Profile Info */}
            <div className="lg:col-span-4">
              <CandidateSummaryCard
                aiAnalysis={candidate.aiAnalysis}
                city={candidate.location}
                contacts={candidate.contacts}
                currentPosition={candidate.currentPosition}
                experience={candidate.experience}
                fullName={candidate.name}
                languages={candidate.languages}
                matchScore={candidate.matchScore}
                relatedVacancies={candidate.relatedVacancies}
                salaryCurrency={candidate.salaryCurrency}
                salaryExpectation={candidate.salaryExpectation}
                skills={candidate.skills}
                tags={candidate.tags}
              />
            </div>

            {/* Middle Column - Experience & Education */}
            <div className="lg:col-span-4">
              <CandidateBackgroundCard
                education={candidate.education}
                resumeFile={candidate.resumeFile}
                workExperience={candidate.workExperience}
              />
            </div>

            {/* Right Column - Notes & Activities */}
            <div className="lg:col-span-4">
              <div className="space-y-6">
                {/* Recruiter Notes */}
                <div className="rounded-2xl border border-border-light bg-bg-light p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-text-heading">
                      Заметки рекрутера
                    </h3>
                    <button
                      className="text-primary-blue hover:text-primary-blue-dark"
                      onClick={() => setIsAddNoteModalOpen(true)}
                      type="button"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {candidate.notes.map((note) => (
                      <div
                        className="rounded-xl border border-border-light bg-bg-light p-4"
                        key={note.id}
                      >
                        <p className="mb-3 text-sm text-text-label">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-muted">
                            {note.author}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-primary-blue hover:text-primary-blue-dark"
                              type="button"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              className="text-danger-red hover:text-accent-red"
                              type="button"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activities */}
                <div className="rounded-2xl border border-border-light bg-bg-light p-6">
                  <h3 className="mb-4 font-bold text-lg text-text-heading">
                    Последние действия
                  </h3>

                  <div className="space-y-4">
                    {candidate.activities.map((activity) => (
                      <div className="flex gap-3" key={activity.id}>
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-border-light">
                          {activity.userAvatar ? (
                            <Image
                              alt={activity.userName}
                              className="h-full w-full object-cover"
                              height={32}
                              src={activity.userAvatar}
                              width={32}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-primary-blue font-medium text-bg-light text-xs">
                              {activity.userName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium text-sm text-text-heading">
                              {activity.userName}
                            </span>
                            <span className="flex items-center gap-1 text-text-muted text-xs">
                              {activity.timeAgo === "Только что" && (
                                <span className="h-2 w-2 rounded-full bg-danger-red" />
                              )}
                              {activity.timeAgo}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary">
                            {activity.action}{" "}
                            <span className="text-primary-blue">
                              {activity.targetName}
                            </span>{" "}
                            на "{activity.targetStatus}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Communication */}
                <div className="rounded-2xl border border-border-light bg-bg-light p-6">
                  <h3 className="font-bold text-lg text-text-heading">
                    Коммуникация
                  </h3>
                  <div className="mt-4 text-sm text-text-muted">
                    История коммуникации будет отображаться здесь
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Modal
        description="Добавьте комментарий о кандидате. Автор заметки будет определен автоматически."
        isOpen={isAddNoteModalOpen}
        maxWidthClassName="max-w-[520px]"
        onClose={closeAddNoteModal}
        title="Новая заметка"
      >
        <div className="flex flex-col gap-4">
          <Textarea
            hideLabel
            label="Комментарий"
            onChange={(event) => {
              setNoteContent(event.target.value);
              if (noteError) {
                setNoteError(null);
              }
            }}
            placeholder="Оставьте комментарий о кандидате"
            textareaClassName="min-h-[140px]"
            value={noteContent}
          />

          {noteError && (
            <div className="rounded-[6px] border border-danger-red-bg bg-danger-red-bg px-3 py-2 text-[14px] text-danger-red">
              {noteError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              className="rounded-[8px] border border-border-input px-5 py-2.5 font-medium text-[14px] text-text-secondary transition-colors hover:bg-bg-light disabled:cursor-not-allowed disabled:opacity-60"
              disabled={addCandidateNote.isPending}
              onClick={closeAddNoteModal}
              type="button"
            >
              Отмена
            </button>
            <button
              className="rounded-[8px] bg-primary-blue px-5 py-2.5 font-medium text-[14px] text-bg-light transition-colors hover:bg-primary-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
              disabled={addCandidateNote.isPending}
              onClick={handleSaveNote}
              type="button"
            >
              {addCandidateNote.isPending ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
