"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type {
  QuickAddCandidateModalProps,
  QuickAddCandidatePayload,
} from "~/types/components/quick-add-candidate-modal";
import { Dropdown } from "./dropdown";
import { AIGenerationIcon } from "./icons";
import { Modal } from "./modal";
import { FeedbackPresence, LoadingButtonContent } from "./motion-system";
import {
  ResumeFileUploader,
  type ResumeUploadMeta,
} from "./resume-file-uploader";

export type { QuickAddCandidatePayload };

export function QuickAddCandidateModal({
  isOpen,
  onClose,
  onAddMoreData,
  onSaveCandidate,
  isSaving = false,
  errorMessage,
  contactTypeOptions = [],
  sourceOptions = [],
  statusOptions = [],
}: QuickAddCandidateModalProps) {
  const t = useTranslations("CandidateForm");
  const common = useTranslations("Common");
  const validation = useTranslations("Validation");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [contactValue, setContactValue] = useState("");
  const [contactType, setContactType] = useState(
    contactTypeOptions[0]?.value ?? "",
  );
  const [candidateDraftId, setCandidateDraftId] = useState(() =>
    crypto.randomUUID(),
  );
  const [status, setStatus] = useState(statusOptions[0]?.value ?? "");
  const [source, setSource] = useState(sourceOptions[0]?.value ?? "");
  const [resumeFileId, setResumeFileId] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeFileSize, setResumeFileSize] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [resumePrefillData, setResumePrefillData] =
    useState<ResumeUploadMeta["prefillData"]>();
  const [isResumeUploading, setIsResumeUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setContactType(contactTypeOptions[0]?.value ?? "");
  }, [contactTypeOptions]);

  useEffect(() => {
    setSource(sourceOptions[0]?.value ?? "");
  }, [sourceOptions]);

  useEffect(() => {
    setStatus(statusOptions[0]?.value ?? "");
  }, [statusOptions]);

  useEffect(() => {
    if (!isOpen) {
      setFullName("");
      setEmail("");
      setContactValue("");
      setContactType(contactTypeOptions[0]?.value ?? "");
      setCandidateDraftId(crypto.randomUUID());
      setStatus(statusOptions[0]?.value ?? "");
      setSource(sourceOptions[0]?.value ?? "");
      setResumeFileId("");
      setResumeFileName("");
      setResumeFileSize("");
      setAiAnalysis("");
      setResumePrefillData(undefined);
      setIsResumeUploading(false);
      setLocalError(null);
    }
  }, [contactTypeOptions, isOpen, sourceOptions, statusOptions]);

  const normalizeOptionToken = (value: string) => value.trim().toLowerCase();

  const findOptionValue = (
    rawValue: string,
    options: { value: string; label: string }[],
  ) => {
    const token = normalizeOptionToken(rawValue);
    if (!token) {
      return "";
    }

    const match = options.find(
      (option) =>
        normalizeOptionToken(option.value) === token ||
        normalizeOptionToken(option.label) === token,
    );

    return match?.value ?? "";
  };

  const handleResumeUploaded = (uploadedResume: ResumeUploadMeta) => {
    setResumeFileId(uploadedResume.resumeFileId);
    setResumeFileName(uploadedResume.resumeFileName);
    setResumeFileSize(uploadedResume.resumeFileSize);
    setAiAnalysis(uploadedResume.aiAnalysis);
    setResumePrefillData(uploadedResume.prefillData);

    const { prefillData } = uploadedResume;
    if (prefillData.fullName) {
      setFullName(prefillData.fullName);
      setLocalError(null);
    }

    const emailContact = prefillData.contacts.find(
      (contact) => normalizeOptionToken(contact.type) === "email",
    );
    if (emailContact?.value) {
      setEmail(emailContact.value);
    }

    const firstContact = prefillData.contacts.find(
      (contact) => normalizeOptionToken(contact.type) !== "email",
    );
    if (firstContact?.value) {
      setContactValue(firstContact.value);
    }
    if (firstContact?.type) {
      const matchedContactType = findOptionValue(
        firstContact.type,
        contactTypeOptions,
      );
      if (matchedContactType) {
        setContactType(matchedContactType);
      }
    }

    if (prefillData.source) {
      const matchedSource = findOptionValue(prefillData.source, sourceOptions);
      if (matchedSource) {
        setSource(matchedSource);
      }
    }

    if (prefillData.status) {
      const matchedStatus = findOptionValue(prefillData.status, statusOptions);
      if (matchedStatus) {
        setStatus(matchedStatus);
      }
    }
  };

  const handleSave = () => {
    if (!fullName.trim()) {
      setLocalError(t("enterFullName"));
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setLocalError(validation("invalidEmail"));
      return;
    }
    if (contactValue.trim() && !contactType) {
      setLocalError(t("selectContactType"));
      return;
    }
    if (statusOptions.length > 0 && !status) {
      setLocalError(t("selectCandidateStatus"));
      return;
    }

    setLocalError(null);
    onSaveCandidate?.({
      candidateId: candidateDraftId,
      fullName: fullName.trim(),
      email: email.trim(),
      contactType,
      contactValue: contactValue.trim(),
      status: status || undefined,
      source,
      aiAnalysis: aiAnalysis || undefined,
      resumeFileId: resumeFileId || undefined,
      resumeFileName: resumeFileName || undefined,
      resumeFileSize: resumeFileSize || undefined,
      resumePrefillData,
    });
  };

  return (
    <Modal
      ariaLabelledBy="quick-add-candidate-modal-title"
      isOpen={isOpen}
      maxWidthClassName="max-w-[500px]"
      onClose={onClose}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2
            className="font-semibold text-text-heading text-xl leading-[1.1]"
            id="quick-add-candidate-modal-title"
          >
            {t("quickAdd")}
          </h2>
          <Dropdown
            fieldClassName="h-8 px-2 py-2 pr-6 text-sm leading-none"
            hideLabel
            iconClassName="right-2 text-text-placeholder"
            label={t("status")}
            onChange={(value) => setStatus(value)}
            options={statusOptions}
            value={status}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="font-medium text-base text-text-label leading-[1.4]"
            htmlFor="quick-add-fullname"
          >
            {t("fullName")}
          </label>
          <input
            className="h-11 w-full rounded-xl border border-border-input bg-bg-input px-3.5 text-sm text-text-heading leading-5 placeholder:text-text-placeholder hover:border-border-control focus:border-primary-blue focus:outline-none"
            id="quick-add-fullname"
            onChange={(event) => setFullName(event.target.value)}
            placeholder={t("fullNamePlaceholder")}
            type="text"
            value={fullName}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="font-medium text-base text-text-label leading-[1.4]"
            htmlFor="quick-add-email"
          >
            {t("email")}
          </label>
          <input
            autoComplete="email"
            className="h-11 w-full rounded-xl border border-border-input bg-bg-input px-3.5 text-sm text-text-heading leading-5 placeholder:text-text-placeholder hover:border-border-control focus:border-primary-blue focus:outline-none"
            id="quick-add-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("emailPlaceholder")}
            type="email"
            value={email}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-base text-text-label leading-[1.4]">
              {t("contacts")}
            </p>
            <button
              className="text-3xl text-primary-blue leading-none"
              type="button"
            >
              +
            </button>
          </div>
          <div className="flex items-end gap-4">
            <input
              className="h-11 w-full max-w-72 rounded-xl border border-border-input bg-bg-input px-3.5 text-sm text-text-heading leading-5 placeholder:text-text-placeholder hover:border-border-control focus:border-primary-blue focus:outline-none"
              onChange={(event) => setContactValue(event.target.value)}
              placeholder={t("contactPlaceholder")}
              type="text"
              value={contactValue}
            />
            <Dropdown
              className="min-w-[150px]"
              fieldClassName="h-12"
              hideLabel
              iconClassName="h-5 w-5 right-2 text-text-placeholder"
              id="quick-add-contact-type"
              label={t("contactType")}
              onChange={setContactType}
              options={contactTypeOptions}
              value={contactType}
            />
          </div>
        </div>

        <Dropdown
          id="quick-add-source"
          label={t("source")}
          onChange={setSource}
          options={sourceOptions}
          value={source}
        />

        <div className="flex flex-col gap-1">
          <p className="font-medium text-base text-text-label leading-[1.4]">
            {t("resume")}
          </p>
          <ResumeFileUploader
            candidateId={candidateDraftId}
            currentResumeFileId={resumeFileId}
            disabled={isSaving}
            onUploaded={handleResumeUploaded}
            onUploadingChange={setIsResumeUploading}
          />
          <p className="flex gap-1 font-medium text-ai-violet text-xs leading-[1.4]">
            <span className="flex font-bold">
              <AIGenerationIcon />
              AI
            </span>
            {t("resumeSaveInfo")}
          </p>
        </div>

        <FeedbackPresence show={Boolean(localError ?? errorMessage)}>
          <p className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
            {localError ?? errorMessage}
          </p>
        </FeedbackPresence>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            className="ui-button ui-button-soft sm:min-w-56"
            href="/candidates/create"
            onClick={onAddMoreData}
          >
            {t("addMoreData")}
          </Link>
          <button
            className="ui-button ui-button-primary"
            disabled={isSaving || isResumeUploading}
            onClick={handleSave}
            type="button"
          >
            <LoadingButtonContent
              isLoading={isSaving}
              label={t("saveCandidate")}
              loadingLabel={common("saving")}
            />
          </button>
        </div>
      </div>
    </Modal>
  );
}
