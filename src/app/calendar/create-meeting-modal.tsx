"use client";

import { useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { MailIcon, SearchIcon } from "~/app/_components/icons";
import { Input } from "~/app/_components/input";
import { Modal } from "~/app/_components/modal";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import { Textarea } from "~/app/_components/textarea";
import { api } from "~/trpc/react";
import {
  combineMeetingDateTime,
  getBrowserTimeZone,
  getInitialMeetingSlot,
  toMeetingDateValue,
  toMeetingTimeValue,
} from "~/utils/meeting-date";

const DURATION_OPTIONS = [30, 45, 60] as const;

type SelectedCandidate = {
  id: string;
  fullName: string;
  email: string;
  currentPosition: string | null;
  city: string | null;
};

type CreateMeetingModalProps = {
  initialEnd?: Date;
  initialStart?: Date;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (title: string) => void;
};

export function CreateMeetingModal({
  initialEnd,
  initialStart,
  isOpen,
  onClose,
  onCreated,
}: CreateMeetingModalProps) {
  const t = useTranslations("Calendar");
  const commonT = useTranslations("Common");
  const utils = api.useUtils();
  const fallbackSlot = useMemo(getInitialMeetingSlot, []);
  const [selectedCandidate, setSelectedCandidate] =
    useState<SelectedCandidate | null>(null);
  const [candidateSearch, setCandidateSearch] = useState("");
  const deferredCandidateSearch = useDeferredValue(candidateSearch);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [timeZone, setTimeZone] = useState("Asia/Tashkent");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: candidateOptions = [], isFetching: isSearchingCandidates } =
    api.candidates.searchMeetingCandidates.useQuery(
      { query: deferredCandidateSearch },
      {
        enabled: isOpen,
        placeholderData: (previousData) => previousData,
      },
    );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const start = initialStart ?? fallbackSlot.start;
    const end = initialEnd ?? fallbackSlot.end;
    setSelectedCandidate(null);
    setCandidateSearch("");
    setTitle("");
    setDate(toMeetingDateValue(start));
    setStartTime(toMeetingTimeValue(start));
    setEndTime(toMeetingTimeValue(end));
    setLocation("");
    setDescription("");
    setTimeZone(getBrowserTimeZone());
    setFormError(null);
  }, [fallbackSlot.end, fallbackSlot.start, initialEnd, initialStart, isOpen]);

  const startAt = combineMeetingDateTime(date, startTime);
  const endAt = combineMeetingDateTime(date, endTime);
  const selectedDuration = Math.round(
    (endAt.getTime() - startAt.getTime()) / 60_000,
  );

  const createMeeting = api.candidates.createMeeting.useMutation({
    onSuccess: async (meeting) => {
      await Promise.all([
        utils.candidates.listMyMeetings.invalidate(),
        utils.candidates.listMeetings.invalidate({
          id: selectedCandidate?.id ?? "",
        }),
      ]);
      onCreated(meeting.title);
    },
    onError: async (error) => {
      setFormError(error.message || t("sendError"));
      await utils.candidates.listMyMeetings.invalidate();
    },
  });

  function selectCandidate(candidate: SelectedCandidate) {
    setSelectedCandidate(candidate);
    setCandidateSearch("");
    setTitle(t("defaultTitle", { name: candidate.fullName }));
    setFormError(null);
  }

  function applyDuration(minutes: number) {
    const nextEnd = new Date(startAt.getTime() + minutes * 60_000);
    setEndTime(toMeetingTimeValue(nextEnd));
  }

  function handleStartTimeChange(value: string) {
    const previousDuration = Math.max(30, selectedDuration || 60);
    const nextStart = combineMeetingDateTime(date, value);
    const nextEnd = new Date(nextStart.getTime() + previousDuration * 60_000);
    setStartTime(value);
    setEndTime(toMeetingTimeValue(nextEnd));
  }

  function handleClose() {
    if (!createMeeting.isPending) {
      onClose();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!selectedCandidate) {
      setFormError(t("candidateRequired"));
      return;
    }
    if (!title.trim()) {
      setFormError(t("meetingTitleRequired"));
      return;
    }
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setFormError(t("dateRequired"));
      return;
    }
    if (startAt.getTime() < Date.now() - 60_000) {
      setFormError(t("pastError"));
      return;
    }
    if (endAt <= startAt) {
      setFormError(t("endError"));
      return;
    }

    createMeeting.mutate({
      candidateId: selectedCandidate.id,
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startAt,
      endAt,
      timeZone,
    });
  }

  return (
    <Modal
      closeOnBackdropClick={!createMeeting.isPending}
      closeOnEscape={!createMeeting.isPending}
      description={t("modalDescription")}
      isOpen={isOpen}
      maxWidthClassName="max-w-[680px]"
      onClose={handleClose}
      title={t("modalTitle")}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label
            className="mb-1.5 block font-semibold text-sm text-text-label"
            htmlFor="meeting-candidate-search"
          >
            {t("candidate")}
          </label>

          {selectedCandidate ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border-input bg-bg-input p-3.5">
              <div className="min-w-0">
                <p className="truncate font-semibold text-sm text-text-heading">
                  {selectedCandidate.fullName}
                </p>
                <p className="mt-1 flex items-center gap-1.5 truncate text-text-secondary text-xs">
                  <MailIcon className="h-3.5 w-3.5 shrink-0" />
                  {selectedCandidate.email}
                </p>
              </div>
              <button
                className="ui-button ui-button-secondary min-h-9 shrink-0"
                onClick={() => {
                  setSelectedCandidate(null);
                  setTitle("");
                }}
                type="button"
              >
                {t("changeCandidate")}
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-text-placeholder" />
                <input
                  className="h-11 w-full rounded-xl border border-border-input bg-bg-input pr-3.5 pl-10 text-sm text-text-heading outline-none transition-[border-color,background-color,box-shadow] placeholder:text-text-placeholder hover:border-border-control hover:bg-white focus:border-primary-blue focus:bg-white focus:shadow-[0_0_0_3px_rgba(253,55,44,0.14)]"
                  id="meeting-candidate-search"
                  onChange={(event) => setCandidateSearch(event.target.value)}
                  placeholder={t("candidatePlaceholder")}
                  value={candidateSearch}
                />
              </div>

              <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-border-light bg-bg-light p-1.5">
                {isSearchingCandidates ? (
                  <p className="px-3 py-5 text-center text-sm text-text-muted">
                    {t("searchingCandidates")}
                  </p>
                ) : candidateOptions.length > 0 ? (
                  candidateOptions.map((candidate) => (
                    <button
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-bg-input"
                      key={candidate.id}
                      onClick={() => selectCandidate(candidate)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-sm text-text-heading">
                          {candidate.fullName}
                        </span>
                        <span className="mt-0.5 block truncate text-text-muted text-xs">
                          {[candidate.currentPosition, candidate.city]
                            .filter(Boolean)
                            .join(" · ") || candidate.email}
                        </span>
                      </span>
                      <span className="shrink-0 text-text-placeholder text-xs">
                        {candidate.email}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-5 text-center text-sm text-text-muted">
                    {t("noEmailCandidates")}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <Input
          label={t("meetingTitle")}
          maxLength={255}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("meetingTitlePlaceholder")}
          value={title}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label={t("date")}
            min={toMeetingDateValue(new Date())}
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
          <Input
            label={t("startsAt")}
            onChange={(event) => handleStartTimeChange(event.target.value)}
            step={900}
            type="time"
            value={startTime}
          />
          <Input
            label={t("endsAt")}
            onChange={(event) => setEndTime(event.target.value)}
            step={900}
            type="time"
            value={endTime}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold text-sm text-text-label">
            {t("duration")}
          </p>
          <div className="flex max-w-sm gap-2">
            {DURATION_OPTIONS.map((minutes) => (
              <button
                aria-pressed={selectedDuration === minutes}
                className="meeting-duration-button"
                data-active={selectedDuration === minutes}
                key={minutes}
                onClick={() => applyDuration(minutes)}
                type="button"
              >
                {t("minutes", { count: minutes })}
              </button>
            ))}
          </div>
        </div>

        <Input
          label={t("location")}
          maxLength={500}
          onChange={(event) => setLocation(event.target.value)}
          placeholder={t("locationPlaceholder")}
          value={location}
        />

        <Textarea
          label={t("message")}
          maxLength={5000}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("messagePlaceholder")}
          textareaClassName="min-h-24"
          value={description}
        />

        <div className="flex flex-col gap-1 rounded-xl bg-bg-input px-3.5 py-3 text-text-secondary text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>{t("timeZone", { timeZone })}</span>
          <span>{t("rsvpDelivery")}</span>
        </div>

        <FeedbackPresence show={Boolean(formError)}>
          <div className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2.5 text-danger-red text-sm">
            {formError}
          </div>
        </FeedbackPresence>

        <div className="flex justify-end gap-3">
          <button
            className="ui-button ui-button-secondary"
            disabled={createMeeting.isPending}
            onClick={handleClose}
            type="button"
          >
            {commonT("cancel")}
          </button>
          <button
            className="ui-button ui-button-primary min-w-44"
            disabled={createMeeting.isPending}
            type="submit"
          >
            <LoadingButtonContent
              isLoading={createMeeting.isPending}
              label={t("sendInvitation")}
              loadingLabel={t("sendingInvitation")}
            />
          </button>
        </div>
      </form>
    </Modal>
  );
}
