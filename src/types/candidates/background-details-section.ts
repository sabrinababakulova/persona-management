import type {
  EducationFormItem,
  Errors,
  WorkExperienceFormItem,
} from "~/types/candidates/components";

export interface BackgroundDetailsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  errors: Errors;
  workExperience: WorkExperienceFormItem[];
  education: EducationFormItem[];
  onAddWorkExperience: () => void;
  onRemoveWorkExperience: (id: string) => void;
  onWorkExperienceChange: (
    id: string,
    field: "company" | "position" | "period" | "description",
    value: string,
  ) => void;
  onAddEducation: () => void;
  onRemoveEducation: (id: string) => void;
  onEducationChange: (
    id: string,
    field: "institution" | "gpa" | "period",
    value: string,
  ) => void;
}
