import "server-only"

import type { z } from "zod"
import { AidenSupportPhase2AnswerSchema, type AidenSupportPhase2Answer } from "@/lib/aiden/aiden-support-phase2-schema"
import { AidenOperationalRecommendationsAnswerSchema } from "@/lib/aiden/operational-recommendations-schema"
import {
  AidenCustomerSummaryAnswerSchema,
  AidenDraftGenerationAnswerSchema,
  AidenWorkOrderProductivityAnswerSchema,
} from "@/lib/aiden/productivity-schemas"
import { SafeActionPrepareAnswerSchema } from "@/lib/aiden/safe-actions/schema"
import { priceListAiResponseSchema } from "@/lib/catalog/import-types"
import { aiImportResponseSchema } from "@/lib/calibration-templates/ai-import-schema"
import { parseWithSchemaSafe } from "@/lib/ai/structured"
import type { AiTaskId, AiTaskInput } from "@/lib/ai/types"

type MockFileTaskId = Extract<AiTaskId, "catalog_extraction" | "certificate_cleanup">

function estimateTokens(parts: string[]): number {
  const n = parts.reduce((acc, s) => acc + s.length, 0)
  return Math.max(48, Math.ceil(n / 4))
}

function pickUserSnippet(input: AiTaskInput): string {
  if (input.user?.trim()) return input.user.trim().slice(0, 800)
  const msgs = input.messages ?? []
  const lastUser = [...msgs].reverse().find((m) => m.role === "user")
  if (!lastUser) return ""
  if (typeof lastUser.content === "string") return lastUser.content.slice(0, 800)
  const text = lastUser.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
  return text.slice(0, 800)
}

function mockAidenHelpAnswer(snippet: string): AidenSupportPhase2Answer {
  const topic = snippet.slice(0, 120).trim() || "your question"
  return {
    answer: [
      "Here is a concise preview of how AIden answers while your workspace is on a trial AI experience.",
      "",
      `You asked about “${topic}”. In Equipify, start from the left navigation for the area you are working in, then use search or filters on that list to narrow records.`,
      "",
      "During trial, guidance is preview-quality — verify critical steps against your internal procedures.",
    ].join("\n"),
    message: "",
    classification: "supported_now",
    steps: ["Open the relevant module from the left sidebar.", "Use search or filters to find the record.", "Open the detail page for next actions."],
    relatedRoutes: [],
    permissionNote: null,
    limitation:
      "Trial AI preview — answers are illustrative. Confirm dates, pricing, and compliance-sensitive steps in-product or with your team.",
    unresolved: false,
    howToMode: true,
    featureRequestDraft: null,
  }
}

function mockInsightsGeneration(): Record<string, unknown> {
  return {
    summary:
      "Operational preview summary for your workspace (trial AI experience). Review metrics in-dashboard before acting.",
    insights: [
      {
        title: "Follow up on open work orders",
        category: "operations",
        severity: "medium",
        insight:
          "Queues with aging jobs often benefit from a short daily triage — preview suggestion only.",
        recommendedAction: "Sort work orders by age and assign owners for anything older than your SLA.",
        relatedMetric: "open_work_orders",
      },
      {
        title: "Technician utilization snapshot",
        category: "technician",
        severity: "low",
        insight:
          "Balancing dispatch windows can reduce travel gaps — preview suggestion based on typical patterns.",
        recommendedAction: "Review this week’s schedule board for overlapping zones.",
      },
    ],
  }
}

