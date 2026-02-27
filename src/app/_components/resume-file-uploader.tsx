"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { bytesToBase64 } from "~/utils/bytes-to-base64";
import { FileUploadIcon } from "./icons";

type ResumeUploadMeta = {
  resumeUrl: string;
  resumeFileName: string;
  resumeFileSize: string;
};

type ResumeFileUploaderProps = {
  candidateId: string;
  disabled?: boolean;
  onUploaded?: (uploadedResume: ResumeUploadMeta) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  className?: string;
};

export function ResumeFileUploader({
  candidateId,
  disabled = false,
  onUploaded,
  onUploadingChange,
  className,
}: ResumeFileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeFileSize, setResumeFileSize] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadResume = api.candidates.uploadResume.useMutation();

  useEffect(() => {
    onUploadingChange?.(uploadResume.isPending);
  }, [onUploadingChange, uploadResume.isPending]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: codex seems to like it
  useEffect(() => {
    setResumeFileName("");
    setResumeFileSize("");
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [candidateId]);

  const handleResumeUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setUploadError(null);

    try {
      const fileBytes = new Uint8Array(await selectedFile.arrayBuffer());
      const fileBase64 = bytesToBase64(fileBytes);

      const uploadedResume = await uploadResume.mutateAsync({
        candidateId,
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        fileBase64,
      });

      setResumeFileName(uploadedResume.resumeFileName);
      setResumeFileSize(uploadedResume.resumeFileSize);
      onUploaded?.(uploadedResume);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Не удалось загрузить резюме",
      );
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className={className}>
      <input
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleResumeUpload}
        ref={fileInputRef}
        type="file"
      />
      <button
        className="flex h-24 w-full flex-col items-center justify-center rounded-[6px] border border-border-input border-dashed bg-bg-input px-3 py-[14px] transition-colors hover:border-primary-blue disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || uploadResume.isPending}
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        <div className="flex items-center gap-2">
          <FileUploadIcon className="h-5 w-5 text-text-placeholder" />
          <span className="font-medium text-[16px] text-text-placeholder leading-[1.4] tracking-[-0.32px]">
            {uploadResume.isPending ? "Загрузка..." : "Загрузите PDF файл"}
          </span>
        </div>
        <p className="font-normal text-[12px] text-text-disabled leading-[1.4] tracking-[-0.24px]">
          Файл должен быть менее 10МБ
        </p>
      </button>
      {resumeFileName && (
        <p className="mt-1 font-medium text-[12px] text-success-green leading-[1.4] tracking-[-0.24px]">
          Загружено: {resumeFileName}
          {resumeFileSize ? ` (${resumeFileSize})` : ""}
        </p>
      )}
      {uploadError && (
        <p className="mt-1 text-[14px] text-accent-red tracking-[-0.28px]">
          {uploadError}
        </p>
      )}
    </div>
  );
}
