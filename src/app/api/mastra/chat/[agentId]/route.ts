import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";

import { mastra } from "~/mastra";
import { auth } from "~/server/auth";

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "GOOGLE_GENERATIVE_AI_API_KEY не задан в переменных окружения",
      },
      { status: 500 },
    );
  }

  const body = (await request.json()) as Record<string, unknown>;
  if (!Array.isArray(body.messages)) {
    return Response.json(
      { error: "Некорректный запрос: требуется массив messages" },
      { status: 400 },
    );
  }

  const { agentId } = await context.params;
  const stream = await handleChatStream({
    mastra,
    agentId,
    // @ts-expect-error - @mastra/ai-sdk@1.1.3 bundles ai v5 types, incompatible with ai v6 provider types. Safe at runtime.
    params: body,
  });

  // @ts-expect-error - same ai v5/v6 type mismatch, stream data is compatible at runtime
  return createUIMessageStreamResponse({ stream });
}
