import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  CandidateNotFoundError,
  PERSON_HUNTERS_OPTIONS,
  type ProfileRenderOptions,
  parseSections,
} from "~/server/pdf/candidate-profile-data";
import { generateCandidateDocx } from "~/server/pdf/generate-candidate-docx";
import { generateCandidatePdf } from "~/server/pdf/generate-candidate-pdf";
import { getUserCompanyId } from "~/server/utils/get-user-company-id";

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

function isExportFormat(value: string | null): value is ExportFormat {
  return value === "pdf" || value === "docx";
}

function buildErrorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function buildContentDisposition(fileName: string) {
  return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return buildErrorResponse("Не авторизован", 401);
  }

  const companyId = await getUserCompanyId(db, session.user.id);
  if (!companyId) {
    return buildErrorResponse("У вас не привязана компания", 412);
  }

  const searchParams = new URL(request.url).searchParams;
  const formatParam = searchParams.get("format");
  // Default to PDF so an unparameterised call still works.
  const format: ExportFormat = isExportFormat(formatParam)
    ? formatParam
    : "pdf";
  const exportConfig = EXPORTS[format];

  // template=custom is the unbranded, section-selectable export; anything else
  // is the fixed Person Hunters template (all sections, branded).
  const options: ProfileRenderOptions =
    searchParams.get("template") === "custom"
      ? {
          showBranding: false,
          sections: parseSections(searchParams.get("sections")),
        }
      : PERSON_HUNTERS_OPTIONS;

  const { candidateId } = await context.params;

  try {
    const buffer = await exportConfig.generate({
      candidateId,
      companyId,
      options,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": exportConfig.contentType,
        "Content-Disposition": buildContentDisposition(
          `profile-${candidateId}.${exportConfig.extension}`,
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

    console.error(`Failed to generate candidate ${format} export`, error);
    return buildErrorResponse("Не удалось сформировать файл", 500);
  }
}
