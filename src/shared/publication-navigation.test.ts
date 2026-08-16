import { describe, expect, test } from "bun:test";
import {
  getPublicationCreationUrl,
  OLX_ACCOUNT_SETTINGS_URL,
} from "./publication-navigation";

describe("publication creation navigation", () => {
  test("sends disconnected OLX users to the OLX account settings section", () => {
    expect(
      getPublicationCreationUrl({
        channel: "olx.uz",
        isOlxConnected: false,
        vacancyId: "vacancy-1",
      }),
    ).toBe(OLX_ACCOUNT_SETTINGS_URL);
  });

  test("opens the OLX publication form for connected users", () => {
    expect(
      getPublicationCreationUrl({
        channel: "olx.uz",
        isOlxConnected: true,
        vacancyId: "vacancy-1",
      }),
    ).toBe("/vacancies/vacancy-1/publications/olx.uz");
  });

  test("leaves other publication channels unchanged", () => {
    expect(
      getPublicationCreationUrl({
        channel: "telegram",
        isOlxConnected: false,
        vacancyId: "vacancy/1",
      }),
    ).toBe("/vacancies/vacancy%2F1/publications/telegram");
  });
});
