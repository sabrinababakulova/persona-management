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

// DOCX references fonts by name from the viewer's machine. Word ships Times
// New Roman, so naming it reproduces the original template exactly without
// bundling or redistributing the (proprietary) font file.
const FONT = "Times New Roman";
const FOOTER_GRAY = "8C8C8C";
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const CELL_BORDERS = {
  top: BORDER,
  bottom: BORDER,
  left: BORDER,
  right: BORDER,
};
// Sampled aspect ratio of the committed logo PNG (613×187).
const LOGO_WIDTH = 150;
const LOGO_HEIGHT = 46;
const LEFT_COL_WIDTH = 1920; // twips (~96pt)
const RIGHT_COL_WIDTH = 7680;

const LOGO_PATH = path.join(
  process.cwd(),
  "src/server/pdf/assets/person-hunters-logo.png",
);

function heading(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function infoLine(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function labelCell(text: string): TableCell {
  return new TableCell({
    width: { size: LEFT_COL_WIDTH, type: WidthType.DXA },
    borders: CELL_BORDERS,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, size: 21 })] })],
  });
}

/** Right-hand cell whose paragraphs are supplied by the caller. */
function bodyCell(children: Paragraph[]): TableCell {
  return new TableCell({
    width: { size: RIGHT_COL_WIDTH, type: WidthType.DXA },
    borders: CELL_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children,
  });
}

function plainParagraph(text: string, opts?: { bold?: boolean }): Paragraph {
  return new Paragraph({
    spacing: { after: 20 },
    children: [new TextRun({ text, size: 21, bold: opts?.bold })],
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 20 },
    children: [new TextRun({ text: `• ${text}`, size: 21 })],
  });
}

function buildEducationTable(data: CandidateProfileData): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: data.education.map(
      (item) =>
        new TableRow({
          children: [
            labelCell(item.period),
            bodyCell([
              plainParagraph(item.institution),
              ...(item.gpa ? [plainParagraph(`GPA: ${item.gpa}`)] : []),
            ]),
          ],
        }),
    ),
  });
}

function buildExperienceTable(data: CandidateProfileData): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: data.workExperience.map(
      (job) =>
        new TableRow({
          children: [
            labelCell(job.period),
            bodyCell([
              plainParagraph(job.company, { bold: true }),
              ...(job.position ? [plainParagraph(job.position)] : []),
              ...job.description.map((line) => bulletParagraph(line)),
            ]),
          ],
        }),
    ),
  });
}

function buildBottomTable(
  data: CandidateProfileData,
  options: ProfileRenderOptions,
): Table | null {
  const has = (section: ProfileSection) => options.sections.includes(section);
  const rows: TableRow[] = [];
  if (has("additionalInfo") && data.additionalInfo) {
    rows.push(
      new TableRow({
        children: [
          labelCell("Additional information:"),
          bodyCell([plainParagraph(data.additionalInfo)]),
        ],
      }),
    );
  }
  if (has("salary") && data.salaryExpectation) {
    rows.push(
      new TableRow({
        children: [
          labelCell("Salary expectations:"),
          bodyCell([plainParagraph(data.salaryExpectation)]),
        ],
      }),
    );
  }
  if (rows.length === 0) {
    return null;
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

/** Single-row label/value table — used for ordered additionalInfo/salary blocks. */
function infoRowTable(label: string, value: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [labelCell(label), bodyCell([plainParagraph(value)])],
      }),
    ],
  });
}

/**
 * The block(s) for one section in the custom (ordered) layout. Returns an empty
 * array when the section has no data so it can be skipped.
 */
