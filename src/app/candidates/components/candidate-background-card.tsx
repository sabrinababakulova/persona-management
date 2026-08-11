"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  ChevronUpIcon,
  DownloadIcon,
  EducationIcon,
  FileOutlineIcon,
  PackageIcon,
} from "~/app/_components/icons";

type WorkExperienceItem = {
  company: string;
  position: string;
  period: string;
  description: string[];
};

type EducationItem = {
  institution: string;
  gpa: string;
  period: string;
};

type ResumeFile = {
  name: string;
  size: string;
  url?: string;
};

type CandidateBackgroundCardProps = {
  workExperience: WorkExperienceItem[];
  education: EducationItem[];
  resumeFile: ResumeFile;
  defaultExpandedSections?: {
    experience?: boolean;
    education?: boolean;
  };
};

type SectionHeaderProps = {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
};

function DotSeparator() {
  return <span className="text-text-disabled">|</span>;
}

function SectionHeader({ title, isExpanded, onToggle }: SectionHeaderProps) {
  return (
    <button
      className="flex w-full items-center justify-between"
      onClick={onToggle}
      type="button"
    >
      <span className="font-semibold text-text-heading text-xl leading-[1.1]">
        {title}
      </span>
      <ChevronUpIcon
        className={`h-4 w-4 text-text-placeholder transition-transform ${
          isExpanded ? "" : "rotate-180"
        }`}
      />
    </button>
  );
}

function WorkExperienceEntry({
  company,
  position,
  period,
  description,
}: WorkExperienceItem) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex w-full items-start gap-3.5">
        <div className="flex shrink-0 items-center rounded-lg bg-status-neutral-bg p-2 text-warning-yellow">
          <PackageIcon className="h-6 w-6" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-medium text-base text-text-heading italic leading-[1.3]">
            {company}
          </p>

          <div className="flex flex-wrap items-center gap-x-[5px] gap-y-1">
            <span className="font-medium text-text-placeholder text-xs uppercase leading-[1.3]">
              {position}
            </span>
            <DotSeparator />
            <span className="font-medium text-text-placeholder text-xs uppercase leading-[1.3]">
              {period}
            </span>
          </div>
        </div>
      </div>

      {description.length > 0 ? (
        <ul className="ml-5 list-disc space-y-2.5 text-sm text-text-heading leading-[1.2]">
          {description.map((item) => (
            <li key={`${company}-${position}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EducationEntry({ institution, gpa, period }: EducationItem) {
  return (
    <div className="flex w-full items-start gap-3.5">
      <div className="flex shrink-0 items-center rounded-lg bg-primary-blue-light p-2 text-primary-blue">
        <EducationIcon className="h-6 w-6" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium text-base text-text-heading italic leading-[1.3]">
          {institution}
        </p>

        <div className="flex flex-wrap items-center gap-x-[5px] gap-y-1">
          <span className="font-medium text-text-placeholder text-xs uppercase leading-[1.3]">
            {gpa}
          </span>
          <DotSeparator />
          <span className="font-medium text-text-placeholder text-xs uppercase leading-[1.3]">
            {period}
          </span>
        </div>
      </div>
    </div>
  );
}

function ResumeRow({ name, size, url }: ResumeFile) {
  const t = useTranslations("CandidateDetail");
  const downloadControl = url ? (
    <Link
      className="text-primary-blue transition-colors hover:text-primary-blue-hover"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <DownloadIcon className="h-6 w-6" />
    </Link>
  ) : (
    <span className="text-text-disabled">
      <DownloadIcon className="h-6 w-6" />
    </span>
  );

  return (
    <div className="flex w-full items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex shrink-0 items-center rounded-lg border border-border-input bg-bg-input p-2 text-text-placeholder">
          <FileOutlineIcon className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <p className="truncate font-medium text-base text-text-heading leading-none">
            {name || t("fileMissing")}
          </p>
          {size ? (
            <p className="mt-1 text-sm text-text-placeholder leading-none">
              {size}
            </p>
          ) : null}
        </div>
      </div>

      {downloadControl}
    </div>
  );
}

function EmptySectionState() {
  const t = useTranslations("CandidateDetail");

  return (
    <p className="text-sm text-text-placeholder leading-[1.3]">
      {t("emptySection")}
    </p>
  );
}

export function CandidateBackgroundCard({
  workExperience,
  education,
  resumeFile,
  defaultExpandedSections,
}: CandidateBackgroundCardProps) {
  const t = useTranslations("CandidateDetail");
  const [isExperienceExpanded, setIsExperienceExpanded] = useState(
    defaultExpandedSections?.experience ?? true,
  );
  const [isEducationExpanded, setIsEducationExpanded] = useState(
    defaultExpandedSections?.education ?? true,
  );

  return (
    <section className="surface-card flex w-full flex-col gap-5 overflow-hidden p-5">
      <div className="flex flex-col gap-5">
        <SectionHeader
          isExpanded={isExperienceExpanded}
          onToggle={() => setIsExperienceExpanded((value) => !value)}
          title={t("workExperience")}
        />

        {isExperienceExpanded ? (
          <div className="flex flex-col gap-5">
            {workExperience.length > 0 ? (
              workExperience.map((item) => (
                <WorkExperienceEntry
                  company={item.company}
                  description={item.description}
                  key={`${item.company}-${item.position}-${item.period}`}
                  period={item.period}
                  position={item.position}
                />
              ))
            ) : (
              <EmptySectionState />
            )}
          </div>
        ) : null}
      </div>

      <div className="h-px w-full bg-border-input" />

      <div className="flex flex-col gap-5">
        <SectionHeader
          isExpanded={isEducationExpanded}
          onToggle={() => setIsEducationExpanded((value) => !value)}
          title={t("education")}
        />

        {isEducationExpanded ? (
          <div className="flex flex-col gap-5">
            {education.length > 0 ? (
              education.map((item) => (
                <EducationEntry
                  gpa={item.gpa}
                  institution={item.institution}
                  key={`${item.institution}-${item.period}-${item.gpa}`}
                  period={item.period}
                />
              ))
            ) : (
              <EmptySectionState />
            )}
          </div>
        ) : null}
      </div>

      <div className="h-px w-full bg-border-input" />

      <ResumeRow
        name={resumeFile.name}
        size={resumeFile.size}
        url={resumeFile.url}
      />
    </section>
  );
}
