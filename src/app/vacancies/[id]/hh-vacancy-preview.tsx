"use client";

import Image from "next/image";
import { useMemo } from "react";
import { api } from "~/trpc/react";

function formatHhDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatHhSalary(
  salary: {
    from: number | null;
    to: number | null;
    currency: string | null;
    gross: boolean | null;
  } | null,
): string {
  if (!salary) return "Не указана";
  const parts: string[] = [];
  if (salary.from != null)
    parts.push(`от ${salary.from.toLocaleString("ru-RU")}`);
  if (salary.to != null) parts.push(`до ${salary.to.toLocaleString("ru-RU")}`);
  const range = parts.length > 0 ? parts.join(" ") : "Не указана";
  const currency = salary.currency ? ` ${salary.currency}` : "";
  const gross =
    salary.gross === true
      ? " (до вычета налогов)"
      : salary.gross === false
        ? " (на руки)"
        : "";
  return `${range}${currency}${gross}`;
}

function formatYesNo(value: boolean | null): string {
  if (value === null) return "—";
  return value ? "Да" : "Нет";
}

function formatPhone(phone: {
  country: string | null;
  city: string | null;
  number: string | null;
  formatted: string | null;
  comment: string | null;
}): string {
  if (phone.formatted) {
    return phone.comment
      ? `${phone.formatted} (${phone.comment})`
      : phone.formatted;
  }
  const parts = [phone.country, phone.city, phone.number]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return phone.comment ? `${parts} (${phone.comment})` : parts;
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-[12px] text-text-secondary uppercase tracking-[0.04em]">
        {label}
      </span>
      <span className="text-[14px] text-text-heading leading-[1.4]">
        {children}
      </span>
    </div>
  );
}

