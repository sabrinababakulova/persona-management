import { createTRPCRouter } from "~/server/api/trpc";

import { addCandidateNoteProcedure, getCandidateProcedure } from "./detail";
import { listCandidatesProcedure } from "./list";
import {
  createCandidateMeetingProcedure,
  listCandidateMeetingsProcedure,
  listMyMeetingsProcedure,
  searchMeetingCandidatesProcedure,
} from "./meetings";
import {
  createCandidateProcedure,
  deleteCandidateProcedure,
  updateCandidateProcedure,
  uploadResumeProcedure,
} from "./mutations";
import { hhSyncStatusProcedure, syncHhCandidatesProcedure } from "./sync";

/**
 * Candidate router exposed under `api.candidates`.
 *
 * All procedures are protected and company-scoped through their underlying
 * implementations.
 */
export const candidatesRouter = createTRPCRouter({
  list: listCandidatesProcedure,
  get: getCandidateProcedure,
  addNote: addCandidateNoteProcedure,
  listMeetings: listCandidateMeetingsProcedure,
  listMyMeetings: listMyMeetingsProcedure,
  searchMeetingCandidates: searchMeetingCandidatesProcedure,
  createMeeting: createCandidateMeetingProcedure,
  create: createCandidateProcedure,
  delete: deleteCandidateProcedure,
  update: updateCandidateProcedure,
  uploadResume: uploadResumeProcedure,
  syncHh: syncHhCandidatesProcedure,
  hhSyncStatus: hhSyncStatusProcedure,
});
