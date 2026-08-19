// @ts-nocheck -- Chrome extension APIs are provided by the browser runtime.
const SESSION_KEY = "pendingOlxConnection";
const REQUEST_CONTEXT_KEY = "olxRequestContext";
const OLX_URL = "https://www.olx.uz/adding/";
const CONNECTION_TTL_MS = 15 * 60 * 1000;
const ALLOWED_COOKIE_NAMES = new Set(["access_token", "deviceGUID"]);

function sanitizeCookieHeader(header) {
  return header
    .split(";")
    .flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return [];
      const name = part.slice(0, separator).trim();
      if (!ALLOWED_COOKIE_NAMES.has(name)) return [];
      return [`${name}=${part.slice(separator + 1).trim()}`];
    })
    .join("; ");
}

function headerValue(headers, name) {
  return headers
    ?.find((header) => header.name.toLowerCase() === name.toLowerCase())
    ?.value?.trim();
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const deviceId = headerValue(details.requestHeaders, "x-device-id");
    const fingerprint = headerValue(details.requestHeaders, "x-fingerprint");
    const authorization = headerValue(details.requestHeaders, "authorization");
    const cookieHeader = sanitizeCookieHeader(
      headerValue(details.requestHeaders, "cookie") || "",
    );
    const userAgent = headerValue(details.requestHeaders, "user-agent");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : null;
    if (
      !deviceId ||
      !fingerprint ||
      !accessToken ||
      !cookieHeader ||
      !userAgent ||
      details.tabId < 0
    )
      return;

    // Keep only a one-way digest of the active Authorization token. This lets
    // the connector select the exact Auth0 cache entry used by OLX without
    // storing or transmitting the request's Authorization header.
    void sha256Text(accessToken).then((accessTokenDigest) =>
      chrome.storage.session.set({
        [REQUEST_CONTEXT_KEY]: {
          tabId: details.tabId,
          deviceId,
          fingerprint,
          cookieHeader,
          userAgent,
          accessTokenDigest,
          capturedAt: Date.now(),
        },
      }),
    );
  },
  { urls: ["https://www.olx.uz/api/v1/*"] },
  ["requestHeaders", "extraHeaders"],
);

function isPersonaOrigin(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return true;
    }
    return url.protocol === "https:" && url.hostname === "admin.talanty.uz";
  } catch {
    return false;
  }
}

function isOlxUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "olx.uz" || url.hostname.endsWith(".olx.uz"))
    );
  } catch {
    return false;
  }
}

async function getPendingConnection() {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  const pending = stored[SESSION_KEY];
  if (!pending || pending.expiresAt <= Date.now()) {
    await chrome.storage.session.remove(SESSION_KEY);
    await chrome.storage.session.remove(REQUEST_CONTEXT_KEY);
    return null;
  }
  return pending;
}

async function notifyPersona(pending, type, detail) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (
      !tab.id ||
      !tab.url ||
      !tab.url.startsWith(`${pending.personaOrigin}/`)
    ) {
      continue;
    }
    await chrome.tabs
      .sendMessage(tab.id, { type, detail })
      .catch(() => undefined);
  }
}

async function focusPersona(pending) {
  const tabs = await chrome.tabs.query({});
  const tab = tabs.find(
    (candidate) =>
      candidate.id && candidate.url?.startsWith(`${pending.personaOrigin}/`),
  );
  if (!tab?.id) return;
  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId)
    await chrome.windows.update(tab.windowId, { focused: true });
}

async function extractOlxCredentials(activeAccessTokenDigest) {
  const clientId = "4b7edpvrarh6co2rp6lhae0jva";
  const tokenEntries = [];

  async function digestToken(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith("@@auth0spajs@@::") || !key.includes(clientId)) {
      continue;
    }

    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
      const body = parsed?.body;
      if (
        typeof body?.access_token === "string" &&
        typeof body?.refresh_token === "string"
      ) {
        tokenEntries.push({ parsed, body });
      }
    } catch {
      // Ignore unrelated or malformed local-storage values.
    }
  }

  let tokenEntry = null;
  for (const candidate of tokenEntries) {
    if (
      (await digestToken(candidate.body.access_token)) ===
      activeAccessTokenDigest
    ) {
      tokenEntry = candidate;
      break;
    }
  }

  if (!tokenEntry) return null;
  const rawExpiresAt = tokenEntry.parsed.expiresAt;
  const expiresAt =
    typeof rawExpiresAt === "number"
      ? rawExpiresAt < 1_000_000_000_000
        ? rawExpiresAt * 1000
        : rawExpiresAt
      : undefined;

  return {
    version: 1,
    source: "olx_ciam",
    accessToken: tokenEntry.body.access_token,
    refreshToken: tokenEntry.body.refresh_token,
    ...(expiresAt ? { expiresAt } : {}),
    ...(typeof tokenEntry.body.scope === "string"
      ? { scope: tokenEntry.body.scope }
      : {}),
  };
}

