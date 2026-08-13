export type OlxConnectionControlsState = {
  inputsDisabled: boolean;
  submitDisabled: boolean;
};

/**
 * Credentials stay editable while the server browser is unavailable so the
 * form does not look frozen. Only an active request locks the fields; the
 * submit button remains guarded until Chrome/Chromium is configured.
 */
export function getOlxConnectionControlsState(input: {
  isPending: boolean;
  browserAvailable: boolean;
  hasCredentials: boolean;
}): OlxConnectionControlsState {
  return {
    inputsDisabled: input.isPending,
    submitDisabled:
      input.isPending || !input.browserAvailable || !input.hasCredentials,
  };
}
