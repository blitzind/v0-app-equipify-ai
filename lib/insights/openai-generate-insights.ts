import "server-only"

import { z } from "zod"
import type { OrgInsightsContext } from "@/lib/insights/gather-org-context"
import { runAiTask } from "@/lib/ai/server"
import { aiDebugLog } from "@/lib/ai/ai-debug"
import { applyUserPromptTemplate, getPromptForTask } from "@/lib/ai/prompts"

export class InsightsConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InsightsConfigError"
  }
}

export type AiGeneratedInsightItem = {
  title: string
  category: "revenue" | "operations" | "maintenance" | "warranty" | "customer" | "technician"
  severity: "low" | "medium" | "high"
  insight: string
  recommendedAction: string
  relatedMetric?: string
}

export type AiInsightsPayload = {
  summary: string
  insights: AiGeneratedInsightItem[]
}

const ALLOWED_CATEGORIES = new Set<AiGeneratedInsightItem["category"]>([
  "revenue",
  "operations",
  "maintenance",
  "warranty",
  "customer",
  "technician",
])

const ALLOWED_SEVERITY = new Set<AiGeneratedInsightItem["severity"]>(["low", "medium", "high"])

function sanitizePayload(raw: unknown): AiInsightsPayload {
  if (!raw || typeof raw !== "object") {
    return { summary: "", insights: [] }
  }
  const o = raw as Record<string, unknown>
  const summary = typeof o.summary === "string" ? o.summary.trim() : ""
  const rawInsights = Array.isArray(o.insights) ? o.insights : []
  const insights: AiGeneratedInsightItem[] = []
  for (const item of rawInsights) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const title = typeof row.title === "string" ? row.title.trim() : ""
    const insight = typeof row.insight === "string" ? row.insight.trim() : ""
    const recommendedAction =
      typeof row.recommendedAction === "string" ? row.recommendedAction.trim() : ""
    const cat = row.category
    const sev = row.severity
    if (
      !title ||
      !insight ||
      !recommendedAction ||
      typeof cat !== "string" ||
      !ALLOWED_CATEGORIES.has(cat as AiGeneratedInsightItem["category"]) ||
      typeof sev !== "string" ||
      !ALLOWED_SEVERITY.has(sev as AiGeneratedInsightItem["severity"])
    ) {
      continue
    }
    const relatedMetric =
      typeof row.relatedMetric === "string" && row.relatedMetric.trim()
        ? row.relatedMetric.trim()
        : undefined
    insights.push({
      title,
      category: cat as AiGeneratedInsightItem["category"],
      severity: sev as AiGeneratedInsightItem["severity"],
      insight,
      recommendedAction,
      relatedMetric,
    })
  }
  return { summary, insights: insights.slice(0, 12) }
}

const categorySchema = z.enum([
  "revenue",
  "operations",
  "maintenance",
  "warranty",
  "customer",
  "technician",
])

const severitySchema = z.enum(["low", "medium", "high"])

const insightItemSchema = z.object({
  title: z.string(),
  category: categorySchema,
  severity: severitySchema,
  insight: z.string(),
  recommendedAction: z.string(),
  relatedMetric: z.string().optional(),
})

/** Zod shape for router validation; output is normalized via {@link sanitizePayload}. */
const insightsGenerationRawSchema = z
  .object({
    summary: z.string(),
    insights: z.array(insightItemSchema),
  })
  .transform((d) => sanitizePayload(d))

export async function generateOperationalInsightsWithOpenAI(
  context: OrgInsightsContext,
  organizationId: string,
): Promise<AiInsightsPayload> {
  const prompt = getPromptForTask("insights_generation")
  const userContent = JSON.stringify(context, null, 2)
  const user = applyUserPromptTemplate(prompt.userPromptTemplate, { contextJson: userContent })

  const envModel = process.env.OPENAI_INSIGHTS_MODEL?.trim()
  const taskOverrides =
    envModel != null && envModel.length > 0
      ? { primaryModel: { provider: "openai" as const, model: envModel } }
      : undefined

  const result = await runAiTask({
    task: "insights_generation",
    organizationId,
    input: {
      system: prompt.systemPrompt,
      user,
    },
    schema: insightsGenerationRawSchema,
    taskOverrides,
    cacheSchemaVersion: prompt.schemaVersion,
  })

  if (!result.ok) {
    const msg = result.error.message
    aiDebugLog("insights_generation_failed", {
      organizationId,
      message: msg.slice(0, 500),
      escalationReasons: result.meta.escalationReasons,
      promptId: prompt.promptId,
      promptVersion: prompt.version,
    })
    if (msg.includes("No AI provider is configured")) {
      throw new InsightsConfigError(
        "AI insights are not configured. Add OPENAI_API_KEY (and optional ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY) and AI_ENABLED_PROVIDERS.",
      )
    }
    throw result.error
  }

  aiDebugLog("insights_generation_ok", {
    organizationId,
    model: result.meta.model,
    provider: result.meta.provider,
    escalated: result.meta.escalated,
    attempts: result.meta.attempts,
    promptId: prompt.promptId,
    promptVersion: prompt.version,
  })

  return result.output
}
