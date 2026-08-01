"use client";

import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { PencilIcon, PlusIcon, TrashIcon } from "~/app/_components/icons";
import { Modal } from "~/app/_components/modal";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import { Textarea } from "~/app/_components/textarea";
import { CandidateBackgroundCard } from "~/app/candidates/components/candidate-background-card";
import { CandidateStatusSelect } from "~/app/candidates/components/candidate-status-select";
import { CandidateSummaryCard } from "~/app/candidates/components/candidate-summary-card";
import { ResumeDownloadButton } from "~/app/candidates/components/resume-download-button";
import { useLookupLocalizer } from "~/i18n/use-localized-lookups";
import { api } from "~/trpc/react";
import { CandidateDetailPageSkeleton } from "./candidate-detail-page-skeleton";

export default function CandidateDetailPage() {
  const t = useTranslations("CandidateDetail");
  const navigationT = useTranslations("Navigation");
  const vacanciesT = useTranslations("Vacancies");
  const commonT = useTranslations("Common");
  const localizeLookups = useLookupLocalizer();
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
  const statusOptions = localizeLookups(
    lookups?.statusOptions,
    "candidateStatuses",
  );
  const addCandidateNote = api.candidates.addNote.useMutation({
    onSuccess: async () => {
      setNoteContent("");
      setNoteError(null);
      setIsAddNoteModalOpen(false);
      await utils.candidates.get.invalidate({ id: candidateId });
    },
    onError: (error) => {
      setNoteError(error.message || t("noteSaveError"));
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
      setNoteError(t("noteRequired"));
      return;
    }

    setNoteError(null);
    addCandidateNote.mutate({
      candidateId,
      content: trimmedContent,
    });
  };

  if (isLoading) {
    return <CandidateDetailPageSkeleton />;
  }

  if (!candidate) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-bg-canvas">
        <FeedbackPresence show>
          <div className="rounded-xl border border-danger-red/20 bg-danger-red-bg px-5 py-4 text-danger-red text-sm">
            {t("notFound")}
          </div>
        </FeedbackPresence>
      </div>
    );
  }

  const fromRelatedVacancy = fromVacancyId
    ? candidate.relatedVacancies.find((vacancy) => vacancy.id === fromVacancyId)
    : undefined;
  const hasFunnelSource = fromVacancyId.length > 0;
  const funnelVacancyTitle =
    fromVacancyTitle || fromRelatedVacancy?.title || t("vacancy");

  return (
    <>
      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-bg-canvas">
        {/* Page Content */}
        <div className="app-page">
          <div className="mb-4">
            <Breadcrumbs
              label={candidate.name}
              parent={
                hasFunnelSource
                  ? {
                      href: `/vacancies/${fromVacancyId}/funnel`,
                      label: `${funnelVacancyTitle} / ${vacanciesT("funnel")}`,
                    }
                  : undefined
              }
              rootHref={hasFunnelSource ? "/vacancies" : "/candidates"}
              rootLabel={
                hasFunnelSource
                  ? navigationT("vacancies")
                  : navigationT("candidates")
              }
            />
          </div>

          {/* Page Title */}
          <div className="page-header">
            <h1 className="page-title">{t("title")}</h1>

            <CandidateStatusSelect
              candidateId={candidate.id}
              candidateName={candidate.name}
              status={candidate.status}
              statusOptions={statusOptions}
            />
          </div>

          <div className="mb-6 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              {candidate.hhResumeUrl && (
                <a
                  className="ui-button ui-button-secondary"
                  href={candidate.hhResumeUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="inline-flex items-center rounded-full bg-status-danger-soft px-2 py-0.5 font-semibold text-accent-red text-xs leading-none">
                    hh.uz
                  </span>
                  {t("openHh")}
                </a>
              )}

              <ResumeDownloadButton
                candidateId={candidateId}
                hasHhResume={Boolean(candidate.resumeFile?.url)}
              />
            </div>
          </div>

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
                <div className="surface-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="section-title">{t("recruiterNotes")}</h3>
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
                        className="rounded-lg border border-border-light bg-bg-input p-4"
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
                <div className="surface-card p-5">
                  <h3 className="section-title mb-4">{t("recentActivity")}</h3>

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
                <div className="surface-card p-5">
                  <h3 className="section-title">{t("communication")}</h3>
                  <div className="mt-4 text-sm text-text-muted">
                    {t("communicationEmpty")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Modal
        description={t("newNoteDescription")}
        isOpen={isAddNoteModalOpen}
        maxWidthClassName="max-w-[520px]"
        onClose={closeAddNoteModal}
        title={t("newNote")}
      >
        <div className="flex flex-col gap-4">
          <Textarea
            hideLabel
            label={t("comment")}
            onChange={(event) => {
              setNoteContent(event.target.value);
              if (noteError) {
                setNoteError(null);
              }
            }}
            placeholder={t("commentPlaceholder")}
            textareaClassName="min-h-[140px]"
            value={noteContent}
          />

          <FeedbackPresence show={Boolean(noteError)}>
            <div className="rounded-lg border border-danger-red-bg bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
              {noteError}
            </div>
          </FeedbackPresence>

          <div className="flex justify-end gap-3">
            <button
              className="ui-button ui-button-secondary"
              disabled={addCandidateNote.isPending}
              onClick={closeAddNoteModal}
              type="button"
            >
              {commonT("cancel")}
            </button>
            <button
              className="ui-button ui-button-primary"
              disabled={addCandidateNote.isPending}
              onClick={handleSaveNote}
              type="button"
            >
              <LoadingButtonContent
                isLoading={addCandidateNote.isPending}
                label={commonT("save")}
                loadingLabel={commonT("saving")}
              />
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
