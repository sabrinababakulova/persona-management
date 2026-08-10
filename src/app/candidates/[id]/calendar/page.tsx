"use client";

import FullCalendar, {
  type CalendarRef,
  type DateSelectInfo,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import enGbLocale from "@fullcalendar/react/locales/en-gb";
import ruLocale from "@fullcalendar/react/locales/ru";
import uzLocale from "@fullcalendar/react/locales/uz";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/palette.css";
import "@fullcalendar/react/themes/classic/theme.css";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  MailIcon,
} from "~/app/_components/icons";
import { Input } from "~/app/_components/input";
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

export default function CandidateCalendarPage() {
  const t = useTranslations("CandidateMeeting");
  const navigationT = useTranslations("Navigation");
  const locale = useLocale();
  const params = useParams();
  const candidateId = typeof params.id === "string" ? params.id : "";
  const calendarRef = useRef<CalendarRef>(null);
  const utils = api.useUtils();
  const initialSlot = useMemo(getInitialMeetingSlot, []);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [activeView, setActiveView] = useState("timeGridWeek");
  const [date, setDate] = useState(toMeetingDateValue(initialSlot.start));
  const [startTime, setStartTime] = useState(
    toMeetingTimeValue(initialSlot.start),
  );
  const [endTime, setEndTime] = useState(toMeetingTimeValue(initialSlot.end));
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [sentMeetingTitle, setSentMeetingTitle] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState("Asia/Tashkent");

  const { data: candidate, isLoading: isCandidateLoading } =
    api.candidates.get.useQuery(
      { id: candidateId },
      { enabled: Boolean(candidateId) },
    );
  const { data: meetings = [], isLoading: areMeetingsLoading } =
    api.candidates.listMeetings.useQuery(
      { id: candidateId },
      { enabled: Boolean(candidateId) },
    );

  useEffect(() => {
    setTimeZone(getBrowserTimeZone());
  }, []);

  useEffect(() => {
    if (candidate?.name && !title) {
      setTitle(t("defaultTitle", { name: candidate.name }));
    }
  }, [candidate?.name, t, title]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      calendarRef.current?.getApi().changeView("timeGridDay");
      setActiveView("timeGridDay");
    }
  }, []);

  const createMeeting = api.candidates.createMeeting.useMutation({
    onSuccess: async (meeting) => {
      setSentMeetingTitle(meeting.title);
      setFormError(null);
      await Promise.all([
        utils.candidates.listMeetings.invalidate({ id: candidateId }),
        utils.candidates.get.invalidate({ id: candidateId }),
      ]);
    },
    onError: (error) => {
      setSentMeetingTitle(null);
      setFormError(error.message || t("sendError"));
    },
  });

  const calendarLocale =
    locale === "uz" ? uzLocale : locale === "en" ? enGbLocale : ruLocale;
  const calendarEvents = meetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    start: meeting.startAt,
    end: meeting.endAt,
    classNames: [
      meeting.invitationStatus === "failed"
        ? "meeting-calendar-event-failed"
        : "meeting-calendar-event-sent",
    ],
    extendedProps: {
      invitationStatus: meeting.invitationStatus,
      location: meeting.location,
    },
  }));

  const candidateEmail = candidate?.contacts.email?.trim() || "";
  const startAt = combineMeetingDateTime(date, startTime);
  const endAt = combineMeetingDateTime(date, endTime);
  const selectedDuration = Math.round(
    (endAt.getTime() - startAt.getTime()) / 60_000,
  );

  function applySelection(selection: DateSelectInfo) {
    let nextStart = selection.start;
    let nextEnd = selection.end;

    if (selection.allDay) {
      nextStart = new Date(selection.start);
      nextStart.setHours(10, 0, 0, 0);
      nextEnd = new Date(nextStart.getTime() + 60 * 60 * 1000);
    }

    setDate(toMeetingDateValue(nextStart));
    setStartTime(toMeetingTimeValue(nextStart));
    setEndTime(toMeetingTimeValue(nextEnd));
    setFormError(null);
    setSentMeetingTitle(null);
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

  function changeCalendarView(
    view: "timeGridDay" | "timeGridWeek" | "dayGridMonth",
  ) {
    calendarRef.current?.getApi().changeView(view);
    setActiveView(view);
  }

  function submitMeeting() {
    setFormError(null);
    setSentMeetingTitle(null);

    if (!candidateEmail) {
      setFormError(t("emailMissing"));
      return;
    }
    if (!title.trim()) {
      setFormError(t("titleRequired"));
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
      candidateId,
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startAt,
      endAt,
      timeZone,
    });
  }

  if (isCandidateLoading) {
    return (
      <main className="flex-1 overflow-auto bg-bg-canvas">
        <div className="app-page animate-pulse">
          <div className="mb-6 h-5 w-64 rounded bg-border-light" />
          <div className="mb-7 h-10 w-80 rounded bg-border-light" />
          <div className="h-[720px] rounded-xl border border-border-light bg-white" />
        </div>
      </main>
    );
  }

  if (!candidate) {
    return (
      <main className="flex flex-1 items-center justify-center overflow-auto bg-bg-canvas p-6">
        <div className="surface-card max-w-md p-6 text-center">
          <h1 className="section-title">{t("notFound")}</h1>
          <Link
            className="ui-button ui-button-secondary mt-5"
            href="/candidates"
          >
            {t("backToCandidates")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-bg-canvas">
      <div className="app-page max-w-[1680px]">
        <div className="mb-4">
          <Breadcrumbs
            label={t("breadcrumb")}
            parent={{
              href: `/candidates/${candidateId}`,
              label: candidate.name,
            }}
            rootHref="/candidates"
            rootLabel={navigationT("candidates")}
          />
        </div>

        <div className="page-header items-end">
          <div>
            <p className="mb-1 font-semibold text-primary-blue text-sm">
              {candidate.name}
            </p>
            <h1 className="page-title">{t("title")}</h1>
          </div>
          <Link
            className="ui-button ui-button-secondary"
            href={`/candidates/${candidateId}`}
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {t("backToProfile")}
          </Link>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="surface-card min-w-0 overflow-hidden">
            <div className="flex flex-col gap-4 border-border-light border-b px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <button
                  aria-label={t("previousPeriod")}
                  className="meeting-calendar-nav-button"
                  onClick={() => calendarRef.current?.getApi().prev()}
                  type="button"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <button
                  className="ui-button ui-button-secondary min-h-9"
                  onClick={() => calendarRef.current?.getApi().today()}
                  type="button"
                >
                  {t("today")}
                </button>
                <button
                  aria-label={t("nextPeriod")}
                  className="meeting-calendar-nav-button"
                  onClick={() => calendarRef.current?.getApi().next()}
                  type="button"
                >
                  <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                </button>
                <h2 className="ml-1 font-bold text-lg text-text-heading tracking-[-0.02em] sm:text-xl">
                  {calendarTitle}
                </h2>
              </div>

              <div className="flex rounded-xl bg-bg-input p-1">
                <button
                  aria-pressed={activeView === "timeGridDay"}
                  className="meeting-calendar-view-button"
                  data-active={activeView === "timeGridDay"}
                  onClick={() => changeCalendarView("timeGridDay")}
                  type="button"
                >
                  {t("day")}
                </button>
                <button
                  aria-pressed={activeView === "timeGridWeek"}
                  className="meeting-calendar-view-button"
                  data-active={activeView === "timeGridWeek"}
                  onClick={() => changeCalendarView("timeGridWeek")}
                  type="button"
                >
                  {t("week")}
                </button>
                <button
                  aria-pressed={activeView === "dayGridMonth"}
                  className="meeting-calendar-view-button"
                  data-active={activeView === "dayGridMonth"}
                  onClick={() => changeCalendarView("dayGridMonth")}
                  type="button"
                >
                  {t("month")}
                </button>
              </div>
            </div>

            <div className="meeting-calendar-shell p-3 sm:p-5">
              <FullCalendar
                allDaySlot={false}
                businessHours={{
                  daysOfWeek: [1, 2, 3, 4, 5],
                  startTime: "09:00",
                  endTime: "19:00",
                }}
                datesSet={(info) => {
                  setCalendarTitle(info.view.title);
                  setActiveView(info.view.type);
                }}
                dayMaxEvents={3}
                editable={false}
                eventContent={(eventInfo) => (
                  <div className="meeting-calendar-event-content">
                    <span className="meeting-calendar-event-time">
                      {eventInfo.timeText}
                    </span>
                    <span className="meeting-calendar-event-title">
                      {eventInfo.event.title}
                    </span>
                  </div>
                )}
                eventDidMount={(info) => {
                  info.el.title = info.event.title;
                }}
                events={calendarEvents}
                firstDay={1}
                headerToolbar={false}
                height={720}
                initialView="timeGridWeek"
                locale={calendarLocale}
                nowIndicator
                plugins={[
                  classicThemePlugin,
                  dayGridPlugin,
                  timeGridPlugin,
                  interactionPlugin,
                ]}
                ref={calendarRef}
                scrollTime="08:00:00"
                select={applySelection}
                selectAllow={(selection) => selection.start >= new Date()}
                selectable
                selectMirror
                slotDuration="00:30:00"
                slotHeaderFormat={{
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }}
                slotMaxTime="21:00:00"
                slotMinTime="07:00:00"
                snapDuration="00:15:00"
                weekends
              />
            </div>

            <div className="flex items-center gap-2 border-border-light border-t px-5 py-3 text-text-muted text-xs">
              <CalendarIcon className="h-4 w-4 text-primary-blue" />
              {areMeetingsLoading ? t("loadingMeetings") : t("calendarHint")}
            </div>
          </section>

          <aside className="surface-card p-5 xl:sticky xl:top-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-primary-blue text-xs uppercase tracking-[0.08em]">
                  {t("invitation")}
                </p>
                <h2 className="section-title mt-1">{t("details")}</h2>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-blue-light font-bold text-primary-blue">
                {candidate.name.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="mb-5 rounded-xl bg-bg-input p-3.5">
              <p className="font-semibold text-sm text-text-heading">
                {candidate.name}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-text-secondary text-xs">
                <MailIcon className="h-3.5 w-3.5" />
                {candidateEmail || t("noEmail")}
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label={t("meetingTitle")}
                maxLength={255}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("titlePlaceholder")}
                value={title}
              />

              <Input
                label={t("date")}
                min={toMeetingDateValue(new Date())}
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t("startsAt")}
                  onChange={(event) =>
                    handleStartTimeChange(event.target.value)
                  }
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
                <div className="flex gap-2">
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
                label={t("description")}
                maxLength={5000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("descriptionPlaceholder")}
                textareaClassName="min-h-24"
                value={description}
              />

              <p className="text-text-muted text-xs">
                {t("timeZone", { timeZone })}
              </p>

              <FeedbackPresence show={Boolean(formError)}>
                <div className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2.5 text-danger-red text-sm">
                  {formError}
                </div>
              </FeedbackPresence>

              <FeedbackPresence show={Boolean(sentMeetingTitle)}>
                <div className="rounded-lg border border-success-green/20 bg-success-green-bg px-3 py-2.5 text-green-700 text-sm">
                  <span className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    {t("sentSuccess", { title: sentMeetingTitle ?? "" })}
                  </span>
                </div>
              </FeedbackPresence>

              <button
                className="ui-button ui-button-primary w-full"
                disabled={createMeeting.isPending || !candidateEmail}
                onClick={submitMeeting}
                type="button"
              >
                <LoadingButtonContent
                  isLoading={createMeeting.isPending}
                  label={t("sendInvite")}
                  loadingLabel={t("sendingInvite")}
                />
              </button>

              <p className="text-center text-text-muted text-xs leading-5">
                {candidateEmail ? t("rsvpHint") : t("emailMissing")}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
