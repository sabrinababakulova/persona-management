import {
  fetchHhJson,
  formatExperienceMonths,
  formatWorkPeriod,
  HH_API_BASE_URL,
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
