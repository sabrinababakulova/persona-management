"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { Checkbox } from "~/app/_components/checkbox";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { Input } from "~/app/_components/input";
import {
  FeedbackPresence,
  LoadingButtonContent,
  LoadingState,
} from "~/app/_components/motion-system";
import { RichTextEditor } from "~/app/_components/rich-text-editor";
import {
  OLX_MAX_SALARY,
  olxVisibleText,
  validateOlxAdvertContent,
} from "~/shared/olx-validation";
import { api } from "~/trpc/react";
import {
  formatNumberWithSpaces,
  parseFormattedNumber,
} from "~/utils/format-salaries";
import { PublicationConfirmationModal } from "./publication-confirmation-modal";

type OlxAttribute = {
  code: string;
  label: string;
  unit: string | null;
  validation: {
    type: "salary" | "price" | "attribute";
    required: boolean;
    numeric: boolean;
    min: number | null;
    max: number | null;
    allowMultipleValues: boolean;
  };
  values: { code: string; label: string }[];
};

type AttributeState = Record<string, { value?: string; values?: string[] }>;

type OlxMetaInput = {
  categoryId: number;
  advertiserType: "private" | "business";
  cityId: number;
  districtId?: number;
  contactName: string;
  contactPhone?: string;
  salaryNegotiable: boolean;
  salaryType: "hourly" | "monthly";
  autoExtendEnabled: boolean;
  attributes: Array<{
    code: string;
    value?: string;
    values?: string[];
  }>;
};

type OlxErrors = Partial<
  Record<
    | "title"
    | "description"
    | "category"
    | "city"
    | "district"
    | "contactName"
    | "salary"
    | "attributes"
    | "_form",
    string
  >
>;

function options(
  values: ReadonlyArray<{ value: string; label: string }>,
): Array<{ value: string; label: string }> {
  return Array.from(values);
}