async function startConnection(message, sender) {
  if (
    !sender.tab?.id ||
    !sender.tab.url ||
    !isPersonaOrigin(message.personaOrigin) ||
    new URL(sender.tab.url).origin !== message.personaOrigin ||
    typeof message.ticket !== "string" ||
    message.ticket.length < 40
  ) {
    throw new Error("Некорректный запрос на подключение Talanty.");
  }

  const pending = {
    personaOrigin: message.personaOrigin,
    ticket: message.ticket,
    expiresAt: Math.min(
      Number(message.expiresAt) || Date.now() + CONNECTION_TTL_MS,
      Date.now() + CONNECTION_TTL_MS,
    ),
  };
  await chrome.storage.session.remove(REQUEST_CONTEXT_KEY);
  await chrome.storage.session.set({ [SESSION_KEY]: pending });
  await chrome.tabs.create({ url: OLX_URL, active: true });
  return { ok: true };
}

async function completeConnection(sender) {
  if (!sender.tab?.id || !sender.tab.url || !isOlxUrl(sender.tab.url)) {
    throw new Error(
      "Откройте официальный сайт olx.uz, чтобы завершить подключение.",
    );
  }

  const pending = await getPendingConnection();
  if (!pending) {
    throw new Error(
      "Время подключения истекло. Начните подключение заново в Talanty.",
    );
  }

  const storedContext = await chrome.storage.session.get(REQUEST_CONTEXT_KEY);
  const requestContext = storedContext[REQUEST_CONTEXT_KEY];
  if (
    !requestContext ||
    requestContext.tabId !== sender.tab.id ||
    typeof requestContext.accessTokenDigest !== "string" ||
    typeof requestContext.cookieHeader !== "string" ||
    typeof requestContext.userAgent !== "string" ||
    requestContext.capturedAt < Date.now() - CONNECTION_TTL_MS
  ) {
    throw new Error(
      "Данные входа olx.uz ещё не готовы. Обновите эту вкладку, дождитесь полной загрузки и снова нажмите кнопку подключения.",
    );
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    world: "MAIN",
    func: extractOlxCredentials,
    args: [requestContext.accessTokenDigest],
  });
  const credentials = results[0]?.result;
  if (!credentials) {
    throw new Error(
      "Вход в olx.uz не найден. Полностью войдите в аккаунт и один раз нажмите кнопку подключения.",
    );
  }
  credentials.deviceId = requestContext.deviceId;
  credentials.fingerprint = requestContext.fingerprint;
  credentials.cookieHeader = requestContext.cookieHeader;
  credentials.userAgent = requestContext.userAgent;

  let response;
  try {
    response = await fetch(
      `${pending.personaOrigin}/api/integrations/olx/token-connect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: pending.ticket, credentials }),
      },
    );
  } finally {
    await chrome.storage.session.remove(REQUEST_CONTEXT_KEY);
    credentials.accessToken = "";
    credentials.refreshToken = "";
    credentials.deviceId = "";
    credentials.fingerprint = "";
    credentials.cookieHeader = "";
    credentials.userAgent = "";
    requestContext.cookieHeader = "";
    requestContext.userAgent = "";
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.session.remove(SESSION_KEY);
    }
    const errorMessages = {
      reauth_required:
        "olx.uz не принял текущий вход. Выйдите из аккаунта olx.uz, войдите снова и повторите подключение.",
      ticket_invalid_or_expired:
        "Время подключения истекло. Начните подключение заново в Talanty.",
      rate_limited:
        "Слишком много попыток подключения. Подождите минуту и попробуйте снова.",
      invalid_request:
        "Talanty получил неполные данные входа. Обновите вкладку olx.uz и повторите подключение.",
      payload_too_large:
        "Talanty получил слишком много данных. Обновите расширение и повторите подключение.",
      unavailable:
        "Сервис проверки olx.uz временно недоступен. Попробуйте ещё раз через несколько минут.",
      connection_failed:
        "Talanty не смог сохранить подключение. Попробуйте ещё раз через несколько минут.",
    };
    throw new Error(
      errorMessages[result.error] ||
        "Не удалось проверить аккаунт olx.uz. Попробуйте ещё раз через несколько минут.",
    );
  }

  await chrome.storage.session.remove(SESSION_KEY);
  await notifyPersona(pending, "PERSONA_OLX_CONNECTION_COMPLETE", {
    account: result.account || null,
  });
  await focusPersona(pending);
  return { ok: true, account: result.account || null };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const run = async () => {
    switch (message?.type) {
      case "PERSONA_OLX_START_CONNECTION":
        return startConnection(message, sender);
      case "PERSONA_OLX_GET_STATUS": {
        const pending = await getPendingConnection();
        return { ok: true, pending: Boolean(pending) };
      }
      case "PERSONA_OLX_COMPLETE_CONNECTION":
        return completeConnection(sender);
      default:
        return { ok: false, error: "Неподдерживаемая команда расширения." };
    }
  };

  run()
    .then(sendResponse)
    .catch(async (error) => {
      const pending = await getPendingConnection();
      const messageText =
        error instanceof Error
          ? error.message
          : "Не удалось подключить аккаунт olx.uz.";
      if (pending) {
        await notifyPersona(pending, "PERSONA_OLX_CONNECTION_ERROR", {
          message: messageText,
        });
      }
      sendResponse({ ok: false, error: messageText });
    });
  return true;
});
