import type { Locator, Page } from "playwright-core";
import type { OlxBrowserPublicationMeta } from "~/server/api/routers/vacancies/schemas";
import { type OlxStorageState, withOlxBrowser } from "./runtime";

export const OLX_ADDING_URL = "https://www.olx.uz/adding";

type OlxBrowserErrorCode =
  | "invalid_credentials"
  | "challenge_required"
  | "reauth_required"
  | "form_changed"
  | "publish_failed";

export class OlxBrowserFlowError extends Error {
  constructor(
    readonly code: OlxBrowserErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OlxBrowserFlowError";
  }
}

export type OlxAdvertInput = {
  title: string;
  descriptionHtml: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryCurrency: "UZS" | "USD";
  meta: OlxBrowserPublicationMeta;
};

export type OlxPublishResult =
  | { mode: "preview"; formUrl: string }
  | { mode: "published"; advertUrl: string; advertId: string | null };

const CHALLENGE_PATTERN =
  /captcha|recaptcha|hcaptcha|не робот|tasdiqlash|verification code|код подтверждения|одноразов|sms[- ]?код|код из sms/iu;
const INVALID_CREDENTIALS_PATTERN =
  /неверн(?:ый|ая)|incorrect|wrong password|пароль.*не подходит|foydalanuvchi.*topilmadi/iu;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function firstVisible(
  locators: Locator[],
  timeoutMs = 0,
): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  do {
    for (const locator of locators) {
      const count = Math.min(await locator.count().catch(() => 0), 25);
      for (let index = 0; index < count; index += 1) {
        const candidate = locator.nth(index);
        if (await candidate.isVisible().catch(() => false)) {
          return candidate;
        }
      }
    }
    if (Date.now() < deadline) {
      // DOM-only wait for client-rendered controls; it does not repeat a page
      // navigation or network request.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } while (Date.now() < deadline);
  return null;
}

function loginLocators(page: Page) {
  return {
    login: [
      page.getByRole("textbox", {
        name: /электронная почта|e-?mail|телефон|phone|pochta/iu,
      }),
      page.locator('input[type="email"]'),
      page.locator('input[name*="login" i]'),
    ],
    password: [
      page.getByLabel(/пароль|password|parol/iu),
      page.locator('input[type="password"]'),
    ],
  };
}

async function hasChallenge(page: Page): Promise<boolean> {
  const [body, challengeFrame] = await Promise.all([
    page
      .locator("body")
      .innerText()
      .catch(() => ""),
    page
      .locator(
        'iframe[src*="captcha" i], iframe[src*="recaptcha" i], iframe[src*="hcaptcha" i]',
      )
      .count()
      .catch(() => 0),
  ]);
  return challengeFrame > 0 || CHALLENGE_PATTERN.test(body);
}

async function isLoginPage(page: Page): Promise<boolean> {
  const url = new URL(page.url());
  if (url.hostname === "login.olx.uz") {
    return true;
  }
  const fields = loginLocators(page);
  return Boolean(
    (await firstVisible(fields.login)) && (await firstVisible(fields.password)),
  );
}

function isAllowedOlxAuthUrl(candidate: URL, addingUrl: string): boolean {
  const adding = new URL(addingUrl);
  const isRealOlxHost = /(?:^|\.)olx\.uz$/iu.test(adding.hostname);

  if (isRealOlxHost) {
    return (
      candidate.protocol === "https:" &&
      /(?:^|\.)olx\.uz$/iu.test(candidate.hostname)
    );
  }

  // Browser-flow tests use a local fixture. Keep navigation confined to the
  // fixture origin so an injected link cannot send the browser elsewhere.
  return candidate.origin === adding.origin;
}

async function waitForLoginPage(
  page: Page,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    if (await isLoginPage(page)) return true;
    if (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } while (Date.now() < deadline);
  return false;
}

/**
 * OLX currently renders an account entry page before redirecting to its
 * dedicated OAuth host. Older versions redirected /adding immediately, so we
 * support both flows and only follow an account link within the OLX domain.
 */
async function openOlxLoginPage(page: Page, addingUrl: string): Promise<void> {
  await page.goto(addingUrl, { waitUntil: "domcontentloaded" });
  if (await waitForLoginPage(page, 1_500)) return;

  const accountLink = await firstVisible(
    [
      page.getByRole("link", {
        name: /ваш профиль|мой профиль|войти|sign in|log in|kirish/iu,
      }),
      page.locator('a[href*="/account" i]'),
      page.locator('a[href*="login.olx.uz" i]'),
    ],
    2_000,
  );
  const href = await accountLink?.getAttribute("href");
  if (href) {
    const target = new URL(href, page.url());
    if (!isAllowedOlxAuthUrl(target, addingUrl)) {
      throw new OlxBrowserFlowError(
        "publish_failed",
        "OLX returned an unexpected login destination",
      );
    }
    await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
  }

  if (!(await waitForLoginPage(page, 5_000))) {
    throw new OlxBrowserFlowError(
      "publish_failed",
      "OLX did not show the expected login form",
    );
  }
}

export function maskOlxLogin(login: string): string {
  const value = login.trim();
  const at = value.indexOf("@");
  if (at > 1) {
    return `${value.slice(0, 2)}***${value.slice(at)}`;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `***${digits.slice(-4)}`;
  }
  return value.length > 2 ? `${value.slice(0, 2)}***` : "***";
}

/**
 * The OLX.uz login UI displays +998 next to its phone field and accepts only
 * the remaining nine digits. Email addresses are passed through unchanged.
 */
export function normalizeOlxLoginForForm(login: string): string {
  const value = login.trim();
  if (value.includes("@")) return value;

  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) {
    return digits.slice(3);
  }
  if (digits.length === 9) return digits;
  return value;
}

