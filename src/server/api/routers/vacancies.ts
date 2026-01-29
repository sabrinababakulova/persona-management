import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Types for vacancy data
const _vacancySchema = z.object({
  id: z.string(),
  title: z.string(),
  level: z.string(),
  status: z.enum(["active", "draft", "paused", "closed", "archive"]),
  city: z.string(),
  responses: z.number(),
  workType: z.string(),
  selected: z.boolean().optional(),
});

export const vacanciesRouter = createTRPCRouter({
  getAllVacancies: publicProcedure.query(async () => {
    // Mock data for vacancies
    const vacancies = [
      {
        id: "1",
        title: "Frontend Developer",
        level: "Senior",
        status: "active" as const,
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "2",
        title: "UX Researcher",
        level: "Senior",
        status: "active" as const,
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "3",
        title: "Technical Writer",
        level: "Junior",
        status: "active" as const,
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "4",
        title: "Backend Engineer",
        level: "Junior",
        status: "draft" as const,
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "5",
        title: "Data Scientist",
        level: "Lead",
        status: "paused" as const,
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "6",
        title: "Project Manager",
        level: "Senior",
        status: "closed" as const,
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "7",
        title: "Product Manager",
        level: "Middle",
        status: "archive" as const,
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "8",
        title: "Software Engineer",
        level: "Junior",
        status: "archive" as const,
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "9",
        title: "Mobile Developer",
        level: "Middle",
        status: "archive" as const,
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "10",
        title: "Data Analyst",
        level: "Lead",
        status: "archive" as const,
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
    ];

    return vacancies;
  }),

  searchVacancies: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const allVacancies = [
        {
          id: "1",
          title: "Frontend Developer",
          level: "Senior",
          status: "active" as const,
          city: "Ташкент",
          responses: 24,
          workType: "Гибрид",
        },
        {
          id: "2",
          title: "UX Researcher",
          level: "Senior",
          status: "active" as const,
          city: "Ташкент",
          responses: 24,
          workType: "Гибрид",
        },
        {
          id: "3",
          title: "Technical Writer",
          level: "Junior",
          status: "active" as const,
          city: "Ташкент",
          responses: 24,
          workType: "Гибрид",
        },
        {
          id: "4",
          title: "Backend Engineer",
          level: "Junior",
          status: "draft" as const,
          city: "Ташкент",
          responses: 24,
          workType: "Гибрид",
        },
        {
          id: "5",
          title: "Data Scientist",
          level: "Lead",
          status: "paused" as const,
          city: "Ташкент",
          responses: 24,
          workType: "Гибрид",
        },
        {
          id: "6",
          title: "Project Manager",
          level: "Senior",
          status: "closed" as const,
          city: "Ташкент",
          responses: 24,
          workType: "Гибрид",
        },
        {
          id: "7",
          title: "Product Manager",
          level: "Middle",
          status: "archive" as const,
          city: "Ташкент",
          responses: 24,
          workType: "Гибрид",
        },
        {
          id: "8",
          title: "Software Engineer",
          level: "Junior",
          status: "archive" as const,
          city: "Ташкент",
          responses: 24,
          workType: "Гибрид",
        },
        {
          id: "9",
          title: "Mobile Developer",
          level: "Middle",
          status: "archive" as const,
          city: "Ташкент",
          responses: 24,
          workType: "Гибрид",
        },
        {
          id: "10",
          title: "Data Analyst",
          level: "Lead",
          status: "archive" as const,
          city: "Ташкент",
          responses: 24,
          workType: "Гибрид",
        },
      ];

      const filteredVacancies = allVacancies.filter((vacancy) =>
        vacancy.title.toLowerCase().includes(input.query.toLowerCase()),
      );

      return filteredVacancies;
    }),
});
