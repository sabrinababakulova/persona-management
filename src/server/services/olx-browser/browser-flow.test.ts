import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { type Browser, chromium } from "playwright-core";
import {
  connectOlxBrowserSession,
  fillOlxAdvertForm,
  htmlToOlxPlainText,
  maskOlxLogin,
  normalizeOlxLoginForForm,
  type OlxAdvertInput,
  publishOlxAdvertWithBrowser,
} from "./browser-flow";
import { resolveOlxBrowserExecutable } from "./runtime";

const executablePath = resolveOlxBrowserExecutable();

// Cold Chromium startup can exceed Bun's 5-second default on CI or a busy
// development machine. Keep browser-flow tests deterministic without changing
// the production navigation/action timeouts.
setDefaultTimeout(20_000);

const advert: OlxAdvertInput = {
  title: "Менеджер по продажам",
  descriptionHtml:
    "<p>Ищем менеджера в дружную команду.</p><ul><li>Работа с клиентами</li></ul>",
  salaryFrom: 5_000_000,
  salaryTo: 8_000_000,
  salaryCurrency: "UZS",
  meta: {
    categoryPath: ["Работа", "Вакансии"],
    location: "Ташкент",
    employmentType: "Полная занятость",
    schedule: "Полный день",
    experience: "От 1 года до 3 лет",
    contactName: "Тестовый рекрутер",
    contactPhone: "+998901234567",
    salaryNegotiable: false,
    remoteWork: true,
    onlineRecruitment: false,
  },
};

function loginHtml() {
  return `<!doctype html><html lang="ru"><body>
    <header><button type="button" tabindex="-1">Войти</button></header>
    <form action="/session" method="post">
      <label>Электронная почта или телефон<input name="login" type="email"></label>
      <label>Пароль<input name="password" type="password"></label>
      <button type="submit">Войти</button>
    </form>
  </body></html>`;
}

function accountEntryHtml() {
  return `<!doctype html><html lang="ru"><body>
    <a href="/account">Ваш профиль</a>
  </body></html>`;
}

function accountEntryRedirectRaceHtml() {
  return `<!doctype html><html lang="ru"><body>
    <a href="/account-aborted">Ваш профиль</a>
    <script>setTimeout(() => location.assign("/login"), 1800)</script>
  </body></html>`;
}

function advertHtml() {
  return `<!doctype html><html lang="ru"><body>
    <form action="/publish" method="post">
      <label>Название объявления<input name="title"></label>
      <label>Описание<textarea name="description"></textarea></label>
      <label>Город<select name="location"><option>Ташкент</option></select></label>
      <label>Тип занятости<select name="employment"><option>Полная занятость</option></select></label>
      <label>График работы<select name="schedule"><option>Полный день</option></select></label>
      <label>Опыт работы<select name="experience"><option>От 1 года до 3 лет</option></select></label>
      <label>Зарплата от<input name="salaryFrom"></label>
      <label>Зарплата до<input name="salaryTo"></label>
      <label>Контактное лицо<input name="contact_name"></label>
      <label>Номер телефона<input name="phone" type="tel"></label>
      <label><input name="negotiable" type="checkbox">Зарплата договорная</label>
      <label><input name="remote" type="checkbox">Удаленная работа</label>
      <label><input name="online" type="checkbox">Онлайн-рекрутинг</label>
      <button type="submit">Опубликовать</button>
    </form>
  </body></html>`;
}

