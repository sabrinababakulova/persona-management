"use client";

import { useEffect, useRef, useState } from "react";
import type { CandidateResumePrefillData } from "~/schemas/resume-analysis";
import { api } from "~/trpc/react";
import { bytesToBase64 } from "~/utils/bytes-to-base64";
import { FileUploadIcon } from "./icons";
import { FeedbackPresence, LoadingButtonContent } from "./motion-system";

export type ResumeUploadMeta = {
  resumeFileId: string;
  resumeFileName: string;
  resumeFileSize: string;
  prefillData: CandidateResumePrefillData;
  prefillStatus: "success" | "no_data" | "failed";
  prefillErrorMessage?: string;
  aiAnalysis: string;
  aiAnalysisStatus: "success" | "failed";
  aiAnalysisErrorMessage?: string;
};

type ResumeFileUploaderProps = {
  candidateId: string;
  currentResumeFileId?: string;
  disabled?: boolean;
  onUploaded?: (uploadedResume: ResumeUploadMeta) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  className?: string;
};

export function ResumeFileUploader({
  candidateId,
  currentResumeFileId,
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
        previousResumeFileId: currentResumeFileId,
      });

      setResumeFileName(uploadedResume.resumeFileName);
      setResumeFileSize(uploadedResume.resumeFileSize);
      if (uploadedResume.prefillStatus === "failed") {
        setUploadError(
          uploadedResume.prefillErrorMessage ??
            "Не удалось проанализировать резюме автоматически",
        );
      }
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
        className="flex h-24 w-full flex-col items-center justify-center rounded-lg border border-border-input border-dashed bg-bg-input px-3 py-3.5 transition-colors hover:border-primary-blue disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || uploadResume.isPending}
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        <div className="flex items-center gap-2">
          <FileUploadIcon className="h-5 w-5 text-text-placeholder" />
          <span className="font-medium text-base text-text-placeholder leading-[1.4]">
            <LoadingButtonContent
              isLoading={uploadResume.isPending}
              label="Загрузите PDF файл"
              loadingLabel="Загрузка..."
            />
          </span>
        </div>
        <p className="font-normal text-text-disabled text-xs leading-[1.4]">
          Файл должен быть менее 10МБ
        </p>
      </button>
      <FeedbackPresence show={Boolean(resumeFileName)}>
        <p className="mt-1 font-medium text-success-green text-xs leading-[1.4]">
          Загружено: {resumeFileName}
          {resumeFileSize ? ` (${resumeFileSize})` : ""}
        </p>
      </FeedbackPresence>
      <FeedbackPresence show={Boolean(uploadError)}>
        <p className="mt-1 text-accent-red text-sm">{uploadError}</p>
      </FeedbackPresence>
    </div>
  );
}
