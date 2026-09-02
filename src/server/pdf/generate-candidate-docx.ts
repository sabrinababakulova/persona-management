import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import {
  type CandidateProfileData,
  loadCandidateProfileData,
  PERSON_HUNTERS_OPTIONS,
  type ProfileRenderOptions,
  type ProfileSection,
} from "./candidate-profile-data";
import {
  hasRecruiterAssessment,
  type RecruiterAssessmentField,
} from "./candidate-profile-input";
import { PERSON_HUNTERS_LAYOUT } from "./person-hunters-layout";

const FONT = "Times New Roman";
const BODY_SIZE = PERSON_HUNTERS_LAYOUT.typography.bodyHalfPoints;
const FOOTER_GRAY = "8A918F";
const POSITIVE_GREEN = "548235";
const NEGATIVE_RED = "E00000";
const USABLE_WIDTH = PERSON_HUNTERS_LAYOUT.content.widthTwips;
const PHOTO_COLUMN_WIDTH = PERSON_HUNTERS_LAYOUT.photo.widthTwips;
const SUMMARY_COLUMN_WIDTH = USABLE_WIDTH - PHOTO_COLUMN_WIDTH;
const WORK_PERIOD_WIDTH = PERSON_HUNTERS_LAYOUT.work.periodWidthTwips;
const WORK_CONTENT_WIDTH = USABLE_WIDTH - WORK_PERIOD_WIDTH;
const DETAILS_LABEL_WIDTH = PERSON_HUNTERS_LAYOUT.details.labelWidthTwips;
const DETAILS_CONTENT_WIDTH = USABLE_WIDTH - DETAILS_LABEL_WIDTH;
const ASSESSMENT_TABLE_WIDTH = PERSON_HUNTERS_LAYOUT.assessment.tableWidthTwips;
const ASSESSMENT_LABEL_WIDTH = PERSON_HUNTERS_LAYOUT.assessment.labelWidthTwips;
const ASSESSMENT_VALUE_WIDTH = ASSESSMENT_TABLE_WIDTH - ASSESSMENT_LABEL_WIDTH;
const CUSTOM_LABEL_WIDTH = 1850;
const CUSTOM_CONTENT_WIDTH = USABLE_WIDTH - CUSTOM_LABEL_WIDTH;
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "4F4F4F" };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};
const CELL_BORDERS = {
  top: BORDER,
  bottom: BORDER,
  left: BORDER,
  right: BORDER,
};
const LOGO_WIDTH = PERSON_HUNTERS_LAYOUT.logo.widthPixels;
const LOGO_HEIGHT = PERSON_HUNTERS_LAYOUT.logo.heightPixels;

const LOGO_PATH = path.join(
  process.cwd(),
  "src/server/pdf/assets/person-hunters-logo.png",
);

const ASSESSMENT_ROWS: {
  key: RecruiterAssessmentField;
  label: string;
  color: string;
}[] = [
  { key: "willSucceed", label: "Справится", color: POSITIVE_GREEN },
  { key: "motivators", label: "Мотивирует", color: POSITIVE_GREEN },
  { key: "strengths", label: "Сильные стороны", color: POSITIVE_GREEN },
  { key: "willNotSucceed", label: "Не справится", color: NEGATIVE_RED },
  { key: "demotivators", label: "Демотивирует", color: NEGATIVE_RED },
  { key: "developmentAreas", label: "Зоны развития", color: NEGATIVE_RED },
];

function run(
  text: string,
  options?: { bold?: boolean; color?: string; size?: number },
) {
  return new TextRun({
    text,
    font: FONT,
    size: options?.size ?? BODY_SIZE,
    bold: options?.bold,
    color: options?.color,
  });
}

function paragraph(
  children: TextRun[],
  options?: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
    keepNext?: boolean;
  },
) {
  return new Paragraph({
    alignment: options?.alignment,
    keepNext: options?.keepNext,
    spacing: {
      before: options?.before ?? 0,
      after: options?.after ?? 40,
      line: 240,
    },
    children,
  });
}