describe("OLX browser flow", () => {
  let server: ReturnType<typeof Bun.serve>;
  let browser: Browser | null = null;
  let origin = "";

  beforeAll(async () => {
    server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/adding") {
          const authenticated = request.headers
            .get("cookie")
            ?.includes("olx_session=fixture");
          return authenticated
            ? new Response(advertHtml(), {
                headers: { "content-type": "text/html; charset=utf-8" },
              })
            : Response.redirect(`${url.origin}/login`, 302);
        }
        if (url.pathname === "/adding-account-entry") {
          return new Response(accountEntryHtml(), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        if (url.pathname === "/adding-account-redirect-race") {
          return new Response(accountEntryRedirectRaceHtml(), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        if (url.pathname === "/account") {
          return Response.redirect(`${url.origin}/login`, 302);
        }
        if (url.pathname === "/account-aborted") {
          // Chromium keeps the current document for a 204 navigation and
          // Playwright reports page.goto as net::ERR_ABORTED. The timer in the
          // entry page then completes the same redirect race OLX exhibits.
          return new Response(null, { status: 204 });
        }
        if (url.pathname === "/login") {
          return new Response(loginHtml(), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        if (url.pathname === "/session" && request.method === "POST") {
          const form = await request.formData();
          if (
            form.get("login") !== "test@example.com" ||
            form.get("password") !== "correct-password"
          ) {
            return new Response(
              `${loginHtml()}<p>Неверный логин или пароль</p>`,
              { headers: { "content-type": "text/html; charset=utf-8" } },
            );
          }
          return new Response(null, {
            status: 302,
            headers: {
              location: "/adding",
              "set-cookie":
                "olx_session=fixture; Path=/; HttpOnly; SameSite=Lax",
            },
          });
        }
        if (url.pathname === "/publish" && request.method === "POST") {
          return Response.redirect(
            `${url.origin}/d/obyavlenie/test-vacancy-IDabc123.html`,
            302,
          );
        }
        if (url.pathname.includes("IDabc123.html")) {
          return new Response("published");
        }
        return new Response("not found", { status: 404 });
      },
    });
    origin = `http://127.0.0.1:${server.port}`;
    if (executablePath) {
      browser = await chromium.launch({ executablePath, headless: true });
    }
  });

  afterAll(async () => {
    await browser?.close();
    server.stop(true);
  });

  test("masks login identifiers", () => {
    expect(maskOlxLogin("sabrina@example.com")).toBe("sa***@example.com");
    expect(maskOlxLogin("+998 90 123 45 67")).toBe("***4567");
  });

  test("normalizes Uzbek phone numbers for OLX's local login field", () => {
    expect(normalizeOlxLoginForForm("+998 90 123 45 67")).toBe("901234567");
    expect(normalizeOlxLoginForForm("998901234567")).toBe("901234567");
    expect(normalizeOlxLoginForForm("90 123 45 67")).toBe("901234567");
    expect(normalizeOlxLoginForForm("test@example.com")).toBe(
      "test@example.com",
    );
  });

  test("converts editor HTML to OLX-safe plain text", () => {
    expect(htmlToOlxPlainText("<p>Hello</p><ul><li>World</li></ul>")).toBe(
      "Hello\n• World",
    );
  });

  test("fills the advert form without submitting it", async () => {
    if (!executablePath) return;
    if (!browser) throw new Error("Browser was not initialized");
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${origin}/adding`, { waitUntil: "domcontentloaded" });
    await context.addCookies([
      {
        name: "olx_session",
        value: "fixture",
        url: origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto(`${origin}/adding`, { waitUntil: "domcontentloaded" });

    await fillOlxAdvertForm(page, advert);

    expect(await page.locator('input[name="title"]').inputValue()).toBe(
      advert.title,
    );
    expect(
      await page.locator('textarea[name="description"]').inputValue(),
    ).toContain("Работа с клиентами");
    expect(await page.locator('input[name="remote"]').isChecked()).toBe(true);
    expect(await page.locator('input[name="phone"]').inputValue()).toBe(
      "+998901234567",
    );
    expect(page.url()).toBe(`${origin}/adding`);
    await context.close();
  });

  test("stores login state and submits only when dryRun is false", async () => {
    if (!executablePath) return;
    const connected = await connectOlxBrowserSession({
      login: "test@example.com",
      password: "correct-password",
      addingUrl: `${origin}/adding`,
    });
    expect(connected.loginHint).toBe("te***@example.com");
    expect(
      connected.storageState.cookies.some(
        (cookie) => cookie.name === "olx_session",
      ),
    ).toBe(true);

    const preview = await publishOlxAdvertWithBrowser({
      storageState: connected.storageState,
      advert,
      dryRun: true,
      addingUrl: `${origin}/adding`,
    });
    expect(preview.mode).toBe("preview");

    const published = await publishOlxAdvertWithBrowser({
      storageState: connected.storageState,
      advert,
      dryRun: false,
      addingUrl: `${origin}/adding`,
    });
    expect(published).toEqual({
      mode: "published",
      advertUrl: `${origin}/d/obyavlenie/test-vacancy-IDabc123.html`,
      advertId: "abc123",
    });
  });

  test("follows OLX's account entry page to the login form", async () => {
    if (!executablePath) return;
    const connected = await connectOlxBrowserSession({
      login: "test@example.com",
      password: "correct-password",
      addingUrl: `${origin}/adding-account-entry`,
    });

    expect(connected.loginHint).toBe("te***@example.com");
    expect(
      connected.storageState.cookies.some(
        (cookie) => cookie.name === "olx_session",
      ),
    ).toBe(true);
  });

  test("continues when OLX aborts the account navigation during its login redirect", async () => {
    if (!executablePath) return;
    const connected = await connectOlxBrowserSession({
      login: "test@example.com",
      password: "correct-password",
      addingUrl: `${origin}/adding-account-redirect-race`,
    });

    expect(connected.loginHint).toBe("te***@example.com");
    expect(
      connected.storageState.cookies.some(
        (cookie) => cookie.name === "olx_session",
      ),
    ).toBe(true);
  });
});
