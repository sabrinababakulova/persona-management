import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import {
  loadCandidateProfileData,
  PERSON_HUNTERS_OPTIONS,
  type ProfileRenderOptions,
} from "./candidate-profile-data";
import { CandidateProfileDocument } from "./candidate-profile-document";

/**
 * Loads a candidate (scoped to the caller's company) and renders the profile
 * template to a PDF buffer. Generation is on-demand: nothing is persisted, so
 * the PDF always reflects the current DB row. `options` selects branding and
 * which sections to include (defaults to the full Person Hunters export).
 *
 * @throws {CandidateNotFoundError} when the candidate is absent or belongs to
 * another company.
 */
export async function generateCandidatePdf(input: {
  candidateId: string;
  companyId: string;
  options?: ProfileRenderOptions;
}): Promise<Buffer> {
  const data = await loadCandidateProfileData(input);
  const options = input.options ?? PERSON_HUNTERS_OPTIONS;
  return renderToBuffer(
    <CandidateProfileDocument data={data} options={options} />,
  );
}
