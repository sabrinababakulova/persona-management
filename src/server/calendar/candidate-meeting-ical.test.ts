import { describe, expect, test } from "bun:test";

import { buildCandidateMeetingIcal } from "./candidate-meeting-ical";

describe("buildCandidateMeetingIcal", () => {
  test("creates a request that asks the candidate to RSVP", () => {
    const content = buildCandidateMeetingIcal({
      candidateName: "Анна Каримова",
      candidateEmail: "anna@example.com",
      organizerName: "Мария Рекрутер",
      organizerEmail: "calendar@example.com",
      title: "Техническое интервью",
      description: "Обсудим опыт и задачи.",
      location: "https://meet.example.com/interview",
      startAt: new Date("2026-08-10T05:00:00.000Z"),
      endAt: new Date("2026-08-10T06:00:00.000Z"),
      invitationUid: "meeting-123@talanty.local",
      createdAt: new Date("2026-08-08T08:00:00.000Z"),
    });

    const unfoldedContent = content.replaceAll(/\r\n[ \t]/g, "");

    expect(unfoldedContent).toContain("METHOD:REQUEST");
    expect(unfoldedContent).toContain("UID:meeting-123@talanty.local");
    expect(unfoldedContent).toContain("DTSTART:20260810T050000Z");
    expect(unfoldedContent).toContain("DTEND:20260810T060000Z");
    expect(unfoldedContent).toContain(
      'ORGANIZER;CN="Мария Рекрутер":mailto:calendar@example.com',
    );
    expect(unfoldedContent).toContain("RSVP=TRUE");
    expect(unfoldedContent).toContain("PARTSTAT=NEEDS-ACTION");
    expect(unfoldedContent).toContain("MAILTO:anna@example.com");
  });
});