export function HhVacancyPreview({ vacancyId }: { vacancyId: string }) {
  const {
    data: hh,
    isError,
    isLoading,
    refetch,
  } = api.vacancies.getHhDetail.useQuery(
    { id: vacancyId },
    { enabled: Boolean(vacancyId), staleTime: 60 * 1000 },
  );

  const sanitizedDescription = useMemo(() => {
    if (!hh?.descriptionHtml) return "";
    return hh.descriptionHtml;
  }, [hh?.descriptionHtml]);

  if (isLoading) {
    return (
      <section className="rounded-[8px] border border-border-input bg-bg-light p-5">
        <div className="font-bold text-[18px] text-text-heading">hh.uz</div>
        <div className="mt-3 text-[14px] text-text-secondary">
          Загрузка данных с hh.uz…
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="rounded-[8px] border border-danger-red-bg bg-danger-red-bg p-5">
        <div className="font-bold text-[18px] text-danger-red">hh.uz</div>
        <div className="mt-3 text-[14px] text-danger-red">
          Не удалось загрузить данные с hh.uz.
        </div>
        <button
          className="mt-3 rounded-[6px] border border-danger-red px-3 py-1 text-[13px] text-danger-red hover:bg-bg-light"
          onClick={() => void refetch()}
          type="button"
        >
          Повторить
        </button>
      </section>
    );
  }

  if (!hh) {
    return (
      <section className="rounded-[8px] border border-border-input bg-bg-input p-5">
        <div className="font-bold text-[18px] text-text-heading">hh.uz</div>
        <div className="mt-3 text-[14px] text-text-secondary">
          Эта вакансия не связана с hh.uz. Чтобы связать существующую вакансию,
          добавьте её ID hh.uz в админ-панели.
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-[8px] border border-border-input bg-bg-light p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-bold text-[20px] text-text-heading leading-tight">
            hh.uz
          </span>
          <span className="text-[14px] text-text-secondary">
            Данные получены с hh.uz и доступны только для просмотра.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 font-medium text-[12px] ${
              hh.archived
                ? "bg-bg-hover text-text-secondary"
                : "bg-success-green-bg text-success-green"
            }`}
          >
            {hh.archived ? "В архиве" : "Активна"}
          </span>
          {hh.alternateUrl && (
            <a
              className="rounded-[6px] border border-border-input px-3 py-1 font-medium text-[13px] text-primary-blue hover:bg-bg-hover"
              href={hh.alternateUrl}
              rel="noreferrer"
              target="_blank"
            >
              Открыть на hh.uz
            </a>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Field label="Название">{hh.name || "—"}</Field>
        <Field label="ID на hh.uz">{hh.id}</Field>
        <Field label="Город">{hh.area ?? "—"}</Field>
        <Field label="Тип занятости">{hh.employment ?? "—"}</Field>
        <Field label="График">{hh.schedule ?? "—"}</Field>
        <Field label="Опыт">{hh.experience ?? "—"}</Field>
        <Field label="Формат работы">
          {hh.workFormats.length > 0 ? hh.workFormats.join(", ") : "—"}
        </Field>
        <Field label="Профессиональные роли">
          {hh.professionalRoles.length > 0
            ? hh.professionalRoles.join(", ")
            : "—"}
        </Field>
        <Field label="Тип публикации (billing)">{hh.billingType ?? "—"}</Field>
        <Field label="Тип вакансии">{hh.type ?? "—"}</Field>
        <Field label="Зарплата">{formatHhSalary(hh.salary)}</Field>
        <Field label="Опубликовано">{formatHhDate(hh.publishedAt)}</Field>
        <Field label="Создано">
          {formatHhDate(hh.initialCreatedAt ?? hh.createdAt)}
        </Field>
        <Field label="Истекает">{formatHhDate(hh.expiresAt)}</Field>
      </div>

      {hh.keySkills.length > 0 && (
        <Field label="Ключевые навыки">
          <div className="mt-1 flex flex-wrap gap-2">
            {hh.keySkills.map((skill) => (
              <span
                className="rounded-full bg-bg-input px-3 py-1 text-[13px] text-text-heading"
                key={skill}
              >
                {skill}
              </span>
            ))}
          </div>
        </Field>
      )}

      {hh.language.length > 0 && (
        <Field label="Языки">
          <ul className="ml-5 list-disc">
            {hh.language.map((lang) => (
              <li key={`${lang.name ?? ""}::${lang.level ?? ""}`}>
                {lang.name ?? "—"}
                {lang.level ? ` — ${lang.level}` : ""}
              </li>
            ))}
          </ul>
        </Field>
      )}

      {hh.driverLicenseTypes.length > 0 && (
        <Field label="Водительские права">
          {hh.driverLicenseTypes.join(", ")}
        </Field>
      )}

      {hh.employer && (
        <div className="flex flex-col gap-3 rounded-[6px] border border-border-input bg-bg-input p-4">
          <span className="font-semibold text-[14px] text-text-heading">
            Работодатель
          </span>
          <div className="flex items-center gap-3">
            {hh.employer.logoUrl && (
              <Image
                alt={hh.employer.name ?? "Логотип"}
                className="h-12 w-12 rounded-[6px] object-contain"
                src={hh.employer.logoUrl}
              />
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] text-text-heading">
                {hh.employer.name ?? "—"}
              </span>
              {hh.employer.url && (
                <a
                  className="text-[13px] text-primary-blue hover:underline"
                  href={hh.employer.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Профиль на hh.uz
                </a>
              )}
              {hh.employer.trusted && (
                <span className="text-[12px] text-success-green">
                  Проверенный работодатель
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {hh.contacts && (
        <div className="flex flex-col gap-2 rounded-[6px] border border-border-input bg-bg-input p-4">
          <span className="font-semibold text-[14px] text-text-heading">
            Контакты
          </span>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Field label="Имя">{hh.contacts.name ?? "—"}</Field>
            <Field label="Email">{hh.contacts.email ?? "—"}</Field>
            <Field label="Телефоны">
              {hh.contacts.phones.length > 0 ? (
                <ul className="ml-5 list-disc">
                  {hh.contacts.phones.map((phone) => (
                    <li
                      key={`${phone.country ?? ""}-${phone.city ?? ""}-${phone.number ?? ""}-${phone.comment ?? ""}`}
                    >
                      {formatPhone(phone)}
                    </li>
                  ))}
                </ul>
              ) : (
                "—"
              )}
            </Field>
          </div>
        </div>
      )}

      {hh.address && (
        <Field label="Адрес">
          {[
            hh.address.city,
            hh.address.street,
            hh.address.building,
            hh.address.description,
            hh.address.raw,
          ]
            .filter((part): part is string => Boolean(part))
            .join(", ") || "—"}
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <span className="font-semibold text-[14px] text-text-heading">
          Дополнительно
        </span>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Field label="Принимает с инвалидностью">
            {formatYesNo(hh.acceptHandicapped)}
          </Field>
          <Field label="Принимает соискателей младше 14">
            {formatYesNo(hh.acceptKids)}
          </Field>
          <Field label="Принимает неполные резюме">
            {formatYesNo(hh.acceptIncompleteResumes)}
          </Field>
          <Field label="Сопроводительное письмо">
            {formatYesNo(hh.responseLetterRequired)}
          </Field>
          <Field label="Разрешены сообщения">
            {formatYesNo(hh.allowMessages)}
          </Field>
          <Field label="Тестовое задание обязательно">
            {formatYesNo(hh.testRequired)}
          </Field>
          <Field label="Скрыта">{formatYesNo(hh.hidden)}</Field>
          <Field label="Внутренний код">{hh.code ?? "—"}</Field>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Field label="Просмотры">{hh.counters.views ?? "—"}</Field>
          <Field label="Отклики">{hh.counters.responses ?? "—"}</Field>
          <Field label="Всего откликов">
            {hh.counters.totalResponses ?? "—"}
          </Field>
        </div>
      </div>

      {sanitizedDescription && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-[14px] text-text-heading">
            Описание вакансии (с hh.uz)
          </span>
          <div
            className="rounded-[6px] border border-border-input bg-bg-input p-4 text-[14px] text-text-heading leading-[1.5] [&_a]:text-primary-blue [&_a]:underline [&_h3]:my-2 [&_h3]:font-bold [&_h3]:text-[16px] [&_h4]:my-2 [&_h4]:font-semibold [&_h4]:text-[15px] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:ml-5 [&_ul]:list-disc"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: hh.uz returns HTML and is sanitized server-side on publish
            dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
          />
        </div>
      )}
    </section>
  );
}