function textParagraphs(
  text: string,
  options?: { bold?: boolean; color?: string; after?: number },
) {
  const lines = text.split(/\r?\n/);
  return lines.map((line, index) =>
    paragraph([run(line || " ", options)], {
      after: index === lines.length - 1 ? (options?.after ?? 40) : 0,
    }),
  );
}

function sectionHeading(text: string): Paragraph {
  return paragraph([run(text, { bold: true, size: 24 })], {
    alignment: AlignmentType.CENTER,
    before: 360,
    after: 120,
    keepNext: true,
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40, line: 240 },
    indent: { left: 360, hanging: 260 },
    bullet: { level: 0 },
    children: [run(text)],
  });
}

function summaryParagraph(label: string, value: string) {
  return paragraph([run(`${label}: `, { bold: true }), run(value)], {
    after: 20,
  });
}

function contactParagraph(type: string, value: string) {
  const normalizedType = type.toLowerCase();
  const hyperlink =
    normalizedType === "email"
      ? `mailto:${value}`
      : normalizedType === "phone"
        ? `tel:${value.replace(/[^+\d]/g, "")}`
        : normalizedType === "telegram"
          ? `https://t.me/${value.replace(/^@/, "")}`
          : null;

  if (!hyperlink) {
    return paragraph([run(value)], { after: 30 });
  }
  return new Paragraph({
    spacing: { after: 20, line: 240 },
    children: [
      new ExternalHyperlink({
        link: hyperlink,
        children: [
          new TextRun({
            text: value,
            font: FONT,
            size: BODY_SIZE,
            color: "1565C0",
            underline: {},
          }),
        ],
      }),
    ],
  });
}

function buildSummaryTable(data: CandidateProfileData): Table {
  const summaryChildren: Paragraph[] = [];
  if (data.city) {
    summaryChildren.push(summaryParagraph("Место проживания", data.city));
  }
  if (data.experience) {
    summaryChildren.push(summaryParagraph("Опыт работы", data.experience));
  }
  if (data.currentPosition) {
    summaryChildren.push(
      summaryParagraph("Специализация", data.currentPosition),
    );
  }
  if (data.contacts.length > 0) {
    summaryChildren.push(paragraph([run("Контакты:", { bold: true })]));
    summaryChildren.push(
      ...data.contacts.map((contact) =>
        contactParagraph(contact.type, contact.value),
      ),
    );
  }
  if (summaryChildren.length === 0) {
    summaryChildren.push(paragraph([run("Информация о кандидате не указана")]));
  }

  const photoChildren = [
    new Paragraph({ spacing: { before: 900, after: 900 }, children: [] }),
    paragraph([run("ФОТО", { bold: true, color: "808080", size: 24 })], {
      alignment: AlignmentType.CENTER,
      after: 0,
    }),
  ];

  return new Table({
    width: { size: USABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [SUMMARY_COLUMN_WIDTH, PHOTO_COLUMN_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: SUMMARY_COLUMN_WIDTH, type: WidthType.DXA },
            borders: NO_BORDERS,
            margins: { top: 40, bottom: 60, left: 0, right: 160 },
            children: summaryChildren,
          }),
          new TableCell({
            width: { size: PHOTO_COLUMN_WIDTH, type: WidthType.DXA },
            borders: CELL_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: photoChildren,
          }),
        ],
      }),
    ],
  });
}

