"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Modal } from "~/app/_components/modal";
import { Textarea } from "~/app/_components/textarea";
import { CandidateBackgroundCard } from "~/app/candidates/components/candidate-background-card";
import { CandidateSummaryCard } from "~/app/candidates/components/candidate-summary-card";
import { api } from "~/trpc/react";

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Edit</title>
      <path
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Delete</title>
      <path
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Add</title>
      <path
        d="M12 4v16m8-8H4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Back</title>
      <path
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

export default function CandidateDetailPage() {
  const params = useParams();
  const candidateId = typeof params.id === "string" ? params.id : "";
  const utils = api.useUtils();
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const { data: candidate, isLoading } =
    api.candidates.getCandidateById.useQuery({ id: candidateId });
  const addCandidateNote = api.candidates.addCandidateNote.useMutation({
    onSuccess: async () => {
      setNoteContent("");
      setNoteError(null);
      setIsAddNoteModalOpen(false);
      await utils.candidates.getCandidateById.invalidate({ id: candidateId });
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
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Кандидат не найден</div>
      </div>
    );
  }

  return (
    <>
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Page Content */}
        <div className="p-4 lg:p-8">
          {/* Back Link */}
          <Link
            className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
            href="/candidates"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Назад к кандидатам</span>
          </Link>

          {/* Page Title */}
          <h1 className="mb-6 font-bold text-2xl text-gray-900 lg:text-3xl">
            Профиль кандидата
          </h1>

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
                <div className="rounded-2xl border border-border-light bg-white p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-lg">
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
                        <p className="mb-3 text-gray-700 text-sm">
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
                              <EditIcon className="h-4 w-4" />
                            </button>
                            <button
                              className="text-red-500 hover:text-red-600"
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
                <div className="rounded-2xl border border-border-light bg-white p-6">
                  <h3 className="mb-4 font-bold text-gray-900 text-lg">
                    Последние действия
                  </h3>

                  <div className="space-y-4">
                    {candidate.activities.map((activity) => (
                      <div className="flex gap-3" key={activity.id}>
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-200">
                          {activity.userAvatar ? (
                            <Image
                              alt={activity.userName}
                              className="h-full w-full object-cover"
                              height={32}
                              src={activity.userAvatar}
                              width={32}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-primary-blue font-medium text-white text-xs">
                              {activity.userName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium text-gray-900 text-sm">
                              {activity.userName}
                            </span>
                            <span className="flex items-center gap-1 text-text-muted text-xs">
                              {activity.timeAgo === "Только что" && (
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                              )}
                              {activity.timeAgo}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm">
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
                <div className="rounded-2xl border border-border-light bg-white p-6">
                  <h3 className="font-bold text-gray-900 text-lg">
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
            <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
              {noteError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              className="rounded-[8px] border border-border-input px-5 py-2.5 font-medium text-[14px] text-text-secondary transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={addCandidateNote.isPending}
              onClick={closeAddNoteModal}
              type="button"
            >
              Отмена
            </button>
            <button
              className="rounded-[8px] bg-primary-blue px-5 py-2.5 font-medium text-[14px] text-white transition-colors hover:bg-primary-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
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
