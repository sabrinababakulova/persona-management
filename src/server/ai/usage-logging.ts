import { aiUsageLogs } from "~/server/db/schema";

type Database = typeof import("~/server/db").db;

type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
};

type AiUsageCost = {
  inputRateUsdPerMillion: string;
  outputRateUsdPerMillion: string;
  inputCostUsd: string;
  outputCostUsd: string;
  totalCostUsd: string;
};

export type AiUsageLogInput = {
  db: Database;
  userId?: string | null;
  companyId?: string | null;
  candidateId?: string | null;
  model: string;
  agent: string;
  operation: string;
  status: "success" | "failed";
  usage: unknown;
  errorMessage?: string | null;
};

const COST_DECIMAL_PLACES = 8;
const RATE_DECIMAL_PLACES = 6;
const GEMINI_2_5_FLASH_INPUT_RATE_USD_PER_MILLION = 0.3;
const GEMINI_2_5_FLASH_OUTPUT_RATE_USD_PER_MILLION = 2.5;
const TOKENS_PER_MILLION = 1_000_000;

function toTokenCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "bigint" && value > 0n) {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return 0;
}

function toDecimalString(value: number, decimalPlaces: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }

  return value.toFixed(decimalPlaces);
}

function getPricingForModel(model: string) {
  const normalizedModel = model.toLowerCase();

  if (normalizedModel.includes("gemini-2.5-flash")) {
    return {
      inputRateUsdPerMillion: GEMINI_2_5_FLASH_INPUT_RATE_USD_PER_MILLION,
      outputRateUsdPerMillion: GEMINI_2_5_FLASH_OUTPUT_RATE_USD_PER_MILLION,
    };
  }

  return {
    inputRateUsdPerMillion: 0,
    outputRateUsdPerMillion: 0,
  };
}

export function calculateAiUsageCost(
  model: string,
  usage: TokenUsage,
): AiUsageCost {
  const { inputRateUsdPerMillion, outputRateUsdPerMillion } =
    getPricingForModel(model);
  const billableOutputTokens = usage.outputTokens + usage.reasoningTokens;
  const inputCostUsd =
    (usage.inputTokens / TOKENS_PER_MILLION) * inputRateUsdPerMillion;
  const outputCostUsd =
    (billableOutputTokens / TOKENS_PER_MILLION) * outputRateUsdPerMillion;
  const totalCostUsd = inputCostUsd + outputCostUsd;

  return {
    inputRateUsdPerMillion: toDecimalString(
      inputRateUsdPerMillion,
      RATE_DECIMAL_PLACES,
    ),
    outputRateUsdPerMillion: toDecimalString(
      outputRateUsdPerMillion,
      RATE_DECIMAL_PLACES,
    ),
    inputCostUsd: toDecimalString(inputCostUsd, COST_DECIMAL_PLACES),
    outputCostUsd: toDecimalString(outputCostUsd, COST_DECIMAL_PLACES),
    totalCostUsd: toDecimalString(totalCostUsd, COST_DECIMAL_PLACES),
  };
}

export function normalizeAiUsage(usage: unknown): TokenUsage {
  const raw =
    usage && typeof usage === "object"
      ? (usage as Record<string, unknown>)
      : {};

  const inputTokens =
    toTokenCount(raw.inputTokens) ||
    toTokenCount(raw.promptTokens) ||
    toTokenCount(raw.promptTokenCount);
  const outputTokens =
    toTokenCount(raw.outputTokens) ||
    toTokenCount(raw.completionTokens) ||
    toTokenCount(raw.candidatesTokenCount);
  const reasoningTokens =
    toTokenCount(raw.reasoningTokens) || toTokenCount(raw.thoughtsTokenCount);
  const cachedInputTokens =
    toTokenCount(raw.cachedInputTokens) ||
    toTokenCount(raw.cachedContentTokenCount);
  const totalTokens =
    toTokenCount(raw.totalTokens) ||
    toTokenCount(raw.totalTokenCount) ||
    inputTokens + outputTokens + reasoningTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    reasoningTokens,
    cachedInputTokens,
  };
}

export async function recordAiUsage({
  db,
  userId,
  companyId,
  candidateId,
  model,
  agent,
  operation,
  status,
  usage,
  errorMessage,
}: AiUsageLogInput) {
  const normalizedUsage = normalizeAiUsage(usage);
  const usageCost = calculateAiUsageCost(model, normalizedUsage);

  try {
    await db.insert(aiUsageLogs).values({
      userId: userId ?? null,
      companyId: companyId ?? null,
      candidateId: candidateId ?? null,
      model,
      agent,
      operation,
      status,
      inputTokens: normalizedUsage.inputTokens,
      outputTokens: normalizedUsage.outputTokens,
      totalTokens: normalizedUsage.totalTokens,
      reasoningTokens: normalizedUsage.reasoningTokens,
      cachedInputTokens: normalizedUsage.cachedInputTokens,
      inputRateUsdPerMillion: usageCost.inputRateUsdPerMillion,
      outputRateUsdPerMillion: usageCost.outputRateUsdPerMillion,
      inputCostUsd: usageCost.inputCostUsd,
      outputCostUsd: usageCost.outputCostUsd,
      totalCostUsd: usageCost.totalCostUsd,
      errorMessage: errorMessage?.trim() || null,
    });
  } catch (error) {
    console.error("Failed to record AI token usage", error);
  }
}