function buildWorkExperienceTable(data: CandidateProfileData): Table {
  return new Table({
    width: { size: USABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [WORK_PERIOD_WIDTH, WORK_CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: data.workExperience.map(
      (job) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: WORK_PERIOD_WIDTH, type: WidthType.DXA },
              borders: NO_BORDERS,
              margins: { top: 20, bottom: 160, left: 0, right: 120 },
              verticalAlign: VerticalAlign.TOP,
              children: [paragraph([run(job.period, { bold: true })])],
            }),
            new TableCell({
              width: { size: WORK_CONTENT_WIDTH, type: WidthType.DXA },
              borders: NO_BORDERS,
              margins: { top: 20, bottom: 160, left: 0, right: 0 },
              verticalAlign: VerticalAlign.TOP,
              children: [
                paragraph([run(job.company, { bold: true })], { after: 40 }),
                ...(job.position
                  ? [
                      paragraph([run(job.position, { bold: true })], {
                        after: 70,
                      }),
                    ]
                  : []),
                ...job.description.map(bulletParagraph),
              ],
            }),
          ],
        }),
    ),
  });
}

function buildEducationTable(data: CandidateProfileData): Table {
  return new Table({
    width: { size: USABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [DETAILS_LABEL_WIDTH, DETAILS_CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: data.education.map(
      (item) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: DETAILS_LABEL_WIDTH, type: WidthType.DXA },
              borders: NO_BORDERS,
              margins: { top: 30, bottom: 70, left: 0, right: 160 },
              children: [paragraph([run(item.period)])],
            }),
            new TableCell({
              width: { size: DETAILS_CONTENT_WIDTH, type: WidthType.DXA },
              borders: NO_BORDERS,
              margins: { top: 30, bottom: 70, left: 0, right: 0 },
              children: [
                paragraph([run(item.institution)]),
                ...(item.gpa ? [paragraph([run(item.gpa)])] : []),
              ],
            }),
          ],
        }),
    ),
  });
}

function detailRow(label: string, values: string[]): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: DETAILS_LABEL_WIDTH, type: WidthType.DXA },
        borders: NO_BORDERS,
        margins: { top: 80, bottom: 80, left: 0, right: 160 },
        children: [paragraph([run(label, { bold: true })])],
      }),
      new TableCell({
        width: { size: DETAILS_CONTENT_WIDTH, type: WidthType.DXA },
        borders: NO_BORDERS,
        margins: { top: 80, bottom: 80, left: 0, right: 0 },
        children: values.map((value) => paragraph([run(value)], { after: 20 })),
      }),
    ],
  });
}

function buildAdditionalInfo(
  data: CandidateProfileData,
  options: ProfileRenderOptions,
): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];
  const rows: TableRow[] = [];
  if (options.includeAiAnalysis && data.aiAnalysis) {
    rows.push(detailRow("", data.aiAnalysis.split(/\r?\n/)));
  }
  if (data.skills.length > 0) {
    rows.push(detailRow("Навыки:", data.skills));
  }
  if (data.languages.length > 0) {
    rows.push(
      detailRow(
        "Знание языков:",
        data.languages.map(
          (language) => `${language.name} - ${language.level}`,
        ),
      ),
    );
  }
  if (rows.length > 0) {
    content.push(
      new Table({
        width: { size: USABLE_WIDTH, type: WidthType.DXA },
        columnWidths: [DETAILS_LABEL_WIDTH, DETAILS_CONTENT_WIDTH],
        layout: TableLayoutType.FIXED,
        borders: NO_BORDERS,
        rows,
      }),
    );
  }
  return content;
}

function buildAssessmentTable(options: ProfileRenderOptions): Table {
  return new Table({
    width: { size: ASSESSMENT_TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [ASSESSMENT_LABEL_WIDTH, ASSESSMENT_VALUE_WIDTH],
    layout: TableLayoutType.FIXED,
    rows: ASSESSMENT_ROWS.map(
      (row) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: ASSESSMENT_LABEL_WIDTH, type: WidthType.DXA },
              borders: CELL_BORDERS,
              margins: { top: 70, bottom: 70, left: 100, right: 100 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                paragraph([run(row.label, { bold: true, color: row.color })], {
                  after: 0,
                }),
              ],
            }),
            new TableCell({
              width: { size: ASSESSMENT_VALUE_WIDTH, type: WidthType.DXA },
              borders: CELL_BORDERS,
              margins: { top: 70, bottom: 70, left: 140, right: 140 },
              verticalAlign: VerticalAlign.CENTER,
              children: textParagraphs(
                options.recruiterAssessment?.[row.key] || "-",
                { after: 0 },
              ),
            }),
          ],
        }),
    ),
  });
}

