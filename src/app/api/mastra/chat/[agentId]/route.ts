import { type ChatStreamHandlerParams, handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse, type UIMessage } from "ai";

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

  const body = (await request.json()) as Partial<
    ChatStreamHandlerParams<UIMessage>
  >;
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
    params: {
      ...body,
      messages: body.messages as UIMessage[],
    },
  });

  return createUIMessageStreamResponse({ stream });
}
