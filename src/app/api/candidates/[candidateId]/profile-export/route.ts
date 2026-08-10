import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  CandidateNotFoundError,
  type ProfileRenderOptions,
  parseSections,
  RESUME_DESIGN_TEMPLATES,
  type ResumeLogo,
} from "~/server/pdf/candidate-profile-data";
import { generateCandidateDocx } from "~/server/pdf/generate-candidate-docx";
import { generateCandidatePdf } from "~/server/pdf/generate-candidate-pdf";
import { fitWithin, getImageSize } from "~/server/pdf/image-size";
import { getCompanyFeatures } from "~/server/services/feature-flags";
import { getUserCompanyId } from "~/server/utils/get-user-company-id";
import { RESUME_DESIGN_PERSON_HUNTERS } from "~/shared/feature-flags";

// react-pdf and docx both render in Node, never the edge runtime.
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ candidateId: string }>;
};

const EXPORTS = {
  pdf: {
    contentType: "application/pdf",
    extension: "pdf",
    generate: generateCandidatePdf,
  },
  docx: {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
    generate: generateCandidateDocx,
  },
} as const;

type ExportFormat = keyof typeof EXPORTS;

// Uploaded custom logo: keep it small and constrain the rendered size.
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_WIDTH = 200;
const LOGO_MAX_HEIGHT = 64;

function toExportFormat(value: string | null): ExportFormat {
  return value === "docx" ? "docx" : "pdf";
}

function buildErrorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function buildContentDisposition(fileName: string, inline = false) {
  return `${inline ? "inline" : "attachment"}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Auth + company guard shared by GET and POST. Returns the company id or a Response. */
async function resolveCompany(): Promise<string | Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return buildErrorResponse("Не авторизован", 401);
  }
  const companyId = await getUserCompanyId(db, session.user.id);
  if (!companyId) {
    return buildErrorResponse("У вас не привязана компания", 412);
  }
  return companyId;
}

/** Decodes an uploaded logo file into a {@link ResumeLogo}, or returns an error Response. */
async function readLogo(file: File): Promise<ResumeLogo | Response> {
  if (file.size > MAX_LOGO_BYTES) {
    return buildErrorResponse("Логотип слишком большой. Максимум 2MB.", 413);
  }
  const mime = file.type.toLowerCase();
  const type: ResumeLogo["type"] | null =
    mime === "image/png"
      ? "png"
      : mime === "image/jpeg" || mime === "image/jpg"
        ? "jpeg"
        : null;
  if (!type) {
    return buildErrorResponse("Логотип должен быть PNG или JPEG.", 415);
  }

  const data = Buffer.from(await file.arrayBuffer());
  const intrinsic = getImageSize(data);
  if (!intrinsic) {
    return buildErrorResponse(
      "Не удалось прочитать изображение логотипа.",
      415,
    );
  }

  const { width, height } = fitWithin(
    intrinsic,
    LOGO_MAX_WIDTH,
    LOGO_MAX_HEIGHT,
  );
  return { data, type, width, height };
}

async function produce(input: {
  format: ExportFormat;
  options: ProfileRenderOptions;
  candidateId: string;
  companyId: string;
  /** `?disposition=inline` renders in the browser tab instead of downloading. */
  inline?: boolean;
}): Promise<Response> {
  const exportConfig = EXPORTS[input.format];
  try {
    const buffer = await exportConfig.generate({
      candidateId: input.candidateId,
      companyId: input.companyId,
      options: input.options,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": exportConfig.contentType,
        "Content-Disposition": buildContentDisposition(
          `profile-${input.candidateId}.${exportConfig.extension}`,
          input.inline === true && input.format === "pdf",
        ),
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof CandidateNotFoundError) {
      return buildErrorResponse("Кандидат не найден", 404);
    }
    console.error(`Failed to generate candidate ${input.format} export`, error);
    return buildErrorResponse("Не удалось сформировать файл", 500);
  }
}

/**
 * PDF/DOCX export. Branded design templates (flag-gated per company), or
 * custom (section-selectable, unbranded — available to everyone).
 */
export async function GET(request: Request, context: RouteContext) {
  const companyId = await resolveCompany();
  if (companyId instanceof Response) {
    return companyId;
  }

  const searchParams = new URL(request.url).searchParams;
  let options: ProfileRenderOptions;

  if (searchParams.get("template") === "custom") {
    options = {
      showBranding: false,
      sections: parseSections(searchParams.get("sections")),
    };
  } else {
    // Absent param keeps meaning the Person Hunters design for older links.
    const designKey =
      searchParams.get("template") ?? RESUME_DESIGN_PERSON_HUNTERS;
    const template = RESUME_DESIGN_TEMPLATES[designKey];
    if (!template) {
      return buildErrorResponse("Шаблон резюме не найден", 404);
    }

    const features = await getCompanyFeatures(db, companyId);
    if (!features.resumeDesigns.includes(designKey)) {
      return buildErrorResponse(
        "Этот шаблон резюме недоступен для вашей компании",
        403,
      );
    }
    options = template;
  }

  const { candidateId } = await context.params;
  return produce({
    format: toExportFormat(searchParams.get("format")),
    options,
    candidateId,
    companyId,
    inline: searchParams.get("disposition") === "inline",
  });
}

/**
 * Custom export carrying an optional uploaded logo (multipart form). Fields:
 * `format`, `sections` (csv, ordered), and `logo` (PNG/JPEG file).
 */
export async function POST(request: Request, context: RouteContext) {
  const companyId = await resolveCompany();
  if (companyId instanceof Response) {
    return companyId;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return buildErrorResponse("Некорректный multipart-запрос", 400);
  }

  const sections = parseSections(formData.get("sections")?.toString() ?? "");

  let logo: ResumeLogo | undefined;
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const result = await readLogo(logoFile);
    if (result instanceof Response) {
      return result;
    }
    logo = result;
  }

  const { candidateId } = await context.params;
  return produce({
    format: toExportFormat(formData.get("format")?.toString() ?? null),
    options: { showBranding: false, sections, logo },
    candidateId,
    companyId,
  });
}
