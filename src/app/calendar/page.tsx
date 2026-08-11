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
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ArrowLeftIcon, MailIcon, PlusIcon } from "~/app/_components/icons";
import { Modal } from "~/app/_components/modal";
import { MotionToast } from "~/app/_components/motion-system";
import { api } from "~/trpc/react";
import { getInitialMeetingSlot } from "~/utils/meeting-date";
import { CreateMeetingModal } from "./create-meeting-modal";

type CalendarView = "timeGridDay" | "timeGridWeek" | "dayGridMonth";

function isHttpUrl(value: string | null) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function RecruiterCalendarPage() {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const calendarRef = useRef<CalendarRef>(null);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [activeView, setActiveView] = useState<CalendarView>("timeGridWeek");
  const [isCalendarReady, setIsCalendarReady] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Date>();
  const [draftEnd, setDraftEnd] = useState<Date>();
  const [successTitle, setSuccessTitle] = useState<string | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    null,
  );
  const { data: meetings = [], isLoading } =
    api.candidates.listMyMeetings.useQuery();

  const calendarLocale =
    locale === "uz" ? uzLocale : locale === "en" ? enGbLocale : ruLocale;
  const intlLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const weekdayFormatter = new Intl.DateTimeFormat(intlLocale, {
    weekday: "short",
  });
  const selectedMeeting = meetings.find(
    (meeting) => meeting.id === selectedMeetingId,
  );
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
      candidateName: meeting.candidateName,
      invitationStatus: meeting.invitationStatus,
    },
  }));

  useEffect(() => {
    setIsCalendarReady(true);
  }, []);

  useEffect(() => {
    if (!isCalendarReady) {
      return;
    }

    if (window.matchMedia("(max-width: 767px)").matches) {
      calendarRef.current?.getApi().changeView("timeGridDay");
      setActiveView("timeGridDay");
    }
  }, [isCalendarReady]);

  function openCreateModal(start?: Date, end?: Date) {
    const fallback = getInitialMeetingSlot();
    setDraftStart(start ?? fallback.start);
    setDraftEnd(end ?? fallback.end);
    setSuccessTitle(null);
    setIsCreateModalOpen(true);
  }

  function handleCalendarSelection(selection: DateSelectInfo) {
    let start = selection.start;
    let end = selection.end;

    if (selection.allDay) {
      start = new Date(selection.start);
      start.setHours(10, 0, 0, 0);
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    openCreateModal(start, end);
    calendarRef.current?.getApi().unselect();
  }

  function changeCalendarView(view: CalendarView) {
    calendarRef.current?.getApi().changeView(view);
    setActiveView(view);
  }

  const selectedMeetingTime = selectedMeeting
    ? new Intl.DateTimeFormat(intlLocale, {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: selectedMeeting.timeZone,
      }).formatRange(selectedMeeting.startAt, selectedMeeting.endAt)
    : "";

  return (
    <>
      <main className="recruiter-calendar-workspace h-full min-h-0 flex-1 overflow-hidden bg-bg-light">
        <section className="flex h-full min-h-0 flex-col">
          <header className="recruiter-calendar-toolbar">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="shrink-0 font-bold text-text-heading text-xl tracking-[-0.03em] sm:text-2xl">
                {t("title")}
              </h1>
              <span className="hidden h-5 w-px bg-border-light 2xl:block" />
              <span className="hidden truncate text-text-muted text-xs 2xl:block">
                {isLoading
                  ? t("loading")
                  : t("meetingCount", { count: meetings.length })}
              </span>
            </div>

            <div className="recruiter-calendar-navigation">
              <button
                className="ui-button ui-button-secondary min-h-9"
                onClick={() => calendarRef.current?.getApi().today()}
                type="button"
              >
                {t("today")}
              </button>
              <div className="flex items-center">
                <button
                  aria-label={t("previousPeriod")}
                  className="meeting-calendar-nav-button"
                  onClick={() => calendarRef.current?.getApi().prev()}
                  type="button"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <button
                  aria-label={t("nextPeriod")}
                  className="meeting-calendar-nav-button"
                  onClick={() => calendarRef.current?.getApi().next()}
                  type="button"
                >
                  <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                </button>
              </div>
              <h2 className="min-w-0 truncate font-semibold text-base text-text-heading tracking-[-0.02em] sm:text-lg">
                {calendarTitle}
              </h2>
            </div>

            <div className="recruiter-calendar-actions">
              <div className="flex rounded-xl bg-bg-input p-1">
                {(
                  [
                    ["timeGridDay", t("day")],
                    ["timeGridWeek", t("week")],
                    ["dayGridMonth", t("month")],
                  ] as const
                ).map(([view, label]) => (
                  <button
                    aria-pressed={activeView === view}
                    className="meeting-calendar-view-button"
                    data-active={activeView === view}
                    key={view}
                    onClick={() => changeCalendarView(view)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="ui-button ui-button-primary shrink-0"
                onClick={() => openCreateModal()}
                type="button"
              >
                <PlusIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{t("createMeeting")}</span>
                <span className="sm:hidden">{t("createMeetingShort")}</span>
              </button>
            </div>
          </header>

          <div className="meeting-calendar-shell recruiter-calendar-shell min-h-0 flex-1">
            {isCalendarReady ? (
              <FullCalendar
                allDaySlot={false}
                datesSet={(info) => {
                  setCalendarTitle(info.view.title);
                  setActiveView(info.view.type as CalendarView);
                }}
                dayCellTopContent={(info) => (
                  <span
                    className="recruiter-calendar-month-date"
                    data-today={info.isToday}
                  >
                    {info.dayNumberText}
                  </span>
                )}
                dayHeaderContent={(info) => {
                  const weekday = weekdayFormatter
                    .format(info.date)
                    .replace(".", "");

                  if (info.view.type === "dayGridMonth") {
                    return (
                      <span className="recruiter-calendar-month-weekday">
                        {weekday}
                      </span>
                    );
                  }

                  return (
                    <div className="recruiter-calendar-day-heading">
                      <span>{weekday}</span>
                      <strong data-today={info.isToday}>
                        {info.date.getDate()}
                      </strong>
                    </div>
                  );
                }}
                dayMaxEvents={4}
                editable={false}
                eventClick={(info) => setSelectedMeetingId(info.event.id)}
                eventContent={(eventInfo) => {
                  const isMonth = eventInfo.view.type === "dayGridMonth";

                  return (
                    <div
                      className="meeting-calendar-event-content recruiter-calendar-event-content"
                      data-compact={isMonth}
                    >
                      <span className="meeting-calendar-event-title">
                        {eventInfo.event.title}
                      </span>
                      {/* {isMonth ? null : (
                        <span className="recruiter-calendar-event-candidate">
                          {String(eventInfo.event.extendedProps.candidateName)}
                        </span>
                      )} */}
                    </div>
                  );
                }}
                eventDidMount={(info) => {
                  const candidateName = String(
                    info.event.extendedProps.candidateName,
                  );
                  info.el.title = `${info.event.title} — ${candidateName}`;
                }}
                eventMinHeight={28}
                eventShortHeight={38}
                events={calendarEvents}
                expandRows
                firstDay={1}
                fixedWeekCount={false}
                headerToolbar={false}
                height="100%"
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
                scrollTimeReset={false}
                select={handleCalendarSelection}
                selectAllow={(selection) => selection.start >= new Date()}
                selectable
                selectMirror
                slotDuration="00:30:00"
                slotHeaderContent={(info) => (
                  <span className="recruiter-calendar-slot-label">
                    {info.text}
                  </span>
                )}
                slotHeaderFormat={{
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }}
                slotHeaderInterval="01:00:00"
                slotMaxTime="24:00:00"
                slotMinHeight={24}
                slotMinTime="00:00:00"
                snapDuration="00:15:00"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                {t("loading")}
              </div>
            )}
          </div>
        </section>
      </main>

      <MotionToast
        message={
          successTitle ? t("createdSuccess", { title: successTitle }) : null
        }
      />

      <CreateMeetingModal
        initialEnd={draftEnd}
        initialStart={draftStart}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(meetingTitle) => {
          setIsCreateModalOpen(false);
          setSuccessTitle(meetingTitle);
        }}
      />

      <Modal
        isOpen={Boolean(selectedMeeting)}
        maxWidthClassName="max-w-[520px]"
        onClose={() => setSelectedMeetingId(null)}
        title={selectedMeeting?.title}
      >
        {selectedMeeting ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-bg-input p-4">
              <p className="font-semibold text-text-heading">
                {selectedMeeting.candidateName}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
                <MailIcon className="h-4 w-4" />
                {selectedMeeting.candidateEmail}
              </p>
            </div>

            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-text-muted text-xs uppercase tracking-[0.06em]">
                  {t("when")}
                </dt>
                <dd className="mt-1.5 text-text-heading">
                  {selectedMeetingTime}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-text-muted text-xs uppercase tracking-[0.06em]">
                  {t("deliveryStatus")}
                </dt>
                <dd className="mt-1.5 text-text-heading">
                  {selectedMeeting.invitationStatus === "sent"
                    ? t("invitationSent")
                    : t("invitationFailed")}
                </dd>
              </div>
            </dl>

            {selectedMeeting.location ? (
              <div>
                <p className="font-semibold text-text-muted text-xs uppercase tracking-[0.06em]">
                  {t("location")}
                </p>
                {isHttpUrl(selectedMeeting.location) ? (
                  <a
                    className="mt-1.5 block break-all text-primary-blue text-sm hover:text-primary-blue-dark"
                    href={selectedMeeting.location}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {selectedMeeting.location}
                  </a>
                ) : (
                  <p className="mt-1.5 text-sm text-text-heading">
                    {selectedMeeting.location}
                  </p>
                )}
              </div>
            ) : null}

            {selectedMeeting.description ? (
              <div>
                <p className="font-semibold text-text-muted text-xs uppercase tracking-[0.06em]">
                  {t("message")}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-text-heading leading-6">
                  {selectedMeeting.description}
                </p>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Link
                className="ui-button ui-button-secondary"
                href={`/candidates/${selectedMeeting.candidateId}`}
              >
                {t("openCandidate")}
              </Link>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
