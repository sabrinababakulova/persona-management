import nodemailer from "nodemailer";
import "server-only";

import { env } from "~/env";
import {
  buildCandidateMeetingIcal,
  type CandidateMeetingInvitationData,
} from "~/server/calendar/candidate-meeting-ical";

interface SendCandidateMeetingInvitationInput
  extends CandidateMeetingInvitationData {
  organizerReplyToEmail?: string | null;
  timeZone: string;
}

const transporter = nodemailer.createTransport({
  host: "smtp.yandex.ru",
  port: 465,
  secure: true,
  auth: {
    user: env.MAIL_LOGIN,
    pass: env.MAIL_LOGIN_PASSWORD,
  },
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMeetingDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

/** Sends a simple MIME message with one iCalendar REQUEST for broad client compatibility. */
export async function sendCandidateMeetingInvitation(
  input: SendCandidateMeetingInvitationInput,
) {
  const calendarContent = buildCandidateMeetingIcal(input);
  const start = formatMeetingDate(input.startAt, input.timeZone);
  const end = new Intl.DateTimeFormat("ru-RU", {
    timeStyle: "short",
    timeZone: input.timeZone,
  }).format(input.endAt);
  const location = input.location?.trim();
  const description = input.description?.trim();

  const textLines = [
    `${input.organizerName} приглашает вас на встречу «${input.title}».`,
    `Когда: ${start}–${end} (${input.timeZone})`,
    location ? `Где: ${location}` : "",
    description ? `Описание: ${description}` : "",
    "Ответьте на приглашение с помощью кнопок календаря в письме.",
  ].filter(Boolean);

  const detailsHtml = [
    `<p style="margin:0 0 10px"><strong>Когда:</strong> ${escapeHtml(start)}–${escapeHtml(end)} (${escapeHtml(input.timeZone)})</p>`,
    location
      ? `<p style="margin:0 0 10px"><strong>Где:</strong> ${escapeHtml(location)}</p>`
      : "",
    description
      ? `<p style="margin:18px 0 0;white-space:pre-wrap">${escapeHtml(description)}</p>`
      : "",
  ].join("");

  await transporter.sendMail({
    from: `"Talanty" <${env.MAIL_LOGIN}>`,
    to: input.candidateEmail,
    replyTo: input.organizerReplyToEmail || undefined,
    subject: `Приглашение: ${input.title}`,
    text: textLines.join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;color:#1c1c1e;line-height:1.55"><h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(input.title)}</h1><p style="margin:0 0 18px">${escapeHtml(input.organizerName)} приглашает вас на встречу.</p>${detailsHtml}<p style="margin:22px 0 0;color:#616c81">Ответьте на приглашение с помощью кнопок календаря в письме.</p></div>`,
    icalEvent: {
      filename: "meeting-invitation.ics",
      method: "REQUEST",
      content: calendarContent,
    },
  });
}