function sectionBlocksDocx(
  section: ProfileSection,
  data: CandidateProfileData,
): (Paragraph | Table)[] {
  switch (section) {
    case "experience":
      return data.experience
        ? [infoLine(`Experience: ${data.experience}`)]
        : [];
    case "dateOfBirth":
      return data.dateOfBirth
        ? [infoLine(`Date of birth: ${data.dateOfBirth}`)]
        : [];
    case "languages":
      return data.languages.length > 0
        ? data.languages.map((language) =>
            infoLine(`${language.name} — ${language.level}`),
          )
        : [];
    case "education":
      return data.education.length > 0
        ? [heading("Education"), buildEducationTable(data)]
        : [];
    case "workExperience":
      return data.workExperience.length > 0
        ? [heading("Experience:"), buildExperienceTable(data)]
        : [];
    case "additionalInfo":
      return data.additionalInfo
        ? [infoRowTable("Additional information:", data.additionalInfo)]
        : [];
    case "salary":
      return data.salaryExpectation
        ? [infoRowTable("Salary expectations:", data.salaryExpectation)]
        : [];
    default:
      return [];
  }
}

function footerLink(url: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new ExternalHyperlink({
        link: url,
        children: [new TextRun({ text: url, size: 18, color: FOOTER_GRAY })],
      }),
    ],
  });
}

/**
 * Builds a .docx that mirrors the Person Hunters resume template from already
 * loaded data. Pure (aside from reading the committed logo asset), so it can be
 * rendered in tests without a database. The logo and footer live in the Word
 * header/footer so they repeat on every page, matching the PDF export.
 */
export async function buildCandidateDocx(
  data: CandidateProfileData,
  options: ProfileRenderOptions,
): Promise<Buffer> {
  const body: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 240 },
      children: [new TextRun({ text: data.fullName, size: 26 })],
    }),
  ];

  if (options.showBranding) {
    // Fixed Person Hunters layout: grouped info block, then education/experience.
    if (data.experience) {
      body.push(infoLine(`Experience: ${data.experience}`));
    }
    if (data.dateOfBirth) {
      body.push(infoLine(`Date of birth: ${data.dateOfBirth}`));
    }
    if (data.languages.length > 0) {
      body.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
      for (const language of data.languages) {
        body.push(infoLine(`${language.name} — ${language.level}`));
      }
    }
    if (data.education.length > 0) {
      body.push(heading("Education"), buildEducationTable(data));
    }
    if (data.workExperience.length > 0) {
      body.push(heading("Experience:"), buildExperienceTable(data));
    }
    const bottomTable = buildBottomTable(data, options);
    if (bottomTable) {
      body.push(
        new Paragraph({ spacing: { after: 160 }, children: [] }),
        bottomTable,
      );
    }
  } else {
    // Custom layout: optional uploaded logo on top, then each selected section
    // in the user-chosen order.
    if (options.logo) {
      body.unshift(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 160 },
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
    for (const section of options.sections) {
      body.push(...sectionBlocksDocx(section, data));
    }
  }

  // Branding (logo header + links footer) repeats on every page; omitted for
  // the unbranded custom export.
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
                    transformation: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
                  }),
                ],
              }),
            ],
          }),
        }
      : undefined;
  const footer = options.showBranding
    ? {
        default: new Footer({
          children: [
            footerLink("http://www.personhunters.com"),
            footerLink("https://www.facebook.com/PersonHunters"),
          ],
        }),
      }
    : undefined;

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            // A larger top margin keeps the branded header logo clear of the
            // body; the unbranded custom export needs no such allowance.
            margin: {
              top: options.showBranding ? 1900 : 1100,
              bottom: 1200,
              left: 1080,
              right: 1080,
              header: 567,
              footer: 567,
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

/**
 * Loads a candidate (scoped to the caller's company) and renders it to a .docx
 * buffer. Generation is on-demand: nothing is persisted, so the document always
 * reflects the current DB row.
 *
 * @throws {CandidateNotFoundError} when the candidate is absent or belongs to
 * another company.
 */
export async function generateCandidateDocx(input: {
  candidateId: string;
  companyId: string;
  options?: ProfileRenderOptions;
}): Promise<Buffer> {
  const data = await loadCandidateProfileData(input);
  return buildCandidateDocx(data, input.options ?? PERSON_HUNTERS_OPTIONS);
}