function buildBrandedBody(
  data: CandidateProfileData,
  options: ProfileRenderOptions,
): (Paragraph | Table)[] {
  const body: (Paragraph | Table)[] = [buildSummaryTable(data)];
  const coverLetter = options.coverLetter?.trim();

  if (coverLetter) {
    body.push(
      paragraph([run("Сопроводительное письмо:", { bold: true })], {
        before: 180,
        after: 30,
        keepNext: true,
      }),
      ...textParagraphs(coverLetter, { after: 40 }),
    );
  }

  if (data.salaryExpectation) {
    body.push(
      paragraph(
        [
          run("Рассматриваем уровень заработной платы: ", { bold: true }),
          run(data.salaryExpectation),
        ],
        { before: 180, after: 20 },
      ),
    );
  }

  if (data.workExperience.length > 0) {
    body.push(sectionHeading("ОПЫТ РАБОТЫ"), buildWorkExperienceTable(data));
  }
  if (data.education.length > 0) {
    body.push(sectionHeading("ОБРАЗОВАНИЕ"), buildEducationTable(data));
  }

  const additionalInfo = buildAdditionalInfo(data, options);
  if (additionalInfo.length > 0) {
    body.push(sectionHeading("ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ"), ...additionalInfo);
  }

  if (hasRecruiterAssessment(options.recruiterAssessment)) {
    body.push(
      sectionHeading("ОЦЕНКА РЕКРУТЕРА"),
      paragraph(
        [
          run(
            "(заполняется рекрутером по итогам интервью или оценочных мероприятий)",
            { bold: true, color: "808080" },
          ),
        ],
        { alignment: AlignmentType.CENTER, after: 100, keepNext: true },
      ),
      buildAssessmentTable(options),
    );
  }

  return body;
}

function borderedLabelCell(text: string): TableCell {
  return new TableCell({
    width: { size: CUSTOM_LABEL_WIDTH, type: WidthType.DXA },
    borders: CELL_BORDERS,
    margins: { top: 70, bottom: 70, left: 90, right: 90 },
    children: [paragraph([run(text)], { after: 0 })],
  });
}

function borderedValueCell(value: string): TableCell {
  return new TableCell({
    width: { size: CUSTOM_CONTENT_WIDTH, type: WidthType.DXA },
    borders: CELL_BORDERS,
    margins: { top: 70, bottom: 70, left: 90, right: 90 },
    children: textParagraphs(value, { after: 0 }),
  });
}

function customInfoTable(label: string, value: string): Table {
  return new Table({
    width: { size: USABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [CUSTOM_LABEL_WIDTH, CUSTOM_CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [borderedLabelCell(label), borderedValueCell(value)],
      }),
    ],
  });
}

function customSectionBlocks(
  section: ProfileSection,
  data: CandidateProfileData,
): (Paragraph | Table)[] {
  switch (section) {
    case "experience":
      return data.experience ? [summaryParagraph("Стаж", data.experience)] : [];
    case "dateOfBirth":
      return data.dateOfBirth
        ? [summaryParagraph("Дата рождения", data.dateOfBirth)]
        : [];
    case "languages":
      return data.languages.map((language) =>
        paragraph([run(`${language.name} - ${language.level}`)]),
      );
    case "education":
      return data.education.length > 0
        ? [sectionHeading("ОБРАЗОВАНИЕ"), buildEducationTable(data)]
        : [];
    case "workExperience":
      return data.workExperience.length > 0
        ? [sectionHeading("ОПЫТ РАБОТЫ"), buildWorkExperienceTable(data)]
        : [];
    case "additionalInfo":
      return data.aiAnalysis
        ? [customInfoTable("Доп. информация", data.aiAnalysis)]
        : [];
    case "salary":
      return data.salaryExpectation
        ? [customInfoTable("Зарплатные ожидания", data.salaryExpectation)]
        : [];
    default:
      return [];
  }
}

