import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { z } from "zod";

import { mastra } from "~/mastra";
import { auth } from "~/server/auth";
import { takeRateLimitSlot } from "~/server/auth/rate-limit";
import {
  RequestBodyTooLargeError,
  readJsonBodyLimited,
} from "~/server/http/read-json-body";

/**
 * Agents reachable through this endpoint.
 *
 * The registry also holds the résumé analyzer, classifier, summary and match agents. Those are
 * pipeline components driven by the server with data the caller has already been authorized
 * for — they are not conversational, and letting the URL name any of them turned an internal
 * registry into a public menu. Only the HR assistant is a chat surface.
 */
const CHAT_AGENT_IDS = new Set(["hrAssistant"]);

const MAX_REQUEST_BYTES = 256 * 1024;
const CHAT_RATE_LIMIT_MAX_REQUESTS = 30;
const CHAT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Only the conversation itself is forwarded.
 *
 * The whole parsed body used to be handed to `handleChatStream` as its params, so any
 * generation option the runtime honours — system prompt, tools, model settings — was
 * caller-controlled.
 */
const chatRequestSchema = z.object({
  id: z.string().max(255).optional(),
  messages: z.array(z.unknown()).min(1).max(200),
  trigger: z.string().max(64).optional(),
  messageId: z.string().max(255).optional(),
});

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { agentId } = await context.params;
  if (!CHAT_AGENT_IDS.has(agentId)) {
    return Response.json({ error: "Агент не найден" }, { status: 404 });
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

  // Every request here costs model tokens, so it is metered per account.
  const allowed = await takeRateLimitSlot(
    `mastra-chat:${session.user.id}`,
    CHAT_RATE_LIMIT_MAX_REQUESTS,
    CHAT_RATE_LIMIT_WINDOW_MS,
  );
  if (!allowed) {
    return Response.json(
      { error: "Слишком много запросов. Попробуйте позже." },
      { status: 429 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await readJsonBodyLimited(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        { error: "Запрос слишком большой" },
        { status: 413 },
      );
    }
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Некорректный запрос: требуется массив messages" },
      { status: 400 },
    );
  }

  const stream = await handleChatStream({
    mastra,
    agentId,
    // @ts-expect-error - @mastra/ai-sdk@1.1.3 bundles ai v5 types, incompatible with ai v6 provider types. Safe at runtime.
    params: parsed.data,
  });

  // @ts-expect-error - same ai v5/v6 type mismatch, stream data is compatible at runtime
  return createUIMessageStreamResponse({ stream });
}
