"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { ClosableSection } from "~/app/_components/closable-section";
import { ImageUploadPlaceholderIcon } from "~/app/_components/icons";
import { Input } from "~/app/_components/input";
import { RichTextEditor } from "~/app/_components/rich-text-editor";
import { useVacancyPublicationStore } from "~/stores/vacancy-publication-store";
import { api } from "~/trpc/react";
import { PublicationConfirmationModal } from "./publication-confirmation-modal";

type TelegramErrors = Partial<
  Record<"title" | "description" | "_form", string>
>;

function hasMeaningfulHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

export function TgPublicationForm({
  vacancyId,
  pubId,
}: {
  vacancyId: string;
  pubId?: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const imageInputId = useId();
  const vacancyQuery = api.vacancies.get.useQuery({ id: pubId ?? vacancyId });
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<TelegramErrors>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);

  const fields = useVacancyPublicationStore((s) => s.telegram);
  const setTelegramField = useVacancyPublicationStore(
    (s) => s.setTelegramField,
  );
  const setTelegramFields = useVacancyPublicationStore(
    (s) => s.setTelegramFields,
  );

  useEffect(() => {
    const vacancy = vacancyQuery.data;
    if (!vacancy) {
      return;
    }

    setTelegramFields({
      title: vacancy.title ?? "",
      description: vacancy.descriptionHtml ?? "",
    });
  }, [setTelegramFields, vacancyQuery.data]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleImageChange = (file: File | undefined) => {
    if (!file) {
      return;
    }

    setImagePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });
  };

  const publishTelegram = api.vacancies.publishTelegram.useMutation({
    onSuccess: async (_result, variables) => {
      setErrors({});
      setSavedMessage("Публикация опубликована");
      setIsPublishConfirmOpen(false);
      await Promise.all([
        utils.vacancies.get.invalidate({ id: vacancyId }),
        utils.vacancies.get.invalidate({ id: variables.vacancyId }),
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);
      router.push(`/vacancies/${vacancyId}?step=publications`);
    },
    onError: (error) => {
      setSavedMessage(null);
      setIsPublishConfirmOpen(false);
      setErrors({
        _form: error.message || "Не удалось опубликовать в Telegram",
      });
    },
  });

  const createPublication = api.vacancies.create.useMutation({
    onSuccess: async (publication) => {
      setErrors({});
      await Promise.all([
        utils.vacancies.get.invalidate({ id: vacancyId }),
        utils.vacancies.get.invalidate({ id: publication.id }),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);
      publishTelegram.mutate({ vacancyId: publication.id });
    },
    onError: (error) => {
      setSavedMessage(null);
      setIsPublishConfirmOpen(false);
      setErrors({
        _form: error.message || "Не удалось сохранить публикацию",
      });
    },
  });

  const updatePublication = api.vacancies.update.useMutation({
    onSuccess: async () => {
      setErrors({});
      setSavedMessage("Публикация обновлена");
      setIsPublishConfirmOpen(false);
      await Promise.all([
        utils.vacancies.get.invalidate({ id: vacancyId }),
        pubId
          ? utils.vacancies.get.invalidate({ id: pubId })
          : Promise.resolve(),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);
      router.push(`/vacancies/${vacancyId}?step=publications`);
    },
    onError: (error) => {
      setSavedMessage(null);
      setIsPublishConfirmOpen(false);
      setErrors({
        _form: error.message || "Не удалось обновить публикацию",
      });
    },
  });

  const handleFieldChange = (key: "title" | "description", value: string) => {
    setTelegramField(key, value);
    if (savedMessage) {
      setSavedMessage(null);
    }
    setErrors((prev) => {
      if (!prev[key] && !prev._form) {
        return prev;
      }
      return { ...prev, [key]: undefined, _form: undefined };
    });
  };

  const validate = (): boolean => {
    const next: TelegramErrors = {};
    const title = fields.title.trim();

    if (!title) {
      next.title = "Введите название публикации";
    } else if (title.length > 255) {
      next.title = "Название не должно быть длиннее 255 символов";
    }

    if (!hasMeaningfulHtml(fields.description)) {
      next.description = "Заполните описание публикации";
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = () => {
    if (!validate() || !vacancyQuery.data) {
      return;
    }
    setIsPublishConfirmOpen(true);
  };

  const handleConfirmSubmit = () => {
    if (!validate() || !vacancyQuery.data) {
      setIsPublishConfirmOpen(false);
      return;
    }

    const title = fields.title.trim();

    if (pubId) {
      updatePublication.mutate({
        id: pubId,
        title,
        descriptionHtml: fields.description,
        isPublication: true,
      });
      return;
    }

    createPublication.mutate({
      parentId: vacancyId,
      title,
      descriptionHtml: fields.description,
      destination: "telegram",
      isActive: true,
      isPublication: true,
    });
  };

  const isSubmitting =
    createPublication.isPending ||
    updatePublication.isPending ||
    publishTelegram.isPending;

  if (vacancyQuery.isLoading) {
    return (
      <main className="flex h-full flex-1 items-center justify-center text-text-placeholder">
        Загрузка вакансии...
      </main>
    );
  }

  if (!vacancyQuery.data) {
    return (
      <main className="flex h-full flex-1 items-center justify-center text-text-placeholder">
        Вакансия не найдена
      </main>
    );
  }

  return (
    <main className="relative w-full">
      <div className="flex w-full flex-col px-6 pt-8 pb-8">
        <div className="w-full max-w-225">
          <Breadcrumbs
            label="Публикация в Telegram"
            parent={{
              label: vacancyQuery.data.title || "Вакансия",
              href: `/vacancies/${vacancyId}`,
            }}
            rootHref="/vacancies"
            rootLabel="Вакансии"
          />

          <h1 className="mt-6 mb-6 font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
            Публикация в Telegram
          </h1>
        </div>

        <div className="w-full max-w-225">
          <label
            aria-label="Выбрать изображение для публикации"
            className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-border-input bg-bg-input transition-colors hover:bg-bg-hover"
            htmlFor={imageInputId}
            role="img"
          >
            {imagePreviewUrl ? (
              <Image
                alt="telegram-publication-image-preview"
                className="aspect-16/7 w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.01]"
                height={700}
                src={imagePreviewUrl}
                unoptimized
                width={700}
              />
            ) : (
              <span className="flex aspect-16/7 w-full items-center justify-center text-icon-secondary transition-colors group-hover:text-primary">
                <ImageUploadPlaceholderIcon />
              </span>
            )}
            <span className="flex flex-col gap-1 border-border-input border-t bg-bg-light p-4 text-text-heading">
              <span className="font-semibold text-[18px] leading-none">
                Добавить изображение
              </span>
              <span className="text-[13px] text-text-secondary leading-[1.35]">
                Нажмите на обложку, чтобы выбрать файл
              </span>
            </span>
          </label>
          <input
            accept="image/*"
            className="sr-only"
            id={imageInputId}
            onChange={(event) =>
              handleImageChange(event.currentTarget.files?.[0])
            }
            type="file"
          />
        </div>

        <div className="mt-8 flex w-full max-w-225 flex-col">
          <div className="flex flex-col gap-8">
            <div
              className="scroll-mt-24 rounded-lg border border-border-input bg-bg-light p-4 lg:p-6"
              id="telegram-publication"
            >
              <ClosableSection title="Контент публикации">
                <div className="flex min-w-0 flex-col gap-2">
                  <Input
                    label="Название"
                    maxLength={255}
                    onChange={(event) =>
                      handleFieldChange("title", event.currentTarget.value)
                    }
                    placeholder="Введите название публикации"
                    value={fields.title}
                  />
                  {errors.title && (
                    <p className="text-[13px] text-danger-red leading-[1.4]">
                      {errors.title}
                    </p>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                  <RichTextEditor
                    id="telegram-description-html"
                    label="Описание"
                    maxLength={20000}
                    onChange={(html) => handleFieldChange("description", html)}
                    placeholder="Опишите публикацию: обязанности, требования, условия. Используйте списки и заголовки."
                    value={fields.description}
                  />
                  {errors.description && (
                    <p className="text-[13px] text-danger-red leading-[1.4]">
                      {errors.description}
                    </p>
                  )}
                </div>
              </ClosableSection>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 mt-8 border-border-input border-t bg-bg-light py-4 backdrop-blur-[10px]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-h-[20px] flex-col gap-1">
                {errors._form && (
                  <p className="text-[13px] text-danger-red leading-[1.4]">
                    {errors._form}
                  </p>
                )}
                {savedMessage && (
                  <p className="text-[13px] text-success-green leading-[1.4]">
                    {savedMessage}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="h-10 rounded-md border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover"
                  onClick={() =>
                    router.push(`/vacancies/${vacancyId}?step=publications`)
                  }
                  type="button"
                >
                  Назад
                </button>
                <button
                  className="h-10 rounded-md bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  type="button"
                >
                  {isSubmitting
                    ? pubId
                      ? "Сохранение..."
                      : "Публикация..."
                    : pubId
                      ? "Сохранить изменения"
                      : "Опубликовать"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PublicationConfirmationModal
        confirmLabel={pubId ? "Обновить" : "Опубликовать"}
        description={
          pubId
            ? "Изменения будут сохранены в базе данных без публикации в Telegram."
            : "Публикация будет сохранена и отправлена в Telegram."
        }
        isOpen={isPublishConfirmOpen}
        isPending={isSubmitting}
        onClose={() => setIsPublishConfirmOpen(false)}
        onConfirm={handleConfirmSubmit}
        onReject={() => setIsPublishConfirmOpen(false)}
        rejectLabel="Отмена"
        title={pubId ? "Обновить публикацию?" : "Опубликовать публикацию?"}
      />
    </main>
  );
}
