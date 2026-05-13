import { createTRPCRouter } from "~/server/api/trpc";

import {
  assignCandidateProcedure,
  searchVacancyCandidatesProcedure,
} from "./assignments";
import {
  getHhVacancyDetailProcedure,
  getVacancyFunnelProcedure,
  getVacancyProcedure,
  // getVacancyPublicationProcedure,
  listVacancyPublicationsProcedure,
} from "./detail";
import { hasAnyVacanciesProcedure, listVacanciesProcedure } from "./list";
import {
  createVacancyProcedure,
  deleteVacancyPublicationProcedure,
  getHhConfigProcedure,
  getHhPublishLookupsProcedure,
  getTelegramConfigProcedure,
  publishHhProcedure,
  publishTelegramProcedure,
  updateVacancyProcedure,
} from "./mutations";

export const vacanciesRouter = createTRPCRouter({
  hasAny: hasAnyVacanciesProcedure,
  list: listVacanciesProcedure,
  get: getVacancyProcedure,
  getFunnel: getVacancyFunnelProcedure,
  listPublications: listVacancyPublicationsProcedure,
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
});
