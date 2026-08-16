// @ts-nocheck -- Chrome extension APIs are provided by the browser runtime.
const PAGE_SOURCE = "persona-olx-connector-page";
const EXTENSION_SOURCE = "persona-olx-connector-extension";

window.postMessage(
  { source: EXTENSION_SOURCE, type: "PERSONA_OLX_CONNECTOR_READY" },
  window.location.origin,
);

window.addEventListener("message", (event) => {
  if (
    event.source !== window ||
    event.origin !== window.location.origin ||
    event.data?.source !== PAGE_SOURCE
  ) {
    return;
  }

  if (event.data.type === "PERSONA_OLX_CONNECTOR_PING") {
    window.postMessage(
      { source: EXTENSION_SOURCE, type: "PERSONA_OLX_CONNECTOR_READY" },
      window.location.origin,
    );
    return;
  }

  if (event.data.type !== "PERSONA_OLX_START_CONNECTION") return;
  chrome.runtime.sendMessage(
    {
      type: "PERSONA_OLX_START_CONNECTION",
      personaOrigin: window.location.origin,
      ticket: event.data.ticket,
      expiresAt: event.data.expiresAt,
    },
    (response) => {
      if (response?.ok) return;
      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          type: "PERSONA_OLX_CONNECTION_ERROR",
          detail: {
            message: response?.error || "Не удалось начать подключение olx.uz.",
          },
        },
        window.location.origin,
      );
    },
  );
});

chrome.runtime.onMessage.addListener((message) => {
  if (
    message?.type !== "PERSONA_OLX_CONNECTION_COMPLETE" &&
    message?.type !== "PERSONA_OLX_CONNECTION_ERROR"
  ) {
    return;
  }
  window.postMessage(
    {
      source: EXTENSION_SOURCE,
      type: message.type,
      detail: message.detail,
    },
    window.location.origin,
  );
});
