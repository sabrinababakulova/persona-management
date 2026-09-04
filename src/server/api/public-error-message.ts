import type { AppLocale } from "~/i18n/config";

type PublicErrorMessages = Record<string, string> & {
  BAD_REQUEST: string;
  INTERNAL_SERVER_ERROR: string;
};

const PUBLIC_ERROR_MESSAGES: Record<AppLocale, PublicErrorMessages> = {
  ru: {
    BAD_REQUEST: "Некорректные данные. Проверьте заполненные поля.",
    CLIENT_CLOSED_REQUEST: "Запрос был отменён.",
    CONFLICT: "Данные были изменены. Обновите страницу и повторите.",
    FORBIDDEN: "Недостаточно прав для выполнения этого действия.",
    INTERNAL_SERVER_ERROR: "Не удалось выполнить действие. Попробуйте позже.",
    NOT_FOUND: "Запись не найдена. Возможно, она была удалена.",
    PAYLOAD_TOO_LARGE: "Файл слишком большой.",
    PRECONDITION_FAILED:
      "Действие недоступно: не выполнены необходимые условия.",
    TIMEOUT: "Превышено время ожидания ответа. Попробуйте снова.",
    TOO_MANY_REQUESTS: "Слишком много запросов. Подождите немного и повторите.",
    UNAUTHORIZED: "Сессия истекла. Войдите в систему заново.",
    UNPROCESSABLE_CONTENT: "Некорректные данные. Проверьте заполненные поля.",
    UNSUPPORTED_MEDIA_TYPE: "Неподдерживаемый тип файла.",
  },
  en: {
    BAD_REQUEST: "Invalid data. Please check the fields you filled in.",
    CLIENT_CLOSED_REQUEST: "The request was cancelled.",
    CONFLICT: "The data has changed. Refresh the page and try again.",
    FORBIDDEN: "You do not have permission to perform this action.",
    INTERNAL_SERVER_ERROR:
      "The action could not be completed. Please try again later.",
    NOT_FOUND: "Record not found. It may have been deleted.",
    PAYLOAD_TOO_LARGE: "The file is too large.",
    PRECONDITION_FAILED: "Action unavailable: required conditions are not met.",
    TIMEOUT: "The request timed out. Please try again.",
    TOO_MANY_REQUESTS: "Too many requests. Please wait a moment and retry.",
    UNAUTHORIZED: "Your session has expired. Please sign in again.",
    UNPROCESSABLE_CONTENT:
      "Invalid data. Please check the fields you filled in.",
    UNSUPPORTED_MEDIA_TYPE: "Unsupported file type.",
  },
  uz: {
    BAD_REQUEST: "Ma’lumotlar noto‘g‘ri. To‘ldirilgan maydonlarni tekshiring.",
    CLIENT_CLOSED_REQUEST: "So‘rov bekor qilindi.",
    CONFLICT: "Ma’lumotlar o‘zgardi. Sahifani yangilab, qayta urinib ko‘ring.",
    FORBIDDEN: "Bu amalni bajarish uchun huquqingiz yetarli emas.",
    INTERNAL_SERVER_ERROR: "Amalni bajarib bo‘lmadi. Keyinroq urinib ko‘ring.",
    NOT_FOUND: "Yozuv topilmadi. U o‘chirilgan bo‘lishi mumkin.",
    PAYLOAD_TOO_LARGE: "Fayl hajmi juda katta.",
    PRECONDITION_FAILED: "Amal mavjud emas: zarur shartlar bajarilmagan.",
    TIMEOUT: "Javob kutish vaqti tugadi. Qayta urinib ko‘ring.",
    TOO_MANY_REQUESTS:
      "So‘rovlar juda ko‘p. Biroz kutib, qayta urinib ko‘ring.",
    UNAUTHORIZED: "Sessiya muddati tugadi. Tizimga qaytadan kiring.",
    UNPROCESSABLE_CONTENT:
      "Ma’lumotlar noto‘g‘ri. To‘ldirilgan maydonlarni tekshiring.",
    UNSUPPORTED_MEDIA_TYPE: "Qo‘llab-quvvatlanmaydigan fayl turi.",
  },
};

const CYRILLIC = /[Ѐ-ӿ]/u;

type PublicErrorMessageInput = {
  code: string;
  isValidationError: boolean;
  locale: AppLocale;
  message: string;
};

/**
 * Converts an API failure into text that is safe to render directly.
 *
 * Russian server-authored messages retain their useful detail in the Russian UI. Other
 * locales use the translated code-level message until individual business errors have
 * stable translation keys. Validation and technical messages are always replaced.
 */
export function getPublicErrorMessage({
  code,
  isValidationError,
  locale,
  message,
}: PublicErrorMessageInput): string {
  const messages = PUBLIC_ERROR_MESSAGES[locale];

  if (isValidationError) {
    return messages.BAD_REQUEST;
  }

  if (locale === "ru" && CYRILLIC.test(message)) {
    return message;
  }

  return messages[code] ?? messages.INTERNAL_SERVER_ERROR;
}
