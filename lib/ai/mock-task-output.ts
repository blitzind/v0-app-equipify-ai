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
import { AidenPreparedWorkspaceIntentLlmSchema } from "@/lib/aiden/intent/aiden-prepared-intent-llm-schema"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import { priceListAiResponseSchema } from "@/lib/catalog/import-types"
import { aiImportResponseSchema } from "@/lib/calibration-templates/ai-import-schema"
import { equipmentAiScanModelSchema } from "@/lib/equipment/equipment-ai-scan-schema"
import { parseWithSchemaSafe } from "@/lib/ai/structured"
import type { AiTaskId, AiTaskInput } from "@/lib/ai/types"
import { WorkOrderServiceSummaryAiSchema } from "@/lib/work-orders/service-summary-ai-schema"
import { WorkOrderPartsSuggestAiSchema } from "@/lib/work-orders/parts-suggest-schema"
import { WorkOrderTechnicianAssistAiSchema } from "@/lib/work-orders/technician-assist-schema"
import { getIndustryLens } from "@/lib/ai/mock-industry-lens"
import {
  EMPTY_TRIAL_OPERATIONAL_SNAPSHOT,
  type TrialOperationalSnapshot,
} from "@/lib/ai/trial-operational-snapshot"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

type MockFileTaskId = Extract<AiTaskId, "catalog_extraction" | "certificate_cleanup" | "equipment_ai_scan">

export type MockStructuredOutputContext = {
  organizationId: string
  industryKey: WorkspaceIndustryKey | null
  snapshot: TrialOperationalSnapshot
  abbreviated?: boolean
}

