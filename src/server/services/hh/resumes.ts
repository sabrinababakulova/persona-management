import {
  fetchHhJson,
  formatExperienceMonths,
  formatWorkPeriod,
  HH_API_BASE_URL,
  HhApiError,
  type HhResumeCandidate,
  type HhResumeResponse,
} from "./shared";

export async function fetchHhResumeById(
  resumeId: string,
  accessToken: string,
): Promise<HhResumeCandidate> {
  const searchParams = new URLSearchParams({ host: "hh.uz" });

  const resume = await fetchHhJson<HhResumeResponse>(
    `${HH_API_BASE_URL}/resumes/${resumeId}?${searchParams}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  const nameParts = [
    resume.last_name?.trim(),
    resume.first_name?.trim(),
    resume.middle_name?.trim(),
  ].filter(Boolean);
  const fullName =
    nameParts.length > 0
      ? nameParts.join(" ")
      : resume.title?.trim() || "Неизвестный кандидат";

  const city = resume.area?.name?.trim() || "";
  const experience = formatExperienceMonths(resume.total_experience?.months);

  const salaryExpectation = resume.salary?.amount ?? 0;
  const salaryCurrency: "UZS" | "USD" =
    resume.salary?.currency === "USD" ? "USD" : "UZS";

  const currentPosition = resume.title?.trim() || "";
  const skills = (resume.skill_set ?? []).filter(Boolean) as string[];

  const languages = (resume.languages ?? [])
    .map((lang) => ({
      name: lang.name?.trim() || "",
      level: lang.level?.name?.trim() || "",
    }))
    .filter((language) => language.name);

  let phone = "";
  let email = "";
  for (const contact of resume.contact ?? []) {
    const typeId = contact.type?.id;
    if ((typeId === "cell" || typeId === "home") && !phone) {
      phone =
        typeof contact.value === "string"
          ? contact.value
          : (contact.value?.formatted ?? "");
    } else if (typeId === "email" && !email) {
      email =
        typeof contact.value === "string"
          ? contact.value
          : (contact.value?.formatted ?? "");
    }
  }

  const workExperience = (resume.experience ?? []).map((experienceItem) => ({
    company: experienceItem.company?.trim() || "",
    position: experienceItem.position?.trim() || "",
    period: formatWorkPeriod(experienceItem.start, experienceItem.end),
    description: (experienceItem.description ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  }));

  const education = (resume.education?.primary ?? []).map((educationItem) => ({
    institution:
      educationItem.name?.trim() || educationItem.organization?.trim() || "",
    gpa: educationItem.result?.trim() || "",
    period: educationItem.year ? String(educationItem.year) : "",
  }));

  return {
    id: resume.id ?? resumeId,
    fullName,
    city,
    experience,
    salaryExpectation,
    salaryCurrency,
    currentPosition,
    skills,
    languages,
    contacts: { phone, email, telegram: "" },
    workExperience,
    education,
    resumeUrl: resume.alternate_url?.trim() || "",
  };
}

export type HhResumePdf = {
  /** PDF bytes streamed straight from hh.uz — never buffered to our storage. */
  body: ReadableStream<Uint8Array>;
  contentType: string;
  fileName: string;
};

/** Builds a human-friendly `<name>.pdf` filename for the downloaded resume. */
function deriveResumeFileName(
  pdfUrl: string,
  resume: HhResumeResponse,
): string {
  try {
    const lastSegment = decodeURIComponent(
      new URL(pdfUrl).pathname.split("/").pop() ?? "",
    );
    if (lastSegment.toLowerCase().endsWith(".pdf")) {
      return lastSegment;
    }
  } catch {
    // Fall through to a name built from the resume fields below.
  }

  const nameParts = [resume.last_name, resume.first_name, resume.middle_name]
    .map((part) => part?.trim())
    .filter(Boolean);
  const base =
    nameParts.length > 0
      ? nameParts.join(" ")
      : resume.title?.trim() || "resume";

  return `${base}.pdf`;
}

/**
 * Streams a candidate's resume PDF from hh.uz using the official API download
 * link, authorized by the connected employer's Bearer token.
 *
 * The `/resumes/{id}` response exposes a `download.pdf.url` (an
 * `api_resume_converter` link) that returns the file body when fetched with the
 * same token. We pipe that stream straight to the caller — nothing is persisted
 * to our own storage. Throws `HhApiError` for hh.uz failures: `403` (account
 * lacks the service to download the resume), `404` (resume unavailable to the
 * account), `429` (daily resume-view limit exceeded).
 */
export async function fetchHhResumePdf(
  resumeId: string,
  accessToken: string,
): Promise<HhResumePdf> {
  const searchParams = new URLSearchParams({ host: "hh.uz" });

  const resume = await fetchHhJson<HhResumeResponse>(
    `${HH_API_BASE_URL}/resumes/${resumeId}?${searchParams}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  const pdfUrl = resume.download?.pdf?.url?.trim();
  if (!pdfUrl) {
    throw new Error("HH resume has no PDF download link");
  }

  const response = await fetch(pdfUrl, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new HhApiError(response.status, body);
  }

  return {
    body: response.body,
    contentType: response.headers.get("content-type") ?? "application/pdf",
    fileName: deriveResumeFileName(pdfUrl, resume),
  };
}
