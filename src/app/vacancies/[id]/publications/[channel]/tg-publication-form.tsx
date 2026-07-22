"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { Checkbox } from "~/app/_components/checkbox";
import { ClosableSection } from "~/app/_components/closable-section";
import { ImageUploader } from "~/app/_components/image-uploader";
import { Input } from "~/app/_components/input";
import {
  FeedbackPresence,
  LoadingButtonContent,
  LoadingState,
} from "~/app/_components/motion-system";
import { RichTextEditor } from "~/app/_components/rich-text-editor";
import { useVacancyPublicationStore } from "~/stores/vacancy-publication-store";
import { api } from "~/trpc/react";
import { PublicationConfirmationModal } from "./publication-confirmation-modal";

type TelegramErrors = Partial<
  Record<"title" | "description" | "channels" | "_form", string>
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
  const vacancyQuery = api.vacancies.get.useQuery({ id: pubId ?? vacancyId });
  const channelsQuery = api.integrations.getTelegramChannels.useQuery();
  const telegramPostsQuery = api.vacancies.getPublicationTelegramPosts.useQuery(
    { publicationId: pubId ?? "" },
    { enabled: Boolean(pubId) },
  );
  const [telegramFileId, setTelegramFileId] = useState<string | null>(null);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
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
    setTelegramFileId(vacancy.telegramFileId ?? null);
  }, [setTelegramFields, vacancyQuery.data]);

  // In edit mode, pre-fill the channel selection from the publication's existing posts.
  useEffect(() => {
    if (pubId && telegramPostsQuery.data) {
      setSelectedChannelIds(
        telegramPostsQuery.data
          .map((post) => post.channelId)
          .filter((id): id is string => id !== null),
      );
    }
  }, [pubId, telegramPostsQuery.data]);

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
      publishTelegram.mutate({
        vacancyId: publication.id,
        channelIds: selectedChannelIds,
      });
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

  const toggleChannel = (channelId: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId],
    );
    if (savedMessage) {
      setSavedMessage(null);
    }
    setErrors((prev) =>
      prev.channels || prev._form
        ? { ...prev, channels: undefined, _form: undefined }
        : prev,
    );
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

    // Channels are chosen only on create; edit mode keeps the original channels.
    if (!pubId && selectedChannelIds.length === 0) {
      next.channels = "Выберите хотя бы один канал";
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
        telegramFileId,
        isPublication: true,
      });
      return;
    }

    createPublication.mutate({
      parentId: vacancyId,
      title,
      descriptionHtml: fields.description,
      destination: "telegram",
      telegramFileId: telegramFileId ?? undefined,
      isActive: true,
      isPublication: true,
    });
  };

  const isSubmitting =
    createPublication.isPending ||
    updatePublication.isPending ||
    publishTelegram.isPending;

  // Block publishing when the company has no channels — there's nowhere to post.
  const hasNoChannels =
    !pubId &&
    !channelsQuery.isLoading &&
    (channelsQuery.data?.length ?? 0) === 0;

  if (vacancyQuery.isLoading) {
    return (
      <LoadingState
        className="h-full min-h-[55vh] flex-1 text-text-placeholder"
        label="Загрузка вакансии..."
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

  return (
    <main className="relative w-full bg-bg-canvas">
      <div className="app-page-narrow flex flex-col">
        <div className="w-full">
          <Breadcrumbs
            label="Публикация в Telegram"
            parent={{
              label: vacancyQuery.data.title || "Вакансия",
              href: `/vacancies/${vacancyId}`,
            }}
            rootHref="/vacancies"
            rootLabel="Вакансии"
          />

          <h1 className="page-title mt-5 mb-5">Публикация в Telegram</h1>
        </div>

        <div className="w-full">
          <ImageUploader
            initialImageUrl={
              vacancyQuery.data.telegramFileId
                ? `/api/directus/assets/${vacancyQuery.data.telegramFileId}`
                : null
            }
            onUploaded={setTelegramFileId}
            variant="banner"
          />
        </div>

        <div className="mt-5 flex w-full flex-col">
          <div className="flex flex-col gap-5">
            <div
              className="surface-card scroll-mt-24 p-5 sm:p-6"
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
                    <p className="text-danger-red text-xs leading-[1.4]">
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
                    <p className="text-danger-red text-xs leading-[1.4]">
                      {errors.description}
                    </p>
                  )}
                </div>
              </ClosableSection>
            </div>

            <div className="surface-card scroll-mt-24 p-5 sm:p-6">
              <ClosableSection title="Каналы публикации">
                {channelsQuery.isLoading ? (
                  <LoadingState compact label="Загрузка каналов..." />
                ) : (channelsQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-danger-red text-xs leading-[1.4]">
                    Нет добавленных Telegram-каналов. Добавьте канал в
                    настройках профиля.
                  </p>
                ) : (
                  <div className="flex min-w-0 flex-col gap-3">
                    {pubId && (
                      <p className="text-text-placeholder text-xs leading-[1.4]">
                        Каналы нельзя изменить после публикации.
                      </p>
                    )}
                    {channelsQuery.data?.map((channel) => (
                      <div
                        className={`flex items-center gap-2 ${
                          pubId ? "opacity-70" : ""
                        }`}
                        key={channel.id}
                      >
                        <Checkbox
                          checked={selectedChannelIds.includes(channel.id)}
                          onChange={() => {
                            if (!pubId) {
                              toggleChannel(channel.id);
                            }
                          }}
                        />
                        <span className="text-sm text-text-heading leading-[1.4]">
                          {channel.label || channel.channelId}
                        </span>
                      </div>
                    ))}
                    {errors.channels && (
                      <p className="text-danger-red text-xs leading-[1.4]">
                        {errors.channels}
                      </p>
                    )}
                  </div>
                )}
              </ClosableSection>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 mt-6 border-border-input border-t bg-bg-frosted py-4 backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-h-[20px] flex-col gap-1">
                <FeedbackPresence show={Boolean(errors._form)}>
                  <p className="text-danger-red text-xs leading-[1.4]">
                    {errors._form}
                  </p>
                </FeedbackPresence>
                <FeedbackPresence show={Boolean(savedMessage)}>
                  <p className="text-success-green text-xs leading-[1.4]">
                    {savedMessage}
                  </p>
                </FeedbackPresence>
              </div>
              <div className="flex flex-wrap items-center gap-3">
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
                  disabled={isSubmitting || hasNoChannels}
                  onClick={handleSubmit}
                  type="button"
                >
                  <LoadingButtonContent
                    isLoading={isSubmitting}
                    label={pubId ? "Сохранить изменения" : "Опубликовать"}
                    loadingLabel={pubId ? "Сохранение..." : "Публикация..."}
                  />
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
