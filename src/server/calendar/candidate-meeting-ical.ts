import ical, {
  ICalAttendeeRole,
  ICalAttendeeStatus,
  ICalAttendeeType,
  ICalCalendarMethod,
  ICalEventBusyStatus,
  ICalEventStatus,
  ICalEventTransparency,
} from "ical-generator";

export interface CandidateMeetingInvitationData {
  candidateName: string;
  candidateEmail: string;
  organizerName: string;
  organizerEmail: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: Date;
  endAt: Date;
  invitationUid: string;
  createdAt?: Date;
}

/**
 * Creates an RFC 5545 meeting request. Dates stay as UTC instants so the
 * recipient's calendar can display them in its own configured time zone.
 */
export function buildCandidateMeetingIcal(
  input: CandidateMeetingInvitationData,
) {
  const createdAt = input.createdAt ?? new Date();
  const calendar = ical({
    method: ICalCalendarMethod.REQUEST,
    name: input.title,
    prodId: {
      company: "Talanty",
      product: "Persona Management",
      language: "RU",
    },
  });

  calendar.createEvent({
    id: input.invitationUid,
    sequence: 0,
    start: input.startAt,
    end: input.endAt,
    summary: input.title,
    description: input.description?.trim() || undefined,
    location: input.location?.trim() || undefined,
    organizer: {
      name: input.organizerName,
      email: input.organizerEmail,
    },
    attendees: [
      {
        name: input.candidateName,
        email: input.candidateEmail,
        role: ICalAttendeeRole.REQ,
        status: ICalAttendeeStatus.NEEDSACTION,
        type: ICalAttendeeType.INDIVIDUAL,
        rsvp: true,
      },
    ],
    status: ICalEventStatus.CONFIRMED,
    busystatus: ICalEventBusyStatus.BUSY,
    transparency: ICalEventTransparency.OPAQUE,
    created: createdAt,
    lastModified: createdAt,
  });

  return calendar.toString();
}
