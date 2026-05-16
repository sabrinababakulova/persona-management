"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  ImageUploadPlaceholderIcon,
  PencilIcon,
} from "~/app/_components/icons";
import { api } from "~/trpc/react";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

type ImageMimeType = (typeof ALLOWED_IMAGE_TYPES)[number];

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function isAllowedImageType(value: string): value is ImageMimeType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

/** Reads a file into a base64 string without the `data:` URL prefix. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Не удалось прочитать файл"));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

type ImageUploaderProps = {
  /** Visual style: a round avatar button, or a wide banner drop-zone. */
  variant?: "avatar" | "banner";
  /** Existing image URL shown before a new file is picked. */
  initialImageUrl?: string | null;
  /**
   * Called with the Directus file id once the image is stored. May return a promise — any
   * rejection is surfaced as an upload error.
   */
  onUploaded: (fileId: string) => void | Promise<void>;
  /** Disables the picker, e.g. while the parent form is saving. */
  disabled?: boolean;
};

/**
 * Reusable image picker + uploader.
 *
 * Validates the chosen image, uploads it via `storage.uploadImage`, and hands the resulting
 * file id to `onUploaded`. It does not persist the id itself — callers decide where it goes
 * (the user's avatar, a vacancy publication, etc.).
 */
export function ImageUploader({
  variant = "banner",
  initialImageUrl,
  onUploaded,
  disabled = false,
}: ImageUploaderProps) {
  const inputId = useId();
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialImageUrl || null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = api.storage.uploadImage.useMutation();

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const showLocalPreview = (file: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!isAllowedImageType(file.type)) {
      setError("Допустимые форматы: JPEG, PNG, WebP, GIF");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError("Максимальный размер файла — 5 МБ");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const dataBase64 = await readFileAsBase64(file);

      const { fileId } = await uploadImage.mutateAsync({
        dataBase64,
        fileName: file.name,
        mimeType: file.type,
      });

      showLocalPreview(file);
      await onUploaded(fileId);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить изображение",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const fileInput = (
    <input
      accept="image/jpeg,image/png,image/webp,image/gif"
      className="sr-only"
      disabled={disabled || isUploading}
      id={inputId}
      onChange={(event) => void handleChange(event)}
      type="file"
    />
  );

  if (variant === "avatar") {
    return (
      <div className="flex flex-col gap-1">
        <label
          className="group relative block h-[72px] w-[72px] cursor-pointer overflow-hidden rounded-full bg-bg-active-menu focus-within:ring-2 focus-within:ring-primary-blue focus-within:ring-offset-2"
          htmlFor={inputId}
          title="Изменить аватар"
        >
          {previewUrl ? (
            <Image
              alt="Аватар"
              className="h-full w-full object-cover"
              height={72}
              src={previewUrl}
              unoptimized
              width={72}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-icon-secondary">
              <ImageUploadPlaceholderIcon className="h-8 w-8" />
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-text-heading/0 transition-colors group-hover:bg-text-heading/40">
            <PencilIcon className="h-6 w-6 text-bg-light opacity-0 transition-opacity group-hover:opacity-100" />
          </span>
          {fileInput}
        </label>
        {error && (
          <p className="text-[13px] text-danger-red leading-[1.4]">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <label
        aria-label="Выбрать изображение"
        className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-border-input bg-bg-input transition-colors hover:bg-bg-hover"
        htmlFor={inputId}
      >
        {previewUrl ? (
          <Image
            alt="Предпросмотр изображения"
            className="aspect-16/7 w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.01]"
            height={700}
            src={previewUrl}
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
            {isUploading ? "Загрузка изображения..." : "Добавить изображение"}
          </span>
          <span className="text-[13px] text-text-secondary leading-[1.35]">
            Нажмите на обложку, чтобы выбрать файл
          </span>
        </span>
        {fileInput}
      </label>
      {error && (
        <p className="text-[13px] text-danger-red leading-[1.4]">{error}</p>
      )}
    </div>
  );
}