export async function buildMockStructuredOutput<T>(params: {
  task: AiTaskId
  input: AiTaskInput
  schema?: z.ZodType<T>
  acceptResult?: (data: T, rawText: string) => boolean | Promise<boolean>
}): Promise<{ output: T; rawText: string; promptTokens: number; completionTokens: number }> {
  const snippet = pickUserSnippet(params.input)
  const parts: string[] = [snippet]

  let rawObj: unknown

  switch (params.task) {
    case "aiden_help": {
      rawObj = mockAidenHelpAnswer(snippet)
      break
    }
    case "aiden_customer_summary": {
      rawObj = {
        profileSummary: "Trial AI preview — customer profile highlights would appear here using live AI once subscribed.",
        recentWorkSummary: "Recent jobs and touchpoints summarized for quick context.",
        openWorkSummary: "Open work orders and commitments summarized at a glance.",
        notableIssues: ["Preview mode — verify SLAs and billing-sensitive items manually."],
        suggestedNextSteps: ["Confirm priority with your dispatcher.", "Align on-site timing with the customer."],
      }
      break
    }
    case "aiden_work_order_productivity": {
      rawObj = {
        issueAndStatusSummary: "Trial preview — status and issue framing for this work order.",
        equipmentSummary: "Equipment context summarized for technicians.",
        tasksSummary: "Tasks and milestones summarized for the crew.",
        notesSummary: "Notes consolidated for quick orientation.",
        partsSummary: "Parts mentions summarized where present.",
        missingInformation: ["Photos", "Customer confirmation window"],
        suggestedNextSteps: ["Capture missing photos before closing.", "Confirm customer availability."],
        customerFriendlyUpdateDraft:
          "Quick preview draft — edit before sending. We're coordinating the next steps and will share timing shortly.",
      }
      break
    }
    case "aiden_draft_generation": {
      rawObj = {
        draft:
          "Trial AI preview draft — replace bracketed items.\n\nHello — quick update on your service visit: we're scheduling [timeframe] and will confirm details shortly.",
        copyReminder: ["Remove bracketed placeholders.", "Verify tone matches your brand voice."],
      }
      break
    }
    case "aiden_operational_recommendations": {
      rawObj = {
        overview:
          "Trial AI preview — operational recommendations highlight patterns you might review this week.",
        recommendations: [
          {
            title: "Review aging quotes",
            severity: "low",
            category: "Sales hygiene",
            explanation: "Stale quotes often need a nudge — preview suggestion.",
            suggestedNextStep: "Filter quotes older than 14 days and assign owners.",
            relatedModule: "dashboard",
            relatedRecordIds: [],
          },
        ],
      }
      break
    }
    case "aiden_safe_action_prepare": {
      const future = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
      rawObj = {
        action_type: "create_reminder",
        title: "Trial AI preview — reminder draft",
        explanation:
          "This is a preview-only reminder proposal during trial. Confirming workspace actions that change records requires a paid subscription.",
        risk_level: "low",
        confirmation_required: true as const,
        proposed_payload: {
          remind_at: future,
          detail:
            "Trial AI preview — reminders prepared here are not saved until your workspace uses live AI action preparation.",
          related_entity_type: "none" as const,
        },
      }
      break
    }
    case "insights_generation":
      rawObj = mockInsightsGeneration()
      break
    case "classification":
      rawObj = {
        label: "preview",
        confidence: 0.75,
        rationale: "Trial AI preview classification — verify before automating workflows.",
      }
      break
    case "tagging":
      rawObj = {
        tags: ["trial_preview", "needs_review"],
        confidence: 0.72,
      }
      break
    case "workflow_builder":
      rawObj = {
        summary: "Trial preview workflow suggestion — validate triggers with your team.",
        nodes: [{ id: "start", type: "trigger", label: "Record updated" }],
        edges: [],
      }
      break
    case "scheduling_assistant":
      rawObj = {
        suggestion:
          "Trial preview — consider technician proximity and SLA windows when proposing slots.",
        proposedSlots: [],
      }
      break
    case "inventory_operations":
      rawObj = {
        answer:
          "Trial preview — inventory suggestions stay informational until live AI is enabled on a paid plan.",
        cautions: ["Confirm counts against warehouse records."],
      }
      break
    case "maintenance_prediction":
      rawObj = {
        predictions: [
          {
            equipmentId: "preview",
            horizonDays: 30,
            riskScore: 0.35,
            notes: "Trial preview — schedule inspections based on OEM guidance.",
          },
        ],
      }
      break
    case "dispatch_recommendation":
      rawObj = {
        recommendation: "Trial preview — prioritize nearest qualified technician with parts available.",
        confidence: 0.7,
        rationale: "Heuristic preview only.",
      }
      break
    case "quote_generation":
      rawObj = {
        quoteSummary: "Trial preview quote narrative — edit all pricing and terms manually.",
        lineItems: [],
      }
      break
    case "invoice_summary":
      rawObj = {
        summary: "Trial preview invoice synopsis.",
        totals: { subtotal: 0, tax: 0, total: 0 },
      }
      break
    default:
      rawObj = {
        message:
          "Trial AI preview — this task would call live models on a subscribed workspace. Adjust inputs and try again after upgrading.",
      }
  }

  if (params.task === "customer_email") {
    const wantsBrief = /summary.*next_steps|next_steps/i.test(snippet) || /Return JSON only with keys summary/i.test(snippet)
    rawObj = wantsBrief
      ? {
          summary:
            "Trial AI preview brief — follow up with the prospect using facts already in Equipify; confirm pricing outside the product.",
          next_steps: ["Confirm timeline", "Send recap email", "Schedule onsite if qualified"],
        }
      : {
          subject: "Trial AI preview — quick follow-up",
          body: [
            "Hello —",
            "",
            "Thank you for the update. Here is a short trial-generated draft for review before sending.",
            "",
            "Next steps: let me know the best time to reconnect.",
            "",
            "[Trial AI preview — edit before sending]",
          ].join("\n"),
        }
  }

  if (params.task === "work_order_summary") {
    rawObj = {
      summary: "Trial preview — concise recap of the job context for handoff.",
      checklist: ["Safety review", "Customer sign-off"],
      risks: [],
    }
  }

  if (params.task === "OCR_cleanup") {
    rawObj = {
      cleanedText: snippet ? snippet.slice(0, 2000) : "Trial preview — cleaned text would appear here.",
      warnings: [],
    }
  }

  let rawText = JSON.stringify(rawObj ?? {})
  parts.push(rawText)

  if (params.schema) {
    let schemaResult = await parseWithSchemaSafe(rawText, params.schema)
    if (!schemaResult.ok && params.task === "aiden_help") {
      const normalized = AidenSupportPhase2AnswerSchema.safeParse(rawObj)
      if (normalized.success) {
        rawText = JSON.stringify(normalized.data)
        schemaResult = await parseWithSchemaSafe(rawText, params.schema)
      }
    }
    if (!schemaResult.ok && params.task === "aiden_customer_summary") {
      const normalized = AidenCustomerSummaryAnswerSchema.safeParse(rawObj)
      if (normalized.success) {
        rawText = JSON.stringify(normalized.data)
        schemaResult = await parseWithSchemaSafe(rawText, params.schema)
      }
    }
    if (!schemaResult.ok && params.task === "aiden_work_order_productivity") {
      const normalized = AidenWorkOrderProductivityAnswerSchema.safeParse(rawObj)
      if (normalized.success) {
        rawText = JSON.stringify(normalized.data)
        schemaResult = await parseWithSchemaSafe(rawText, params.schema)
      }
    }
    if (!schemaResult.ok && params.task === "aiden_draft_generation") {
      const normalized = AidenDraftGenerationAnswerSchema.safeParse(rawObj)
      if (normalized.success) {
        rawText = JSON.stringify(normalized.data)
        schemaResult = await parseWithSchemaSafe(rawText, params.schema)
      }
    }
    if (!schemaResult.ok && params.task === "aiden_operational_recommendations") {
      const normalized = AidenOperationalRecommendationsAnswerSchema.safeParse(rawObj)
      if (normalized.success) {
        rawText = JSON.stringify(normalized.data)
        schemaResult = await parseWithSchemaSafe(rawText, params.schema)
      }
    }
    if (!schemaResult.ok && params.task === "aiden_safe_action_prepare") {
      const normalized = SafeActionPrepareAnswerSchema.safeParse(rawObj)
      if (normalized.success) {
        rawText = JSON.stringify(normalized.data)
        schemaResult = await parseWithSchemaSafe(rawText, params.schema)
      }
    }

    if (!schemaResult.ok) {
      const fallback = { note: "trial_preview_fallback", ok: true }
      rawText = JSON.stringify(fallback)
      const second = await parseWithSchemaSafe(rawText, params.schema)
      if (!second.ok) {
        throw new Error(`Mock AI output failed schema validation for task ${params.task}`)
      }
      rawObj = second.data
    } else {
      rawObj = schemaResult.data
    }

    if (params.acceptResult) {
      const ok = await params.acceptResult(rawObj as T, rawText)
      if (!ok) {
        throw new Error("Trial preview output was rejected by acceptResult — try again.")
      }
    }

    const pt = estimateTokens(parts)
    const ct = estimateTokens([rawText])
    return { output: rawObj as T, rawText, promptTokens: pt, completionTokens: ct }
  }

  const textOut =
    typeof rawObj === "string"
      ? rawObj
      : typeof rawObj === "object" && rawObj != null && "message" in (rawObj as object)
        ? String((rawObj as { message?: string }).message ?? rawText)
        : rawText

  const pt = estimateTokens(parts)
  const ct = estimateTokens([textOut])
  return { output: textOut as T, rawText: textOut, promptTokens: pt, completionTokens: ct }
}