function abbreviateText(text: string, maxChars: number, abbreviated: boolean): string {
  if (!abbreviated || text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trimEnd()}…`
}

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

function mockAidenHelpAnswer(snippet: string, industryKey: WorkspaceIndustryKey | null): AidenSupportPhase2Answer {
  const topic = snippet.slice(0, 120).trim() || "your question"
  const lens = getIndustryLens(industryKey)
  return {
    answer: [
      "Here is a concise preview of how AIden answers while your workspace is on a trial AI experience.",
      "",
      `You asked about “${topic}”. For ${lens.label} teams, Equipify ties equipment, work orders, and maintenance plans together — start from the left navigation and narrow lists with search or filters.`,
      "",
      `Preview angle for your vertical: ${lens.dispatchAngle}. Trial guidance stays illustrative — confirm procedures internally.`,
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

function buildInsightsFromWorkspaceStats(ctx?: MockStructuredOutputContext): Record<string, unknown> {
  const snap = ctx?.snapshot ?? EMPTY_TRIAL_OPERATIONAL_SNAPSHOT
  const lens = getIndustryLens(ctx?.industryKey ?? null)
  const ab = Boolean(ctx?.abbreviated)
  const insights: Array<Record<string, unknown>> = []

  if (snap.openWorkOrders > 0) {
    insights.push({
      title: abbreviateText(`Active jobs — ${snap.openWorkOrders} open work orders`, 96, ab),
      category: "operations",
      severity: snap.agingScheduledWorkOrders > 0 ? "high" : "medium",
      insight: abbreviateText(
        `Your board currently shows ${snap.openWorkOrders} non-terminal work orders — preview signal based on records in Equipify (no inference).`,
        240,
        ab,
      ),
      recommendedAction: abbreviateText(
        "Sort by scheduled date and confirm ownership for anything slipping past its window.",
        160,
        ab,
      ),
      relatedMetric: "open_work_orders",
    })
  }
  if (snap.agingScheduledWorkOrders > 0) {
    insights.push({
      title: abbreviateText(`Scheduling hygiene — ${snap.agingScheduledWorkOrders} jobs past-due window`, 96, ab),
      category: "operations",
      severity: "high",
      insight: abbreviateText(
        "These jobs still appear active while their scheduled dates are older than seven days — rebaseline dates or close loops.",
        220,
        ab,
      ),
      recommendedAction: abbreviateText("Review dispatch commitments with technicians and customers.", 140, ab),
      relatedMetric: "aging_work_orders",
    })
  }
  if (snap.staleProspects > 0) {
    insights.push({
      title: abbreviateText(`Pipeline — ${snap.staleProspects} prospects need follow-up`, 96, ab),
      category: "customer",
      severity: "medium",
      insight: abbreviateText(
        "Prospects without a future follow-up or overdue touches — preview counts only.",
        200,
        ab,
      ),
      recommendedAction: abbreviateText("Assign owners and refresh next steps from the Prospects board.", 160, ab),
    })
  }
  if (snap.calibrationDueSoonEquipment > 0) {
    insights.push({
      title: abbreviateText(`${lens.complianceHook} — ${snap.calibrationDueSoonEquipment} assets due soon`, 110, ab),
      category: "maintenance",
      severity: "medium",
      insight: abbreviateText(
        `Calibration or PM windows closing within ~7 days — typical for ${lens.label} workflows.`,
        220,
        ab,
      ),
      recommendedAction: abbreviateText("Coordinate appointments before coverage lapses.", 140, ab),
      relatedMetric: "calibration_due",
    })
  }
  if (snap.maintenancePlansDueSoon > 0) {
    insights.push({
      title: abbreviateText(`Maintenance plans — ${snap.maintenancePlansDueSoon} visits approaching`, 110, ab),
      category: "maintenance",
      severity: "low",
      insight: abbreviateText(
        `Plans with next visits inside your horizon — aligns with ${lens.pmCadence}.`,
        200,
        ab,
      ),
      recommendedAction: abbreviateText("Confirm parts and access windows with customers.", 140, ab),
      relatedMetric: "maintenance_plans",
    })
  }
  if (snap.overdueInvoiceCount > 0) {
    insights.push({
      title: abbreviateText(`Collections signal — ${snap.overdueInvoiceCount} invoices past due date`, 110, ab),
      category: "revenue",
      severity: "medium",
      insight: abbreviateText(
        "Counts unpaid invoices whose due dates passed — dollar totals stay in your billing workspace.",
        200,
        ab,
      ),
      recommendedAction: abbreviateText("Align dispatch/comms owners with AR follow-up cadences.", 160, ab),
      relatedMetric: "overdue_invoices",
    })
  }
  if (snap.workOrdersScheduledThisWeek > 0) {
    insights.push({
      title: abbreviateText(`This week’s density — ${snap.workOrdersScheduledThisWeek} visits scheduled`, 110, ab),
      category: "technician",
      severity: "low",
      insight: abbreviateText(
        `Scheduling load snapshot for the rolling week — helpful when balancing ${lens.dispatchAngle}.`,
        200,
        ab,
      ),
      recommendedAction: abbreviateText("Watch travel corridors when stacking same-day jobs.", 140, ab),
    })
  }

  if (insights.length === 0) {
    return mockInsightsGeneration()
  }

  return {
    summary: abbreviateText(
      `Trial AI preview — counts below come straight from your Equipify workspace (${lens.label}). Upgrade for live narrative generation.`,
      260,
      ab,
    ),
    insights: insights.slice(0, 8),
  }
}

function buildOperationalRecommendationsFromWorkspace(ctx?: MockStructuredOutputContext): Record<string, unknown> {
  const snap = ctx?.snapshot ?? EMPTY_TRIAL_OPERATIONAL_SNAPSHOT
  const lens = getIndustryLens(ctx?.industryKey ?? null)
  const ab = Boolean(ctx?.abbreviated)
  const recs: Array<Record<string, unknown>> = []

  if (snap.openWorkOrders > 0) {
    recs.push({
      title: abbreviateText(`Stabilize active workload (${snap.openWorkOrders})`, 90, ab),
      severity: snap.agingScheduledWorkOrders > 0 ? "high" : "medium",
      category: `${lens.label} operations`,
      explanation: abbreviateText(
        `Non-terminal work orders currently on the board — focus on ${lens.equipmentAngle}.`,
        220,
        ab,
      ),
      suggestedNextStep: abbreviateText("Run a dispatcher review from Service Schedule / Work Orders.", 160, ab),
      relatedModule: "work_orders",
      insightTheme: "dispatch_backlog",
      sourceSignals: [`open_work_orders:${snap.openWorkOrders}`],
      relatedRecordIds: [],
    })
  }
  if (snap.staleProspects > 0) {
    recs.push({
      title: abbreviateText(`Pipeline hygiene (${snap.staleProspects} prospects)`, 90, ab),
      severity: "medium",
      category: "Growth",
      explanation: abbreviateText("Prospects missing fresh follow-ups — preview counts only.", 200, ab),
      suggestedNextStep: abbreviateText("Assign nurture owners from the Prospects table.", 140, ab),
      relatedModule: "dashboard",
      insightTheme: "revenue_opportunity",
      sourceSignals: [`stale_prospects:${snap.staleProspects}`],
      relatedRecordIds: [],
    })
  }
  if (snap.calibrationDueSoonEquipment > 0) {
    recs.push({
      title: abbreviateText(`Calibration coverage (${snap.calibrationDueSoonEquipment})`, 90, ab),
      severity: "high",
      category: lens.label,
      explanation: abbreviateText(
        `Equipment rows approaching calibration targets — relevant for ${lens.complianceHook}.`,
        220,
        ab,
      ),
      suggestedNextStep: abbreviateText("Book technicians before customer audits slip.", 140, ab),
      relatedModule: "equipment",
      insightTheme: "maintenance_upsell",
      sourceSignals: [`calibration_due_soon:${snap.calibrationDueSoonEquipment}`],
      relatedRecordIds: [],
    })
  }
  if (snap.overdueInvoiceCount > 0) {
    recs.push({
      title: abbreviateText(`AR alignment (${snap.overdueInvoiceCount} invoices)`, 90, ab),
      severity: "medium",
      category: "Financial hygiene",
      explanation: abbreviateText(
        "Past-due invoices remain open — review balances privately in Invoices (preview text hides dollar amounts).",
        220,
        ab,
      ),
      suggestedNextStep: abbreviateText("Pair technicians with billing owners on disputed jobs.", 160, ab),
      relatedModule: "dashboard",
      insightTheme: "collections_risk",
      sourceSignals: [`overdue_invoices:${snap.overdueInvoiceCount}`],
      relatedRecordIds: [],
    })
  }

  if (recs.length === 0) {
    return {
      overview: abbreviateText(
        `Trial AI preview — ${lens.label} dashboards look healthier when dispatch, assets, and billing stay aligned.`,
        220,
        ab,
      ),
      recommendations: [
        {
          title: "Review aging quotes",
          severity: "low",
          category: "Sales hygiene",
          explanation: "Stale quotes often need a nudge — preview suggestion.",
          suggestedNextStep: "Filter quotes older than 14 days and assign owners.",
          relatedModule: "dashboard",
          insightTheme: "revenue_opportunity",
          sourceSignals: ["quotes_aging_preview"],
          relatedRecordIds: [],
        },
      ],
    }
  }

  return {
    overview: abbreviateText(
      `Trial AI preview — recommendations combine ${lens.label} defaults with live counts from your workspace.`,
      240,
      ab,
    ),
    recommendations: recs.slice(0, 10),
  }
}

export async function buildMockStructuredOutput<T>(params: {
  task: AiTaskId
  input: AiTaskInput
  schema?: z.ZodType<T>
  acceptResult?: (data: T, rawText: string) => boolean | Promise<boolean>
  /** Industry + operational counts — populated by the router for mock trial orgs. */
  context?: MockStructuredOutputContext
}): Promise<{ output: T; rawText: string; promptTokens: number; completionTokens: number }> {
  const snippet = pickUserSnippet(params.input)
  const parts: string[] = [snippet]

  let rawObj: unknown

  switch (params.task) {
    case "aiden_help": {
      rawObj = mockAidenHelpAnswer(snippet, params.context?.industryKey ?? null)
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
      rawObj = buildOperationalRecommendationsFromWorkspace(params.context)
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
    case "aiden_prepared_workspace_intent_llm": {
      const snippet = pickUserSnippet(params.input).toLowerCase()
      let actionId: AidenPreparedWorkspaceActionId = "draft_customer_message"
      if (
        /\bbulk\b.*\binvoice/.test(snippet) ||
        /\binvoice\s+all\s+completed/.test(snippet) ||
        (/\ball\b.*\bcompleted\b.*\b(work\s+orders?|jobs)\b/.test(snippet) && /\b(invoice|invoices|bill|draft)\b/.test(snippet))
      ) {
        actionId = "bulk_invoice_completed_work_orders"
      } else if (/\binvoice\b/.test(snippet) && !/\bquote\b/.test(snippet)) {
        actionId = "create_invoice_from_work_order"
      } else if (/\bquote\b|\bestimate\b/.test(snippet)) {
        actionId = "create_quote_from_work_order"
      } else if (/\bsummar(y|ize)\b/.test(snippet) && /\bcustomer\b/.test(snippet)) {
        actionId = "summarize_customer_history"
      }
      rawObj = {
        actionId,
        confidence: /\b(?:maybe|not sure|idk)\b/.test(snippet) ? 0.48 : 0.78,
        customerReference: /\bacme\b/i.test(snippet) ? "Acme LLC" : null,
        equipmentReference: null,
        workOrderReference: /\blast\b.*\bjob\b|\blast\b.*\bwork\s*order\b/.test(snippet) ? "latest" : null,
        bulkInvoiceDateRange: null,
        suggestedDraftCopy:
          actionId === "draft_customer_message" ?
            "Mock trial draft — replace with your tone. Quick update: we're aligning on next steps and will follow up shortly."
          : null,
        clarificationQuestion: null,
        rationale: "Mock structured intent for trial or offline AI routing — server merge + resolvers still validate.",
      }
      break
    }
    case "insights_generation":
      rawObj = buildInsightsFromWorkspaceStats(params.context)
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
    case "equipment_ai_scan": {
      rawObj = {
        equipmentName: "Trial preview — sample asset",
        manufacturer: "Preview OEM",
        model: "Model 100 (trial)",
        serialNumber: "PREVIEW-SN-0001",
        equipmentType: "Medical device",
        subcategory: "Audiometry",
        documentCustomerName: "Preview Customer LLC",
        installDate: null,
        warrantyExpiration: null,
        lastServiceDate: null,
        nextServiceDue: null,
        nextCalibrationDue: null,
        calibrationIntervalMonths: 12,
        serviceIntervalDescription: "Annual calibration (preview)",
        notes:
          "Trial AI preview — values are illustrative. Upload again on a subscribed workspace for live extraction from your photo or PDF.",
        supportingDetails: [
          "Calibrated by: Preview Lab (simulated)",
          "Standards: preview only — confirm against the source document.",
        ],
        confidence: 0.55,
      }
      break
    }
    default:
      rawObj = {
        message:
          "Trial AI preview — this task would call live models on a subscribed workspace. Adjust inputs and try again after upgrading.",
      }
  }

  if (params.task === "customer_email") {
    if (snippet.includes("[communication_ai_assist]")) {
      rawObj = {
        text: "Trial AI preview — AI-assisted communication output would appear here on a subscribed workspace. Nothing is sent automatically; copy and approve manually.",
      }
    } else {
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
  }

  if (params.task === "work_order_summary") {
    const snippet = pickUserSnippet(input)
    const customerSafe = /customer_safe/i.test(snippet)
    rawObj = customerSafe ?
      {
        summary:
          "Trial preview — customer-facing recap of the visit. No pricing or internal-only notes are included; confirm facts before sending.",
        highlights: ["Work completed during the visit", "Equipment returned to normal service"],
      }
    : {
        summary:
          "Trial preview — internal handoff summary from the job context. Technicians should confirm details before sharing externally.",
        highlights: ["Review operating conditions noted in the record", "Capture any follow-ups in Equipify"],
      }
  }

  if (params.task === "work_order_technician_assist") {
    rawObj = {
      troubleshootingSteps: [
        "Trial preview — verify power, fluids, and obvious fault indicators before deeper disassembly.",
        "Reproduce the customer-reported symptom with a short controlled test when safe.",
      ],
      customerQuestions: [
        "When did you first notice the issue, and does it happen under load or at idle?",
        "Any recent service, fluid changes, or alarms we should know about?",
      ],
      partsAndToolsChecklist: [
        "Basic hand tools appropriate for the asset class",
        "Shop towels / spill containment",
        "PPE per your shop policy",
      ],
      safetyAndEscalation: [
        "Follow lockout/tagout before removing guards or working on stored energy.",
        "Stop and escalate if you see fuel leaks, electrical arcing, or unstable loads.",
      ],
      customerSafeWording:
        "Thanks for having us out. We’re going to run a few checks on the equipment and keep you posted. If anything changes while we’re on site, just flag us right away.",
    }
  }

  if (params.task === "work_order_parts_suggest") {
    rawObj = {
      suggestions: [
        {
          name: "Trial preview — primary service filter (generic)",
          itemKind: "part",
          confidence: "medium",
          reasoning:
            "Illustrative row for trial — live AI would tailor this to the equipment and problem in the work order context.",
          catalogMatch: null,
        },
        {
          name: "Trial preview — hand tools for the asset class",
          itemKind: "tool",
          confidence: "low",
          reasoning: "Confirm specific sizes and torque requirements on site before use.",
          catalogMatch: null,
        },
        {
          name: "Trial preview — shop towels / cleanup consumables",
          itemKind: "consumable",
          confidence: "low",
          reasoning: "Common for fluid-handling jobs; adjust to your site SOP.",
          catalogMatch: null,
        },
      ],
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
    if (!schemaResult.ok && params.task === "aiden_prepared_workspace_intent_llm") {
      const normalized = AidenPreparedWorkspaceIntentLlmSchema.safeParse(rawObj)
      if (normalized.success) {
        rawText = JSON.stringify(normalized.data)
        schemaResult = await parseWithSchemaSafe(rawText, params.schema)
      }
    }
    if (!schemaResult.ok && params.task === "work_order_summary") {
      const o = (rawObj ?? {}) as Record<string, unknown>
      const summary = typeof o.summary === "string" ? o.summary : ""
      const highlightsRaw = o.highlights ?? o.checklist
      const highlights = Array.isArray(highlightsRaw) ? highlightsRaw.filter((x): x is string => typeof x === "string") : undefined
      const normalized = WorkOrderServiceSummaryAiSchema.safeParse({ summary, highlights })
      if (normalized.success) {
        rawText = JSON.stringify(normalized.data)
        schemaResult = await parseWithSchemaSafe(rawText, params.schema)
      }
    }
    if (!schemaResult.ok && params.task === "work_order_technician_assist") {
      const normalized = WorkOrderTechnicianAssistAiSchema.safeParse(rawObj)
      if (normalized.success) {
        rawText = JSON.stringify(normalized.data)
        schemaResult = await parseWithSchemaSafe(rawText, params.schema)
      }
    }
    if (!schemaResult.ok && params.task === "work_order_parts_suggest") {
      const normalized = WorkOrderPartsSuggestAiSchema.safeParse(rawObj)
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
      : params.task === "equipment_ai_scan"
        ? equipmentAiScanModelSchema.parse({
            equipmentName: `Trial preview — ${params.fileName}`,
            manufacturer: "Preview OEM",
            model: "Model 200 (trial)",
            serialNumber: "PREVIEW-SN-FILE",
            equipmentType: "Medical device",
            subcategory: null,
            documentCustomerName: null,
            installDate: null,
            warrantyExpiration: null,
            lastServiceDate: null,
            nextServiceDue: null,
            nextCalibrationDue: null,
            calibrationIntervalMonths: null,
            serviceIntervalDescription: null,
            notes:
              "Trial AI preview — file extraction is simulated. Re-upload after upgrading for live parsing from your photo or PDF.",
            supportingDetails: [`Simulated scan of ${params.byteLength} bytes.`],
            confidence: 0.5,
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
