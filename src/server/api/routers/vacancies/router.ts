import { createTRPCRouter } from "~/server/api/trpc";

import {
  assignCandidateProcedure,
  searchVacancyCandidatesProcedure,
} from "./assignments";
import {
  getVacancyFunnelProcedure,
  getVacancyProcedure,
  getVacancyPublicationProcedure,
  listVacancyPublicationsProcedure,
} from "./detail";
import { hasAnyVacanciesProcedure, listVacanciesProcedure } from "./list";
import {
  createVacancyProcedure,
  createVacancyPublicationProcedure,
  deleteVacancyPublicationProcedure,
  getTelegramConfigProcedure,
  publishTelegramProcedure,
  updateVacancyProcedure,
  updateVacancyPublicationProcedure,
} from "./mutations";

export const vacanciesRouter = createTRPCRouter({
  hasAny: hasAnyVacanciesProcedure,
  list: listVacanciesProcedure,
  get: getVacancyProcedure,
  getFunnel: getVacancyFunnelProcedure,
  listPublications: listVacancyPublicationsProcedure,
  getPublication: getVacancyPublicationProcedure,
  searchCandidates: searchVacancyCandidatesProcedure,
  assignCandidate: assignCandidateProcedure,
  create: createVacancyProcedure,
  update: updateVacancyProcedure,
  createPublication: createVacancyPublicationProcedure,
  updatePublication: updateVacancyPublicationProcedure,
  deletePublication: deleteVacancyPublicationProcedure,
  getTelegramConfig: getTelegramConfigProcedure,
  publishTelegram: publishTelegramProcedure,
});