export async function buildMockFileExtractionOutput<T>(params: {
  task: MockFileTaskId
  schema: z.ZodType<T>
  fileName: string
  byteLength: number
}): Promise<{ output: T; rawText: string; promptTokens: number; completionTokens: number }> {
  let rawObj: unknown =
    params.task === "catalog_extraction"
      ? priceListAiResponseSchema.parse({
          manufacturerName: "Preview Manufacturer",
          effectiveDate: null,
          warnings: [
            `Trial AI preview extraction for “${params.fileName}” — live parsing runs after subscribing. File size ~${params.byteLength} bytes.`,
          ],
          rows: [
            {
              category: "Preview",
              itemType: "service",
              partNumber: null,
              name: "Calibration service (preview row)",
              description: "Illustrative row only — not extracted from your PDF.",
              listPrice: null,
              cost: null,
              notes: "Trial preview — verify all catalog imports against the source PDF.",
              replacementPartNumber: null,
              status: "needs_review",
              confidence: 0.5,
              rawExtractedText: null,
            },
          ],
        })
      : aiImportResponseSchema.parse({
          templateName: `Preview template (${params.fileName})`,
          equipmentCategory: "General",
          confidence: 0.55,
          fields: [
            {
              id: "section-overview",
              type: "section",
              label: "Overview",
            },
            {
              id: "notes-general",
              type: "notes",
              label: "Technician remarks",
            },
          ],
          warnings: [
            "Trial AI preview — certificate/template extraction is simulated; upload again after upgrading for live extraction.",
          ],
        })

  const rawText = JSON.stringify(rawObj)
  const parsed = await parseWithSchemaSafe(rawText, params.schema)
  if (!parsed.ok) {
    const minimal = await parseWithSchemaSafe(
      JSON.stringify({ parsed: false, preview: true }),
      params.schema,
    )
    if (!minimal.ok) {
      throw new Error(`Mock file extraction failed schema checks for ${params.task}`)
    }
    rawObj = minimal.data
  } else {
    rawObj = parsed.data
  }

  const rough = estimateTokens([params.fileName, rawText])
  const pt = Math.max(256, Math.ceil(rough * 0.6))
  const ct = Math.max(128, Math.ceil(rough * 0.4))
  return { output: rawObj as T, rawText: JSON.stringify(rawObj), promptTokens: pt, completionTokens: ct }
}
