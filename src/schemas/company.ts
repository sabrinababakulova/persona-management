import { z } from "zod";
import { normalizeOlxUzPhone } from "~/shared/olx-phone";

export type CompanyValidationMessages = {
  nameRequired: string;
  nameTooLong: string;
  cityTooLong: string;
  countryTooLong: string;
  descriptionTooLong: string;
  websiteInvalid: string;
  phoneTooLong: string;
  phoneInvalid: string;
};

const russianMessages: CompanyValidationMessages = {
  nameRequired: "Укажите название компании",
  nameTooLong: "Название не должно превышать 255 символов",
  cityTooLong: "Город не должен превышать 255 символов",
  countryTooLong: "Страна не должна превышать 255 символов",
  descriptionTooLong: "Описание не должно превышать 2000 символов",
  websiteInvalid: "Укажите корректную ссылку, например https://example.com",
  phoneTooLong: "Телефон не должен превышать 50 символов",
  phoneInvalid: "Введите номер Узбекистана в формате +998 90 123 45 67",
};

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function createUpdateCompanySchema(
  messages: CompanyValidationMessages = russianMessages,
) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, messages.nameRequired)
      .max(255, messages.nameTooLong),
    city: z.string().trim().max(255, messages.cityTooLong),
    country: z.string().trim().max(255, messages.countryTooLong),
    description: z.string().trim().max(2000, messages.descriptionTooLong),
    website: z
      .string()
      .trim()
      .max(500, messages.websiteInvalid)
      .refine((value) => value === "" || isHttpUrl(value), {
        message: messages.websiteInvalid,
      }),
    phone: z
      .string()
      .trim()
      .max(50, messages.phoneTooLong)
      .refine(
        (value) => value === "" || normalizeOlxUzPhone(value) !== null,
        messages.phoneInvalid,
      )
      .transform((value) =>
        value === "" ? "" : (normalizeOlxUzPhone(value) ?? value),
      ),
  });
}

export const updateCompanySchema = createUpdateCompanySchema();

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
