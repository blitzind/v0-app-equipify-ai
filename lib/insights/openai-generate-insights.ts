import "server-only"

import OpenAI from "openai"
import type { OrgInsightsContext } from "@/lib/insights/gather-org-context"

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

export async function generateOperationalInsightsWithOpenAI(
  context: OrgInsightsContext,
): Promise<AiInsightsPayload> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) {
    throw new InsightsConfigError("AI insights are not configured. Add OPENAI_API_KEY to the server environment.")
  }

  const model = process.env.OPENAI_INSIGHTS_MODEL?.trim() || "gpt-4o-mini"
  const client = new OpenAI({ apiKey })

  const system = `You are Equipify AI, an operations analyst for field service organizations (equipment maintenance, work orders, invoices).

You receive ONLY aggregated JSON metrics for one organization — never raw tables or customer secrets beyond high-level counts.

Respond with a single JSON object (no markdown) matching exactly:
{
  "summary": string (2–4 sentences, executive tone),
  "insights": [
    {
      "title": string (short headline),
      "category": "revenue" | "operations" | "maintenance" | "warranty" | "customer" | "technician",
      "severity": "low" | "medium" | "high",
      "insight": string (what the data implies),
      "recommendedAction": string (one concrete next step),
      "relatedMetric": string (optional — short reference e.g. "Open WOs: 12")
    }
  ]
}

Rules:
- Produce 4–8 insights when the dataset has enough signal; fewer if sparse.
- Tie each insight to the provided numbers; do not invent dollar amounts not supported by revenue cents.
- Prefer actionable recommendations over generic advice.
- Use severity "high" for backlog risk, revenue leakage, warranty exposure, or repeat failures when counts justify it.
`

  const userContent = JSON.stringify(context, null, 2)

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Operational snapshot for analysis:\n\n${userContent}`,
      },
    ],
  })

  const text = completion.choices[0]?.message?.content?.trim()
  if (!text) {
    throw new Error("OpenAI returned an empty response.")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Failed to parse AI response as JSON.")
  }

  return sanitizePayload(parsed)
}
