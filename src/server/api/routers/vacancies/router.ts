import { createTRPCRouter } from "~/server/api/trpc";

import {
  assignCandidateProcedure,
  searchVacancyCandidatesProcedure,
} from "./assignments";
import {
  getHhVacancyDetailProcedure,
  getPublicationTelegramPostsProcedure,
  getVacancyFunnelProcedure,
  getVacancyProcedure,
  listVacancyPublicationsProcedure,
} from "./detail";
import { listVacanciesProcedure } from "./list";
import {
  createVacancyProcedure,
  deleteVacancyPublicationProcedure,
  getHhConfigProcedure,
  getHhPublishLookupsProcedure,
  getTelegramConfigProcedure,
  publishHhProcedure,
  publishTelegramProcedure,
  saveHhDraftProcedure,
  updateVacancyProcedure,
} from "./mutations";

export const vacanciesRouter = createTRPCRouter({
  list: listVacanciesProcedure,
  get: getVacancyProcedure,
  getFunnel: getVacancyFunnelProcedure,
  listPublications: listVacancyPublicationsProcedure,
  getPublicationTelegramPosts: getPublicationTelegramPostsProcedure,
  getHhDetail: getHhVacancyDetailProcedure,
  searchCandidates: searchVacancyCandidatesProcedure,
  assignCandidate: assignCandidateProcedure,
  create: createVacancyProcedure,
  update: updateVacancyProcedure,
  deletePublication: deleteVacancyPublicationProcedure,
  getTelegramConfig: getTelegramConfigProcedure,
  publishTelegram: publishTelegramProcedure,
  getHhConfig: getHhConfigProcedure,
  getHhPublishLookups: getHhPublishLookupsProcedure,
  publishHh: publishHhProcedure,
  saveHhDraft: saveHhDraftProcedure,
});
