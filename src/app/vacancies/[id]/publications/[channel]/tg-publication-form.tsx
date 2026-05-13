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

export function TgPublicationForm({
  vacancyId,
  pubId,
}: {
  vacancyId: string;
  pubId?: string;
}) {
  const router = useRouter();
  const imageInputId = useId();
  const vacancyQuery = api.vacancies.get.useQuery({ id: pubId ?? vacancyId });
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

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
                      setTelegramField("title", event.currentTarget.value)
                    }
                    placeholder="Введите название публикации"
                    value={fields.title}
                  />
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                  <RichTextEditor
                    id="telegram-description-html"
                    label="Описание"
                    maxLength={20000}
                    onChange={(html) => setTelegramField("description", html)}
                    placeholder="Опишите публикацию: обязанности, требования, условия. Используйте списки и заголовки."
                    value={fields.description}
                  />
                </div>
              </ClosableSection>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 mt-8 border-border-input border-t bg-bg-light py-4 backdrop-blur-[10px]">
            <div className="flex justify-end">
              <button
                className="h-10 rounded-md border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover"
                onClick={() =>
                  router.push(`/vacancies/${vacancyId}?step=publications`)
                }
                type="button"
              >
                Назад
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