export function OlxPublicationForm({
  vacancyId,
  pubId,
}: {
  vacancyId: string;
  pubId?: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [draftPublicationId, setDraftPublicationId] = useState(pubId ?? "");
  const effectiveId = pubId ?? draftPublicationId;
  const vacancyQuery = api.vacancies.get.useQuery({
    id: effectiveId || vacancyId,
  });
  const configQuery = api.vacancies.getOlxConfig.useQuery();
  const references = configQuery.data?.references;

  const [title, setTitle] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [advertiserType, setAdvertiserType] = useState<"private" | "business">(
    "business",
  );
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [salaryFrom, setSalaryFrom] = useState("");
  const [salaryTo, setSalaryTo] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("UZS");
  const [salaryNegotiable, setSalaryNegotiable] = useState(false);
  const [salaryType, setSalaryType] = useState<"hourly" | "monthly">("monthly");
  const [autoExtendEnabled, setAutoExtendEnabled] = useState(false);
  const [attributeState, setAttributeState] = useState<AttributeState>({});
  const [errors, setErrors] = useState<OlxErrors>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const hydratedForId = useRef<string | null>(null);

  const attributesQuery = api.vacancies.getOlxCategoryAttributes.useQuery(
    { categoryId: Number(categoryId) },
    {
      enabled:
        Boolean(configQuery.data?.connected) &&
        Number.isInteger(Number(categoryId)) &&
        Number(categoryId) > 0,
    },
  );
  const districtsQuery = api.vacancies.getOlxDistricts.useQuery(
    { cityId: Number(cityId) },
    {
      enabled:
        Boolean(configQuery.data?.connected) &&
        Number.isInteger(Number(cityId)) &&
        Number(cityId) > 0,
    },
  );
  const categoryAttributes = (attributesQuery.data ?? []) as OlxAttribute[];

  useEffect(() => {
    const vacancy = vacancyQuery.data;
    if (!vacancy) {
      return;
    }
    const currentId = effectiveId || vacancyId;
    if (hydratedForId.current === currentId) {
      return;
    }
    hydratedForId.current = currentId;

    setTitle(vacancy.title ?? "");
    setDescriptionHtml(vacancy.descriptionHtml ?? "");
    setSalaryFrom(
      vacancy.salaryFrom != null
        ? formatNumberWithSpaces(String(vacancy.salaryFrom))
        : "",
    );
    setSalaryTo(
      vacancy.salaryTo != null
        ? formatNumberWithSpaces(String(vacancy.salaryTo))
        : "",
    );
    setSalaryCurrency(vacancy.salaryCurrency ?? "UZS");

    const meta = "olxMeta" in vacancy ? vacancy.olxMeta : null;
    if (!meta) {
      return;
    }
    setCategoryId(String(meta.categoryId));
    setAdvertiserType(meta.advertiserType);
    setCityId(String(meta.cityId));
    setDistrictId(meta.districtId ? String(meta.districtId) : "");
    setContactName(meta.contactName);
    setContactPhone(meta.contactPhone ?? "");
    setSalaryNegotiable(meta.salaryNegotiable);
    setSalaryType(meta.salaryType);
    setAutoExtendEnabled(meta.autoExtendEnabled);
    setAttributeState(
      Object.fromEntries(
        meta.attributes.map((attribute) => [
          attribute.code,
          {
            value: attribute.value,
            values: attribute.values,
          },
        ]),
      ),
    );
  }, [effectiveId, vacancyId, vacancyQuery.data]);

  useEffect(() => {
    if (!references) {
      return;
    }
    setCategoryId(
      (current) => current || String(references.categories[0]?.id ?? ""),
    );
    setCityId((current) => current || String(references.cities[0]?.id ?? ""));
    setSalaryCurrency(
      (current) =>
        current ||
        references.currencies.find((currency) => currency.isDefault)?.code ||
        references.currencies[0]?.code ||
        "UZS",
    );
    setContactName(
      (current) => current || configQuery.data?.account?.name || "",
    );
    setContactPhone(
      (current) => current || configQuery.data?.account?.phone || "",
    );
    if (configQuery.data?.account?.isBusiness) {
      setAdvertiserType("business");
    }
  }, [configQuery.data, references]);

  useEffect(() => {
    if (districtsQuery.data && districtsQuery.data.length === 0 && districtId) {
      setDistrictId("");
    }
  }, [districtId, districtsQuery.data]);

  const publishOlx = api.vacancies.publishOlx.useMutation({
    onSuccess: async (result) => {
      setErrors({});
      setIsConfirmOpen(false);
      await Promise.all([
        utils.vacancies.get.invalidate({ id: vacancyId }),
        effectiveId
          ? utils.vacancies.get.invalidate({ id: effectiveId })
          : undefined,
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);

      if (result.requiresPayment) {
        setSavedMessage(
          "Объявление создано на OLX.uz, но для активации нужен пакет размещений. Откройте OLX.uz и оплатите или назначьте пакет.",
        );
        return;
      }
      router.push(`/vacancies/${vacancyId}?step=publications`);
    },
    onError: (error) => {
      setSavedMessage(null);
      setIsConfirmOpen(false);
      setErrors({
        _form: error.message || "Не удалось опубликовать на OLX.uz",
      });
    },
  });

  const createPublication = api.vacancies.create.useMutation({
    onSuccess: async (publication) => {
      setDraftPublicationId(publication.id);
      await utils.vacancies.listPublications.invalidate({
        parentVacancyId: vacancyId,
      });
      publishOlx.mutate(buildPublishInput(publication.id));
    },
    onError: (error) => {
      setIsConfirmOpen(false);
      setErrors({ _form: error.message || "Не удалось сохранить публикацию" });
    },
  });

  const ordinaryAttributes = categoryAttributes.filter(
    (attribute) => attribute.validation.type === "attribute",
  );
  const salaryRequired = categoryAttributes.some(
    (attribute) =>
      attribute.validation.type === "salary" && attribute.validation.required,
  );

  const setSingleAttribute = (code: string, value: string) => {
    setSavedMessage(null);
    setAttributeState((current) => ({
      ...current,
      [code]: { value },
    }));
  };

  const toggleAttribute = (code: string, value: string) => {
    setSavedMessage(null);
    setAttributeState((current) => {
      const selected = current[code]?.values ?? [];
      return {
        ...current,
        [code]: {
          values: selected.includes(value)
            ? selected.filter((item) => item !== value)
            : [...selected, value],
        },
      };
    });
  };

  const buildMeta = (): OlxMetaInput => {
    const attributes: OlxMetaInput["attributes"] = [];
    for (const attribute of ordinaryAttributes) {
      const selected = attributeState[attribute.code];
      if (attribute.validation.allowMultipleValues) {
        if (selected?.values && selected.values.length > 0) {
          attributes.push({
            code: attribute.code,
            values: selected.values,
          });
        }
        continue;
      }
      if (selected?.value) {
        attributes.push({
          code: attribute.code,
          value: selected.value,
        });
      }
    }

    return {
      categoryId: Number(categoryId),
      advertiserType,
      cityId: Number(cityId),
      ...(districtId ? { districtId: Number(districtId) } : {}),
      contactName: contactName.trim(),
      ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
      salaryNegotiable,
      salaryType,
      autoExtendEnabled,
      attributes,
    };
  };

  function buildPublishInput(publicationId: string) {
    return {
      vacancyId: publicationId,
      title: title.trim(),
      descriptionHtml,
      salaryFrom: salaryFrom
        ? (parseFormattedNumber(salaryFrom) ?? null)
        : null,
      salaryTo: salaryTo ? (parseFormattedNumber(salaryTo) ?? null) : null,
      salaryCurrency:
        salaryCurrency === "USD" ? ("USD" as const) : ("UZS" as const),
      meta: buildMeta(),
    };
  }

  const validate = (): boolean => {
    const next: OlxErrors = {};
    for (const issue of validateOlxAdvertContent({
      title,
      descriptionHtml,
    })) {
      next[issue.field] ??= issue.message;
    }
    if (!categoryId) next.category = "Выберите категорию OLX";
    if (!cityId) next.city = "Выберите город";
    if ((districtsQuery.data?.length ?? 0) > 0 && !districtId) {
      next.district = "Выберите район";
    }
    if (!contactName.trim()) {
      next.contactName = "Укажите контактное лицо";
    }
    const from = salaryFrom ? (parseFormattedNumber(salaryFrom) ?? null) : null;
    const to = salaryTo ? (parseFormattedNumber(salaryTo) ?? null) : null;
    if (salaryRequired && !salaryNegotiable && from === null && to === null) {
      next.salary = "Для этой категории OLX требует зарплату";
    } else if (from !== null && to !== null && to < from) {
      next.salary = "Зарплата «до» не может быть меньше зарплаты «от»";
    } else if (
      (from !== null && from > OLX_MAX_SALARY) ||
      (to !== null && to > OLX_MAX_SALARY)
    ) {
      next.salary = "Зарплата превышает максимально допустимое значение OLX";
    }

    const missingAttributes = ordinaryAttributes.filter((attribute) => {
      if (!attribute.validation.required) {
        return false;
      }
      const selected = attributeState[attribute.code];
      return attribute.validation.allowMultipleValues
        ? (selected?.values?.length ?? 0) === 0
        : !selected?.value;
    });
    const invalidNumericAttributes = ordinaryAttributes.filter((attribute) => {
      if (!attribute.validation.numeric) {
        return false;
      }
      const selected = attributeState[attribute.code]?.value;
      if (!selected) {
        return false;
      }
      const numericValue = Number(selected);
      return (
        !Number.isFinite(numericValue) ||
        (attribute.validation.min !== null &&
          numericValue < attribute.validation.min) ||
        (attribute.validation.max !== null &&
          numericValue > attribute.validation.max)
      );
    });
    if (missingAttributes.length > 0) {
      next.attributes = `Заполните обязательные поля OLX: ${missingAttributes
        .map((attribute) => attribute.label)
        .join(", ")}`;
    } else if (invalidNumericAttributes.length > 0) {
      next.attributes = `Проверьте допустимый диапазон полей OLX: ${invalidNumericAttributes
        .map((attribute) => attribute.label)
        .join(", ")}`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!vacancyQuery.data || !validate()) {
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!vacancyQuery.data || !validate()) {
      setIsConfirmOpen(false);
      return;
    }
    if (effectiveId) {
      publishOlx.mutate(buildPublishInput(effectiveId));
      return;
    }
    createPublication.mutate({
      parentId: vacancyId,
      title: title.trim(),
      descriptionHtml,
      salaryFrom: salaryFrom ? parseFormattedNumber(salaryFrom) : undefined,
      salaryTo: salaryTo ? parseFormattedNumber(salaryTo) : undefined,
      salaryCurrency: salaryCurrency === "USD" ? "USD" : "UZS",
      destination: "olx.uz",
      isActive: false,
      isPublication: true,
      olxMeta: buildMeta(),
    });
  };

  const categoryOptions = useMemo(
    () =>
      options(
        (references?.categories ?? []).map((category) => ({
          value: String(category.id),
          label: category.path,
        })),
      ),
    [references],
  );
  const cityOptions = useMemo(
    () =>
      options(
        (references?.cities ?? []).map((city) => ({
          value: String(city.id),
          label: city.name,
        })),
      ),
    [references],
  );
  const currencyOptions = useMemo(
    () =>
      options(
        (references?.currencies ?? []).map((currency) => ({
          value: currency.code,
          label: `${currency.code} — ${currency.label}`,
        })),
      ),
    [references],
  );
  const districtOptions = useMemo(
    () =>
      options(
        (districtsQuery.data ?? []).map((district) => ({
          value: String(district.id),
          label: district.name,
        })),
      ),
    [districtsQuery.data],
  );

  const isSubmitting = createPublication.isPending || publishOlx.isPending;
  const errorText = (key: keyof OlxErrors) =>
    errors[key] ? (
      <p className="text-danger-red text-xs leading-[1.4]">{errors[key]}</p>
    ) : null;

  if (vacancyQuery.isLoading || configQuery.isLoading) {
    return (
      <LoadingState
        className="h-full min-h-[55vh] flex-1 text-text-placeholder"
        label="Загрузка публикации OLX.uz..."
      />
    );
  }

  if (!vacancyQuery.data) {
    return (
      <main className="flex h-full flex-1 items-center justify-center text-text-placeholder">
        Вакансия не найдена
      </main>
    );
  }

  const connected = configQuery.data?.connected ?? false;

  return (
    <main className="relative w-full bg-bg-canvas">
      <div className="app-page-narrow flex flex-col">
        <Breadcrumbs
          label="Публикация на OLX.uz"
          parent={{
            label: vacancyQuery.data.title || "Вакансия",
            href: `/vacancies/${vacancyId}`,
          }}
          rootHref="/vacancies"
          rootLabel="Вакансии"
        />
        <h1 className="page-title mt-5 mb-5">Публикация на OLX.uz</h1>

        <FeedbackPresence
          show={Boolean(!configQuery.isError && !configQuery.data?.enabled)}
        >
          <div className="mb-5 rounded-lg border border-danger-red bg-status-closed-bg px-4 py-3 text-danger-red text-sm leading-5">
            Интеграция OLX.uz не настроена на сервере. Добавьте OLX_CLIENT_ID,
            OLX_CLIENT_SECRET и зарегистрированный callback URL.
          </div>
        </FeedbackPresence>
        <FeedbackPresence
          show={Boolean(configQuery.data?.enabled && !connected)}
        >
          <div className="mb-5 rounded-lg border border-status-paused bg-status-paused-bg px-4 py-3 text-sm text-status-paused leading-5">
            Подключите или переподключите OLX.uz в настройках компании, затем
            вернитесь к публикации.
          </div>
        </FeedbackPresence>
        <FeedbackPresence show={configQuery.isError}>
          <div className="mb-5 rounded-lg border border-danger-red bg-status-closed-bg px-4 py-3 text-danger-red text-sm leading-5">
            {configQuery.error?.message ??
              "Не удалось загрузить справочники OLX.uz"}
          </div>
        </FeedbackPresence>

        <div className="mt-2 flex w-full flex-col gap-5">
          <div className="surface-card p-5 sm:p-6">
            <ClosableSection title="Объявление">
              <div className="flex flex-col gap-2">
                <Input
                  label="Название вакансии"
                  maxLength={150}
                  minLength={16}
                  onChange={(event) => {
                    setSavedMessage(null);
                    setTitle(event.currentTarget.value);
                  }}
                  placeholder="Например, Оператор call-центра в Ташкенте"
                  value={title}
                />
                <p className="text-text-placeholder text-xs">
                  {title.trim().length}/150, минимум 16 символов
                </p>
                {errorText("title")}
              </div>

              <div className="flex flex-col gap-2">
                <RichTextEditor
                  id="olx-description"
                  label="Описание вакансии"
                  maxLength={9000}
                  onChange={(value) => {
                    setSavedMessage(null);
                    setDescriptionHtml(value);
                  }}
                  placeholder="Обязанности, требования и условия работы"
                  toolbarVariant="olx"
                  value={descriptionHtml}
                />
                <p className="text-text-placeholder text-xs leading-[1.4]">
                  {olxVisibleText(descriptionHtml).length}/9000, минимум 80. OLX
                  принимает абзацы, списки, жирный текст и курсив.
                </p>
                {errorText("description")}
              </div>
            </ClosableSection>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <ClosableSection title="Размещение на OLX">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Dropdown
                    disabled={!connected}
                    label="Категория работы"
                    onChange={(value) => {
                      setCategoryId(value);
                      setAttributeState({});
                      setSavedMessage(null);
                    }}
                    options={categoryOptions}
                    placeholder="Выберите категорию"
                    value={categoryId}
                  />
                  {errorText("category")}
                </div>
                <Dropdown
                  label="Тип работодателя"
                  onChange={(value) =>
                    setAdvertiserType(
                      value === "private" ? "private" : "business",
                    )
                  }
                  options={[
                    { value: "business", label: "Бизнес" },
                    { value: "private", label: "Частное лицо" },
                  ]}
                  value={advertiserType}
                />
                <div className="flex flex-col gap-2">
                  <Dropdown
                    disabled={!connected}
                    label="Город"
                    onChange={(value) => {
                      setCityId(value);
                      setDistrictId("");
                      setSavedMessage(null);
                    }}
                    options={cityOptions}
                    placeholder="Выберите город"
                    value={cityId}
                  />
                  {errorText("city")}
                </div>
                {(districtsQuery.isLoading ||
                  (districtsQuery.data?.length ?? 0) > 0) && (
                  <div className="flex flex-col gap-2">
                    <Dropdown
                      disabled={districtsQuery.isLoading}
                      label="Район"
                      onChange={setDistrictId}
                      options={districtOptions}
                      placeholder={
                        districtsQuery.isLoading
                          ? "Загрузка районов..."
                          : "Выберите район"
                      }
                      value={districtId}
                    />
                    {errorText("district")}
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Checkbox
                  checked={autoExtendEnabled}
                  onChange={() => setAutoExtendEnabled((value) => !value)}
                />
                <span className="text-sm text-text-heading">
                  Автоматически продлевать объявление, если пакет OLX это
                  разрешает
                </span>
              </div>
            </ClosableSection>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <ClosableSection title="Требования категории OLX">
              {attributesQuery.isLoading ? (
                <LoadingState compact label="Загрузка полей категории..." />
              ) : null}
              {attributesQuery.isError ? (
                <p className="text-danger-red text-sm">
                  {attributesQuery.error.message}
                </p>
              ) : null}
              {!attributesQuery.isLoading && ordinaryAttributes.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  У выбранной категории нет дополнительных полей.
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {ordinaryAttributes.map((attribute) => {
                  const label = `${attribute.label}${
                    attribute.validation.required ? " *" : ""
                  }${attribute.unit ? ` (${attribute.unit})` : ""}`;
                  if (
                    attribute.validation.allowMultipleValues &&
                    attribute.values.length > 0
                  ) {
                    return (
                      <div className="flex flex-col gap-2" key={attribute.code}>
                        <span className="font-semibold text-sm text-text-label">
                          {label}
                        </span>
                        {attribute.values.map((value) => (
                          <div
                            className="flex items-center gap-2 text-sm text-text-heading"
                            key={value.code}
                          >
                            <Checkbox
                              checked={(
                                attributeState[attribute.code]?.values ?? []
                              ).includes(value.code)}
                              onChange={() =>
                                toggleAttribute(attribute.code, value.code)
                              }
                            />
                            {value.label}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  if (attribute.values.length > 0) {
                    return (
                      <Dropdown
                        key={attribute.code}
                        label={label}
                        onChange={(value) =>
                          setSingleAttribute(attribute.code, value)
                        }
                        options={attribute.values.map((value) => ({
                          value: value.code,
                          label: value.label,
                        }))}
                        placeholder="Выберите значение"
                        value={attributeState[attribute.code]?.value ?? ""}
                      />
                    );
                  }
                  return (
                    <Input
                      inputMode={
                        attribute.validation.numeric ? "numeric" : "text"
                      }
                      key={attribute.code}
                      label={label}
                      onChange={(event) =>
                        setSingleAttribute(
                          attribute.code,
                          attribute.validation.numeric
                            ? event.currentTarget.value.replace(/[^\d.-]/g, "")
                            : event.currentTarget.value,
                        )
                      }
                      value={attributeState[attribute.code]?.value ?? ""}
                    />
                  );
                })}
              </div>
              {errorText("attributes")}
            </ClosableSection>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <ClosableSection title="Зарплата">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Input
                  inputMode="numeric"
                  label={`Зарплата от${salaryRequired ? " *" : ""}`}
                  onChange={(event) =>
                    setSalaryFrom(
                      formatNumberWithSpaces(event.currentTarget.value),
                    )
                  }
                  placeholder="5 000 000"
                  value={salaryFrom}
                />
                <Input
                  inputMode="numeric"
                  label="Зарплата до"
                  onChange={(event) =>
                    setSalaryTo(
                      formatNumberWithSpaces(event.currentTarget.value),
                    )
                  }
                  placeholder="8 000 000"
                  value={salaryTo}
                />
                <Dropdown
                  label="Валюта"
                  onChange={setSalaryCurrency}
                  options={currencyOptions}
                  value={salaryCurrency}
                />
                <Dropdown
                  label="Период"
                  onChange={(value) =>
                    setSalaryType(value === "hourly" ? "hourly" : "monthly")
                  }
                  options={[
                    { value: "monthly", label: "В месяц" },
                    { value: "hourly", label: "В час" },
                  ]}
                  value={salaryType}
                />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Checkbox
                  checked={salaryNegotiable}
                  onChange={() => setSalaryNegotiable((value) => !value)}
                />
                <span className="text-sm text-text-heading">
                  Зарплата договорная
                </span>
              </div>
              {errorText("salary")}
            </ClosableSection>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <ClosableSection title="Контакт OLX">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Input
                    label="Контактное лицо"
                    maxLength={255}
                    onChange={(event) =>
                      setContactName(event.currentTarget.value)
                    }
                    value={contactName}
                  />
                  {errorText("contactName")}
                </div>
                <Input
                  label="Телефон"
                  maxLength={50}
                  onChange={(event) =>
                    setContactPhone(event.currentTarget.value)
                  }
                  placeholder="+998 90 123 45 67"
                  value={contactPhone}
                />
              </div>
              <p className="mt-3 text-text-placeholder text-xs leading-[1.4]">
                Email, ссылки и телефон нельзя вставлять в название или описание
                — OLX принимает телефон только в контактном поле.
              </p>
            </ClosableSection>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 mt-6 border-border-input border-t bg-bg-frosted py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-h-[20px] flex-col gap-1">
              {errorText("_form")}
              <FeedbackPresence show={Boolean(savedMessage)}>
                <p className="max-w-2xl text-status-paused text-xs leading-[1.4]">
                  {savedMessage}
                </p>
              </FeedbackPresence>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="ui-button ui-button-secondary"
                onClick={() =>
                  router.push(`/vacancies/${vacancyId}?step=publications`)
                }
                type="button"
              >
                Назад
              </button>
              <button
                className="ui-button ui-button-primary"
                disabled={
                  isSubmitting ||
                  !connected ||
                  attributesQuery.isLoading ||
                  districtsQuery.isLoading
                }
                onClick={handleSubmit}
                type="button"
              >
                <LoadingButtonContent
                  isLoading={isSubmitting}
                  label={effectiveId ? "Обновить на OLX.uz" : "Опубликовать"}
                  loadingLabel={effectiveId ? "Обновление..." : "Публикация..."}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <PublicationConfirmationModal
        confirmLabel={effectiveId ? "Обновить" : "Опубликовать"}
        description={
          effectiveId
            ? "Изменения будут отправлены в OLX.uz и сохранены в публикации."
            : "Будет создано объявление OLX.uz. Публикация может ожидать модерации или доступного пакета."
        }
        isOpen={isConfirmOpen}
        isPending={isSubmitting}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirm}
        onReject={() => setIsConfirmOpen(false)}
        rejectLabel="Отмена"
        title={effectiveId ? "Обновить объявление?" : "Опубликовать на OLX.uz?"}
      />
    </main>
  );
}
