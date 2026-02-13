"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { GlobeIcon } from "../../_components/icons";

// Additional icons
function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Briefcase</title>
      <path
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Building</title>
      <path
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Phone</title>
      <path
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Telegram</title>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Email</title>
      <path
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Edit</title>
      <path
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Delete</title>
      <path
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Add</title>
      <path
        d="M12 4v16m8-8H4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Download</title>
      <path
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>File</title>
      <path
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function GraduationCapIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Education</title>
      <path d="M12 14l9-5-9-5-9 5 9 5z" />
      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      <path
        d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>Back</title>
      <path
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

export default function CandidateDetailPage() {
  const params = useParams();
  const candidateId = params.id as string;

  const { data: candidate, isLoading } =
    api.candidates.getCandidateById.useQuery({ id: candidateId });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Кандидат не найден</div>
      </div>
    );
  }

  return (
    <>
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Page Content */}
        <div className="p-4 lg:p-8">
          {/* Back Link */}
          <Link
            className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
            href="/candidates"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Назад к кандидатам</span>
          </Link>

          {/* Page Title */}
          <h1 className="mb-6 font-bold text-2xl text-gray-900 lg:text-3xl">
            Профиль кандидата
          </h1>

          {/* Main Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column - Profile Info */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-border-light bg-white p-6">
                {/* Name and Location */}
                <div className="mb-4">
                  <h2 className="font-bold text-gray-900 text-xl">
                    {candidate.name}
                  </h2>
                  <div className="mt-1 flex items-center gap-2 text-sm text-text-muted">
                    <span className="font-medium text-gray-700">
                      {candidate.location}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span>{candidate.experience}</span>
                  </div>
                </div>

                {/* Match Score and Salary */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-bg-light p-4">
                    <div className="font-bold text-3xl text-gray-900">
                      {candidate.matchScore}%
                    </div>
                    <div className="text-sm text-text-muted">Соответствия</div>
                  </div>
                  <div className="rounded-xl bg-bg-light p-4">
                    <div className="font-bold text-3xl text-gray-900">
                      ${candidate.salaryExpectation}
                    </div>
                    <div className="text-sm text-text-muted">
                      Зарплатные ожидания
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div className="mb-6 flex flex-wrap gap-2">
                  {candidate.tags.map((tag) => (
                    <span
                      className="rounded-lg bg-pink-100 px-3 py-1.5 font-medium text-pink-600 text-sm"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Current Position */}
                <div className="mb-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-text-muted">
                    <BriefcaseIcon className="h-4 w-4" />
                    <span>Текущая должность</span>
                  </div>
                  <div className="font-medium text-gray-900">
                    {candidate.currentPosition.company}
                  </div>
                  <div className="text-sm text-text-muted">
                    {candidate.currentPosition.position}
                  </div>
                </div>

                {/* Languages */}
                <div className="mb-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-text-muted">
                    <GlobeIcon className="h-4 w-4" />
                    <span>Языки</span>
                  </div>
                  {candidate.languages.map((lang) => (
                    <div
                      className="flex items-center gap-2 text-sm"
                      key={lang.name}
                    >
                      <span className="font-medium text-gray-900">
                        {lang.name}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-text-muted">{lang.level}</span>
                    </div>
                  ))}
                </div>

                {/* Skills */}
                <div className="mb-6">
                  <div className="mb-2 flex items-center gap-2 text-sm text-text-muted">
                    <BuildingIcon className="h-4 w-4" />
                    <span>Навыки</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill) => (
                      <span
                        className="rounded-lg bg-gray-100 px-3 py-1 text-gray-700 text-sm"
                        key={skill}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Contacts */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <PhoneIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">
                      {candidate.contacts.phone}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <TelegramIcon className="h-4 w-4 text-blue-500" />
                    <span className="text-gray-700">
                      {candidate.contacts.telegram}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <EmailIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">
                      {candidate.contacts.email}
                    </span>
                  </div>
                </div>

                {/* Other Vacancies */}
                <div className="mt-6 border-border-light border-t pt-4">
                  <div className="mb-2 text-sm text-text-muted">
                    Другие вакансии
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {candidate.otherVacancies.map((vacancy) => (
                      <span
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-primary-blue text-sm"
                        key={vacancy}
                      >
                        {vacancy}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Column - Experience & Education */}
            <div className="lg:col-span-4">
              <div className="space-y-6">
                {/* Work Experience */}
                <div className="rounded-2xl border border-border-light bg-white p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-lg">
                      Опыт работы
                    </h3>
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      type="button"
                    >
                      <BuildingIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {candidate.workExperience.map((exp) => (
                      <div
                        className="flex gap-4"
                        key={`${exp.company}-${exp.period}`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-100">
                          <GraduationCapIcon className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {exp.company}
                            </span>
                            <span className="text-gray-400">|</span>
                            <span className="text-sm text-text-muted">
                              {exp.period}
                            </span>
                          </div>
                          <div className="mb-2 font-medium text-primary-blue text-sm">
                            {exp.position}
                          </div>
                          <ul className="space-y-1">
                            {exp.description.map((desc, descIndex) => (
                              <li
                                className="text-sm text-text-muted"
                                key={`${exp.company}-desc-${descIndex}`}
                              >
                                • {desc}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Education */}
                <div className="rounded-2xl border border-border-light bg-white p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-lg">
                      Образование
                    </h3>
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      type="button"
                    >
                      <BuildingIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {candidate.education.map((edu) => (
                      <div
                        className="flex gap-4"
                        key={`${edu.institution}-${edu.period}-${edu.isCurrent}`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                          <GraduationCapIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 font-medium text-gray-900">
                            {edu.institution}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-text-muted">
                            <span>{edu.gpa}</span>
                            <span className="text-gray-400">|</span>
                            <span>{edu.period}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resume */}
                <div className="rounded-2xl border border-border-light bg-white p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <FileIcon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {candidate.resumeFile.name}
                      </div>
                      <div className="text-sm text-text-muted">
                        {candidate.resumeFile.size}
                      </div>
                    </div>
                    <button
                      className="text-primary-blue hover:text-primary-blue-dark"
                      type="button"
                    >
                      <DownloadIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Notes & Activities */}
            <div className="lg:col-span-4">
              <div className="space-y-6">
                {/* Recruiter Notes */}
                <div className="rounded-2xl border border-border-light bg-white p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-lg">
                      Заметки рекрутера
                    </h3>
                    <button
                      className="text-primary-blue hover:text-primary-blue-dark"
                      type="button"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {candidate.notes.map((note) => (
                      <div
                        className="rounded-xl border border-border-light bg-bg-light p-4"
                        key={note.id}
                      >
                        <p className="mb-3 text-gray-700 text-sm">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-muted">
                            {note.author}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-primary-blue hover:text-primary-blue-dark"
                              type="button"
                            >
                              <EditIcon className="h-4 w-4" />
                            </button>
                            <button
                              className="text-red-500 hover:text-red-600"
                              type="button"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activities */}
                <div className="rounded-2xl border border-border-light bg-white p-6">
                  <h3 className="mb-4 font-bold text-gray-900 text-lg">
                    Последние действия
                  </h3>

                  <div className="space-y-4">
                    {candidate.activities.map((activity) => (
                      <div className="flex gap-3" key={activity.id}>
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-200">
                          <Image
                            alt={activity.userName}
                            className="h-full w-full object-cover"
                            height={32}
                            src={activity.userAvatar}
                            width={32}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium text-gray-900 text-sm">
                              {activity.userName}
                            </span>
                            <span className="flex items-center gap-1 text-text-muted text-xs">
                              {activity.timeAgo === "Только что" && (
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                              )}
                              {activity.timeAgo}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm">
                            {activity.action}{" "}
                            <span className="text-primary-blue">
                              {activity.targetName}
                            </span>{" "}
                            на "{activity.targetStatus}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Communication */}
                <div className="rounded-2xl border border-border-light bg-white p-6">
                  <h3 className="font-bold text-gray-900 text-lg">
                    Коммуникация
                  </h3>
                  <div className="mt-4 text-sm text-text-muted">
                    История коммуникации будет отображаться здесь
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