/** Completes OLX's normal login form and returns reusable browser state. */
export async function connectOlxBrowserSession(input: {
  login: string;
  password: string;
  addingUrl?: string;
}): Promise<{ storageState: OlxStorageState; loginHint: string }> {
  return withOlxBrowser({}, async (context) => {
    const page = await context.newPage();
    await openOlxLoginPage(page, input.addingUrl ?? OLX_ADDING_URL);

    const fields = loginLocators(page);
    const loginField = await firstVisible(fields.login, 5_000);
    const passwordField = await firstVisible(fields.password, 5_000);
    if (!loginField || !passwordField) {
      throw new OlxBrowserFlowError(
        "form_changed",
        "The OLX login form has changed",
      );
    }

    await loginField.fill(normalizeOlxLoginForForm(input.login));
    await passwordField.fill(input.password);

    const submit = await firstVisible(
      [
        // OLX also renders a visible account-mode tab named "Войти". Prefer
        // the actual form submit control so the fixed header cannot intercept
        // a click on that tab.
        page.locator('button[type="submit"]'),
        page.getByRole("button", {
          name: /^(войти|sign in|log in|kirish)$/iu,
        }),
      ],
      5_000,
    );
    if (!submit) {
      throw new OlxBrowserFlowError(
        "form_changed",
        "The OLX login button was not found",
      );
    }
    if (!(await submit.isEnabled().catch(() => false))) {
      throw new OlxBrowserFlowError(
        "invalid_credentials",
        "OLX did not accept the login format",
      );
    }

    const loginUrl = page.url();
    await submit.click({ timeout: 10_000 }).catch(() => {
      throw new OlxBrowserFlowError(
        "form_changed",
        "The OLX login button could not be activated",
      );
    });
    await Promise.any([
      page.waitForURL(
        (url) =>
          url.toString() !== loginUrl &&
          url.hostname !== "login.olx.uz" &&
          !url.pathname.toLowerCase().includes("login"),
        { timeout: 45_000 },
      ),
      page
        .getByText(INVALID_CREDENTIALS_PATTERN)
        .first()
        .waitFor({ state: "visible", timeout: 45_000 }),
      page
        .getByText(CHALLENGE_PATTERN)
        .first()
        .waitFor({ state: "visible", timeout: 45_000 }),
    ]).catch(() => undefined);

    if (await hasChallenge(page)) {
      throw new OlxBrowserFlowError(
        "challenge_required",
        "OLX requires user verification",
      );
    }

    const body = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    if (INVALID_CREDENTIALS_PATTERN.test(body)) {
      throw new OlxBrowserFlowError(
        "invalid_credentials",
        "OLX rejected the login or password",
      );
    }
    if (await isLoginPage(page)) {
      throw new OlxBrowserFlowError(
        "invalid_credentials",
        "OLX login did not complete",
      );
    }

    const storageState = await context.storageState({ indexedDB: true });
    return { storageState, loginHint: maskOlxLogin(input.login) };
  });
}

export async function verifyOlxBrowserSession(input: {
  storageState: OlxStorageState;
  addingUrl?: string;
}): Promise<boolean> {
  return withOlxBrowser(
    { storageState: input.storageState },
    async (context) => {
      const page = await context.newPage();
      await page.goto(input.addingUrl ?? OLX_ADDING_URL, {
        waitUntil: "domcontentloaded",
      });
      if (await hasChallenge(page)) {
        throw new OlxBrowserFlowError(
          "challenge_required",
          "OLX requires user verification",
        );
      }
      return !(await isLoginPage(page));
    },
  );
}