function footerLink(url: string, underline = false): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 20 },
    children: [
      new ExternalHyperlink({
        link: url,
        children: [
          new TextRun({
            text: url,
            font: FONT,
            size: BODY_SIZE,
            color: FOOTER_GRAY,
            underline: underline ? {} : undefined,
          }),
        ],
      }),
    ],
  });
}

export async function buildCandidateDocx(
  data: CandidateProfileData,
  options: ProfileRenderOptions,
): Promise<Buffer> {
  const body: (Paragraph | Table)[] = [];

  if (!options.showBranding && options.logo) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 180 },
        children: [
          new ImageRun({
            type: options.logo.type === "png" ? "png" : "jpg",
            data: options.logo.data,
            transformation: {
              width: options.logo.width,
              height: options.logo.height,
            },
          }),
        ],
      }),
    );
  }

  body.push(
    paragraph(
      [
        run(
          options.showBranding ? data.fullName.toUpperCase() : data.fullName,
          {
            bold: options.showBranding,
            size: options.showBranding ? 28 : 26,
          },
        ),
      ],
      {
        alignment: AlignmentType.CENTER,
        before: options.showBranding ? 600 : 100,
        after: options.showBranding ? 360 : 240,
      },
    ),
  );

  if (options.showBranding) {
    body.push(...buildBrandedBody(data, options));
  } else {
    for (const section of options.sections) {
      body.push(...customSectionBlocks(section, data));
    }
  }

  const logo = options.showBranding ? await readFile(LOGO_PATH) : null;
  const header =
    options.showBranding && logo
      ? {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new ImageRun({
                    type: "png",
                    data: logo,
                    transformation: {
                      width: LOGO_WIDTH,
                      height: LOGO_HEIGHT,
                    },
                  }),
                ],
                spacing: { after: 0 },
              }),
            ],
          }),
        }
      : undefined;
  const footer = options.showBranding
    ? {
        default: new Footer({
          children: [
            footerLink("http://www.personhunters.com", true),
            footerLink("https://www.facebook.com/PersonHunters"),
          ],
        }),
      }
    : undefined;

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
          paragraph: { spacing: { line: 240 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PERSON_HUNTERS_LAYOUT.page.widthTwips,
              height: PERSON_HUNTERS_LAYOUT.page.heightTwips,
            },
            margin: {
              top: options.showBranding
                ? PERSON_HUNTERS_LAYOUT.margins.topTwips
                : 1100,
              bottom: options.showBranding
                ? PERSON_HUNTERS_LAYOUT.margins.bottomTwips
                : 1200,
              left: options.showBranding
                ? PERSON_HUNTERS_LAYOUT.margins.leftTwips
                : 1080,
              right: options.showBranding
                ? PERSON_HUNTERS_LAYOUT.margins.rightTwips
                : 1080,
              header: options.showBranding
                ? PERSON_HUNTERS_LAYOUT.margins.headerTwips
                : 400,
              footer: options.showBranding
                ? PERSON_HUNTERS_LAYOUT.margins.footerTwips
                : 360,
            },
          },
        },
        headers: header,
        footers: footer,
        children: body,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function generateCandidateDocx(input: {
  candidateId: string;
  companyId: string;
  options?: ProfileRenderOptions;
}): Promise<Buffer> {
  const data = await loadCandidateProfileData(input);
  return buildCandidateDocx(data, input.options ?? PERSON_HUNTERS_OPTIONS);
}
