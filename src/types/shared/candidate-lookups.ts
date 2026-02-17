export type LookupOption = { value: string; label: string };

export type CandidateLookups = {
  contactTypes: LookupOption[];
  sources: LookupOption[];
  positions: LookupOption[];
  skills: LookupOption[];
  languages: LookupOption[];
  languageLevels: LookupOption[];
  statusOptions: LookupOption[];
};
