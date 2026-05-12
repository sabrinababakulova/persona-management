import { createTRPCRouter } from "~/server/api/trpc";

import { addCandidateNoteProcedure, getCandidateProcedure } from "./detail";
import { listCandidatesProcedure, listHhCandidatesProcedure } from "./list";
import {
  createCandidateProcedure,
  updateCandidateProcedure,
  uploadResumeProcedure,
} from "./mutations";

/**
 * Candidate router exposed under `api.candidates`.
 *
 * All procedures are protected and company-scoped through their underlying
 * implementations.
 */
export const candidatesRouter = createTRPCRouter({
  list: listCandidatesProcedure,
  listHh: listHhCandidatesProcedure,
  get: getCandidateProcedure,
  addNote: addCandidateNoteProcedure,
  create: createCandidateProcedure,
  update: updateCandidateProcedure,
  uploadResume: uploadResumeProcedure,
});
