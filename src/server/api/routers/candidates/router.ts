import { createTRPCRouter } from "~/server/api/trpc";

import { addCandidateNoteProcedure, getCandidateProcedure } from "./detail";
import {
  hasAnyCandidatesProcedure,
  listCandidatesProcedure,
  listHhCandidatesProcedure,
} from "./list";
import {
  createCandidateProcedure,
  updateCandidateProcedure,
  uploadResumeProcedure,
} from "./mutations";

export const candidatesRouter = createTRPCRouter({
  hasAny: hasAnyCandidatesProcedure,
  list: listCandidatesProcedure,
  listHh: listHhCandidatesProcedure,
  get: getCandidateProcedure,
  addNote: addCandidateNoteProcedure,
  create: createCandidateProcedure,
  update: updateCandidateProcedure,
  uploadResume: uploadResumeProcedure,
});
