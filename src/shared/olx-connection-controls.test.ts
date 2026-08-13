import { describe, expect, test } from "bun:test";
import { getOlxConnectionControlsState } from "~/shared/olx-connection-controls";

describe("OLX connection form controls", () => {
  test("keeps credentials writable when the server browser is unavailable", () => {
    expect(
      getOlxConnectionControlsState({
        isPending: false,
        browserAvailable: false,
        hasCredentials: false,
      }),
    ).toEqual({
      inputsDisabled: false,
      submitDisabled: true,
    });
  });

  test("enables submission only when the browser and credentials are ready", () => {
    expect(
      getOlxConnectionControlsState({
        isPending: false,
        browserAvailable: true,
        hasCredentials: true,
      }),
    ).toEqual({
      inputsDisabled: false,
      submitDisabled: false,
    });
  });

  test("locks credentials while a connection request is running", () => {
    expect(
      getOlxConnectionControlsState({
        isPending: true,
        browserAvailable: true,
        hasCredentials: true,
      }),
    ).toEqual({
      inputsDisabled: true,
      submitDisabled: true,
    });
  });
});