export function htmlToOlxPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/giu, "\n")
    .replace(/<li[^>]*>/giu, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fillNamedField(
  page: Page,
  name: RegExp,
  cssFallbacks: string[],
  value: string,
  fieldName: string,
): Promise<void> {
  const locator = await firstVisible(
    [
      page.getByRole("textbox", { name }),
      page.getByLabel(name),
      ...cssFallbacks.map((selector) => page.locator(selector)),
    ],
    5_000,
  );
  if (!locator) {
    throw new OlxBrowserFlowError(
      "form_changed",
      `OLX form field was not found: ${fieldName}`,
    );
  }
  await locator.fill(value);
}

async function chooseVisibleOption(
  page: Page,
  fieldName: RegExp,
  value: string,
  logicalName: string,
): Promise<void> {
  const control = await firstVisible([
    page.getByRole("combobox", { name: fieldName }),
    page.getByLabel(fieldName),
    page.locator(
      `select[name*="${logicalName}" i], input[name*="${logicalName}" i]`,
    ),
  ]);
  if (!control) {
    throw new OlxBrowserFlowError(
      "form_changed",
      `OLX selection was not found: ${logicalName}`,
    );
  }

  if ((await control.evaluate((element) => element.tagName)) === "SELECT") {
    const selected = await control
      .selectOption({ label: value })
      .catch(() => [] as string[]);
    if (selected.length === 0) {
      throw new OlxBrowserFlowError(
        "form_changed",
        `OLX option was not found: ${value}`,
      );
    }
    return;
  }

  await control.click();
  if (await control.isEditable().catch(() => false)) {
    await control.fill(value);
  }
  const optionPattern = new RegExp(`^\\s*${escapeRegex(value)}\\s*$`, "iu");
  const option = await firstVisible(
    [
      page.getByRole("option", { name: optionPattern }),
      page.getByText(optionPattern),
    ],
    5_000,
  );
  if (!option) {
    throw new OlxBrowserFlowError(
      "form_changed",
      `OLX option was not found: ${value}`,
    );
  }
  await option.click();
}

async function chooseCategory(page: Page, path: string[]): Promise<void> {
  const titleField = await firstVisible([
    page.getByRole("textbox", {
      name: /название объявления|заголовок|title|sarlavha/iu,
    }),
    page.locator('input[name*="title" i]'),
  ]);
  if (titleField) {
    return;
  }

  for (const segment of path) {
    const exact = new RegExp(`^\\s*${escapeRegex(segment)}\\s*$`, "iu");
    const category = await firstVisible(
      [
        page.getByRole("button", { name: exact }),
        page.getByRole("link", { name: exact }),
        page.getByText(exact),
      ],
      5_000,
    );
    if (!category) {
      throw new OlxBrowserFlowError(
        "form_changed",
        `OLX category was not found: ${segment}`,
      );
    }
    await category.click();
  }
}

async function setOptionalCheckbox(
  page: Page,
  name: RegExp,
  checked: boolean,
): Promise<void> {
  const checkbox = await firstVisible([
    page.getByRole("checkbox", { name }),
    page.getByLabel(name),
  ]);
  if (checkbox) {
    await checkbox.setChecked(checked);
  }
}

/** Fills OLX's advert form but never submits it. Exported for safe fixture tests. */
export async function fillOlxAdvertForm(
  page: Page,
  input: OlxAdvertInput,
): Promise<void> {
  if (await isLoginPage(page)) {
    throw new OlxBrowserFlowError(
      "reauth_required",
      "The OLX browser session has expired",
    );
  }
  if (await hasChallenge(page)) {
    throw new OlxBrowserFlowError(
      "challenge_required",
      "OLX requires user verification",
    );
  }

  await chooseCategory(page, input.meta.categoryPath);
  await fillNamedField(
    page,
    /название объявления|заголовок|title|sarlavha/iu,
    ['input[name*="title" i]'],
    input.title,
    "title",
  );
  await fillNamedField(
    page,
    /описание|description|tavsif/iu,
    [
      'textarea[name*="description" i]',
      '[contenteditable="true"][role="textbox"]',
    ],
    htmlToOlxPlainText(input.descriptionHtml),
    "description",
  );

  await chooseVisibleOption(
    page,
    /местоположение|город|location|city|joylashuv|shahar/iu,
    input.meta.location,
    "location",
  );
  if (input.meta.district) {
    await chooseVisibleOption(
      page,
      /район|district|tuman/iu,
      input.meta.district,
      "district",
    );
  }
  if (input.meta.employmentType) {
    await chooseVisibleOption(
      page,
      /тип занятости|занятость|employment|bandlik/iu,
      input.meta.employmentType,
      "employment",
    );
  }
  if (input.meta.schedule) {
    await chooseVisibleOption(
      page,
      /график работы|график|schedule|ish jadvali/iu,
      input.meta.schedule,
      "schedule",
    );
  }
  if (input.meta.experience) {
    await chooseVisibleOption(
      page,
      /опыт работы|опыт|experience|tajriba/iu,
      input.meta.experience,
      "experience",
    );
  }

  if (input.salaryFrom !== null) {
    await fillNamedField(
      page,
      /зарплата от|salary from|maosh.*dan/iu,
      ['input[name*="salaryFrom" i]', 'input[name*="salary_from" i]'],
      String(input.salaryFrom),
      "salaryFrom",
    );
  }
  if (input.salaryTo !== null) {
    await fillNamedField(
      page,
      /зарплата до|salary to|maosh.*gacha/iu,
      ['input[name*="salaryTo" i]', 'input[name*="salary_to" i]'],
      String(input.salaryTo),
      "salaryTo",
    );
  }

  if (input.meta.contactName) {
    await fillNamedField(
      page,
      /контактное лицо|имя|contact name|aloqa.*ism/iu,
      ['input[name*="contact" i][name*="name" i]'],
      input.meta.contactName,
      "contactName",
    );
  }
  if (input.meta.contactPhone) {
    await fillNamedField(
      page,
      /номер телефона|телефон|phone|telefon/iu,
      ['input[type="tel"]'],
      input.meta.contactPhone,
      "contactPhone",
    );
  }

  await setOptionalCheckbox(
    page,
    /зарплата договорная|договорная|negotiable|kelishiladi/iu,
    input.meta.salaryNegotiable,
  );
  await setOptionalCheckbox(
    page,
    /удаленная работа|remote work|masofaviy/iu,
    input.meta.remoteWork,
  );
  await setOptionalCheckbox(
    page,
    /онлайн-рекрутинг|online recruitment|onlayn/iu,
    input.meta.onlineRecruitment,
  );
}

function parseOlxAdvertId(url: string): string | null {
  const match = url.match(/-ID([\w-]+)\.html(?:[?#]|$)/iu);
  return match?.[1] ?? null;
}

function isOlxAdvertUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (/(?:^|\.)olx\.uz$/iu.test(parsed.hostname) ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "localhost") &&
      /\/d\/obyavlenie\/.*-ID[\w-]+\.html$/iu.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export async function publishOlxAdvertWithBrowser(input: {
  storageState: OlxStorageState;
  advert: OlxAdvertInput;
  dryRun: boolean;
  addingUrl?: string;
}): Promise<OlxPublishResult> {
  return withOlxBrowser(
    { storageState: input.storageState },
    async (context) => {
      const page = await context.newPage();
      await page.goto(input.addingUrl ?? OLX_ADDING_URL, {
        waitUntil: "domcontentloaded",
      });
      await fillOlxAdvertForm(page, input.advert);

      if (input.dryRun) {
        return { mode: "preview", formUrl: page.url() };
      }

      const submit = await firstVisible([
        page.getByRole("button", {
          name: /опубликовать|разместить|подать объявление|publish|joylashtirish/iu,
        }),
        page.locator('button[type="submit"]'),
      ]);
      if (!submit) {
        throw new OlxBrowserFlowError(
          "form_changed",
          "The OLX publish button was not found",
        );
      }

      const beforeUrl = page.url();
      await submit.click();
      await Promise.any([
        page.waitForURL((url) => url.toString() !== beforeUrl, {
          timeout: 30_000,
        }),
        page
          .getByText(/объявление.*(?:опубликовано|создано)|advert.*published/iu)
          .first()
          .waitFor({ state: "visible", timeout: 30_000 }),
        page
          .getByText(CHALLENGE_PATTERN)
          .first()
          .waitFor({ state: "visible", timeout: 30_000 }),
      ]).catch(() => undefined);

      if (await hasChallenge(page)) {
        throw new OlxBrowserFlowError(
          "challenge_required",
          "OLX requires user verification before publishing",
        );
      }

      let advertUrl = page.url();
      if (!isOlxAdvertUrl(advertUrl)) {
        const advertLink = await firstVisible([
          page.getByRole("link", {
            name: /посмотреть объявление|открыть объявление|view advert/iu,
          }),
          page.locator('a[href*="/d/obyavlenie/"]'),
        ]);
        const href = await advertLink?.getAttribute("href");
        if (href) advertUrl = new URL(href, page.url()).toString();
      }
      if (!isOlxAdvertUrl(advertUrl)) {
        throw new OlxBrowserFlowError(
          "publish_failed",
          "OLX did not confirm that the advert was published",
        );
      }

      return {
        mode: "published",
        advertUrl,
        advertId: parseOlxAdvertId(advertUrl),
      };
    },
  );
}
