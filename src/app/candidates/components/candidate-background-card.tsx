"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronUpIcon,
  DownloadIcon,
  type IconProps,
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

function PackageIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12 3.75 19.5 8 12 12.25 4.5 8 12 3.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M19.5 8V16L12 20.25 4.5 16V8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M12 12.25V20.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EducationIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12 4 19.5 8 12 12 4.5 8 12 4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M7.5 10.5V15.25C7.5 15.25 9.25 17 12 17C14.75 17 16.5 15.25 16.5 15.25V10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function FileOutlineIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M9 3.75H14.25L18.75 8.25V18.75C18.75 19.5784 18.0784 20.25 17.25 20.25H6.75C5.92157 20.25 5.25 19.5784 5.25 18.75V5.25C5.25 4.42157 5.92157 3.75 6.75 3.75H9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M14.25 3.75V8.25H18.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M8.625 12H15.375M8.625 15.75H13.125"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

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
      <span className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
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
    <div className="flex flex-col gap-[10px]">
      <div className="flex w-full items-start gap-[14px]">
        <div className="flex shrink-0 items-center rounded-[6px] bg-[#fff4e3] p-2 text-[#dd8d0c]">
          <PackageIcon className="h-6 w-6" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-medium text-[16px] text-text-heading italic leading-[1.3] tracking-[-0.32px]">
            {company}
          </p>

          <div className="flex flex-wrap items-center gap-x-[5px] gap-y-1">
            <span className="font-medium text-[12px] text-text-placeholder uppercase leading-[1.3] tracking-[-0.24px]">
              {position}
            </span>
            <DotSeparator />
            <span className="font-medium text-[12px] text-text-placeholder uppercase leading-[1.3] tracking-[-0.24px]">
              {period}
            </span>
          </div>
        </div>
      </div>

      {description.length > 0 ? (
        <ul className="ml-[21px] list-disc space-y-[10px] text-[14px] text-text-heading leading-[1.2] tracking-[-0.28px]">
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
    <div className="flex w-full items-start gap-[14px]">
      <div className="flex shrink-0 items-center rounded-[6px] bg-primary-blue-light p-2 text-primary-blue">
        <EducationIcon className="h-6 w-6" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium text-[16px] text-text-heading italic leading-[1.3] tracking-[-0.32px]">
          {institution}
        </p>

        <div className="flex flex-wrap items-center gap-x-[5px] gap-y-1">
          <span className="font-medium text-[12px] text-text-placeholder uppercase leading-[1.3] tracking-[-0.24px]">
            {gpa}
          </span>
          <DotSeparator />
          <span className="font-medium text-[12px] text-text-placeholder uppercase leading-[1.3] tracking-[-0.24px]">
            {period}
          </span>
        </div>
      </div>
    </div>
  );
}

function ResumeRow({ name, size, url }: ResumeFile) {
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
      <div className="flex min-w-0 items-center gap-[14px]">
        <div className="flex shrink-0 items-center rounded-[6px] border border-border-input bg-bg-input p-2 text-text-placeholder">
          <FileOutlineIcon className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <p className="truncate font-medium text-[16px] text-text-heading leading-none tracking-[-0.32px]">
            {name || "Файл не загружен"}
          </p>
          <p className="mt-1 text-[14px] text-text-placeholder leading-none tracking-[-0.28px]">
            {size || "0MB"}
          </p>
        </div>
      </div>

      {downloadControl}
    </div>
  );
}

export function CandidateBackgroundCard({
  workExperience,
  education,
  resumeFile,
  defaultExpandedSections,
}: CandidateBackgroundCardProps) {
  const [isExperienceExpanded, setIsExperienceExpanded] = useState(
    defaultExpandedSections?.experience ?? true,
  );
  const [isEducationExpanded, setIsEducationExpanded] = useState(
    defaultExpandedSections?.education ?? true,
  );

  return (
    <section className="flex w-full flex-col gap-6 overflow-hidden rounded-[8px] border border-border-input bg-white p-5">
      <div className="flex flex-col gap-5">
        <SectionHeader
          isExpanded={isExperienceExpanded}
          onToggle={() => setIsExperienceExpanded((value) => !value)}
          title="Опыт работы"
        />

        {isExperienceExpanded ? (
          <div className="flex flex-col gap-5">
            {workExperience.map((item) => (
              <WorkExperienceEntry
                company={item.company}
                description={item.description}
                key={`${item.company}-${item.position}-${item.period}`}
                period={item.period}
                position={item.position}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="h-px w-full bg-border-input" />

      <div className="flex flex-col gap-5">
        <SectionHeader
          isExpanded={isEducationExpanded}
          onToggle={() => setIsEducationExpanded((value) => !value)}
          title="Образование"
        />

        {isEducationExpanded ? (
          <div className="flex flex-col gap-5">
            {education.map((item) => (
              <EducationEntry
                gpa={item.gpa}
                institution={item.institution}
                key={`${item.institution}-${item.period}-${item.gpa}`}
                period={item.period}
              />
            ))}
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
