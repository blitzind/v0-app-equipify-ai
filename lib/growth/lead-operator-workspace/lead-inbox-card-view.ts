import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthLeadInboxRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import { loadOperatorHandoffFromLeadInbox } from "@/lib/growth/operator-handoff/operator-handoff-repository"
import { computeOperatorHandoffPriorityHints } from "@/lib/growth/operator-handoff/operator-handoff-priority"
import type { GrowthOperatorHandoffInput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import {
  GROWTH_LEAD_ENGINE_RUN_METADATA_KEY,
  type GrowthLeadInboxCardView,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { extractLeadEngineOutputsFromRun } from "@/lib/growth/lead-operator-workspace/lead-engine-run-extract"

function formatTimeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return "just now"
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function isPipelineRun(value: unknown): value is GrowthLeadEnginePipelineRun {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return Array.isArray(row.stage_results) && typeof row.run_id === "string"
}

export function buildOperatorHandoffInputFromRow(row: GrowthLeadInboxRow): GrowthOperatorHandoffInput {
  const run = row.metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  const outputs = isPipelineRun(run) ? extractLeadEngineOutputsFromRun(run) : {}
  return {
    leadInbox: row,
    icpTargeting: outputs.icpTargeting ?? "",
    companyDiscovery: outputs.companyDiscovery ?? "",
    decisionMakerHypothesis: outputs.decisionMakerHypothesis ?? "",
    contactResearch: outputs.contactResearch ?? "",
    verificationTriage: outputs.verificationTriage ?? "",
    accountBrief: outputs.accountBrief ?? "",
    outreachPersonalization: outputs.outreachPersonalization ?? "",
    leadScore: outputs.leadScore ?? "",
    humanApproval: outputs.humanApproval ?? "",
    revenueExecution: outputs.revenueExecution ?? "",
    intentHistory: null,
  }
}

export function buildLeadInboxCardView(row: GrowthLeadInboxRow): GrowthLeadInboxCardView {
  const handoffPkg = loadOperatorHandoffFromLeadInbox(row)
  const handoff = handoffPkg?.handoff ?? null
  const hints = computeOperatorHandoffPriorityHints(buildOperatorHandoffInputFromRow(row))
  const run = row.metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  const outputs = isPipelineRun(run) ? extractLeadEngineOutputsFromRun(run) : {}
  const verification =
    outputs.verificationTriage && typeof outputs.verificationTriage === "object"
      ? outputs.verificationTriage.disposition
      : "unknown"
  const approval =
    outputs.humanApproval && typeof outputs.humanApproval === "object"
      ? outputs.humanApproval.approval_status
      : row.human_review_required
        ? "pending"
        : "n/a"
  const leadScoreValue =
    outputs.leadScore && typeof outputs.leadScore === "object"
      ? outputs.leadScore.lead_score
      : null

  const intentIndicators: string[] = []
  if (row.session_count > 1) intentIndicators.push(`${row.session_count} sessions`)
  if (row.visit_count > 0) intentIndicators.push(`${row.visit_count} pageviews`)
  if (row.intent_grade && row.intent_grade !== "F") intentIndicators.push(`Grade ${row.intent_grade}`)
  if (row.utm_campaign) intentIndicators.push(`Campaign: ${row.utm_campaign}`)
  if (row.existing_account_match.matched) intentIndicators.push("CRM account match")
  if (row.existing_lead_match.matched) intentIndicators.push("CRM lead match")

  const searchSummary = row.metadata?.search_intent_summary as
    | { top_keyword?: string; top_category?: string; signal_count?: number }
    | undefined
  if (searchSummary?.top_category) {
    intentIndicators.push(`Search: ${String(searchSummary.top_category).replace(/_/g, " ")}`)
  }
  if (searchSummary?.top_keyword) {
    intentIndicators.push(`Keyword: ${searchSummary.top_keyword}`)
  }

  const companySummary = row.metadata?.company_identification_summary as
    | { company_name?: string; matched_source?: string; match_confidence?: number }
    | undefined
  if (companySummary?.company_name) {
    intentIndicators.push(`Company: ${companySummary.company_name}`)
  }
  if (companySummary?.matched_source) {
    intentIndicators.push(`Match: ${String(companySummary.matched_source).replace(/_/g, " ")}`)
  }

  const buyingStageSummary = row.metadata?.buying_stage_summary as
    | { detected_stage?: string; stage_confidence?: number }
    | undefined
  if (buyingStageSummary?.detected_stage) {
    intentIndicators.push(`Stage: ${String(buyingStageSummary.detected_stage).replace(/_/g, " ")}`)
  }

  const lastActivityAt = row.updated_at || row.created_at

  return {
    id: row.id,
    company_name: row.company_name || "Unknown company",
    domain: row.domain,
    lead_score: leadScoreValue ?? (row.intent_score > 0 ? row.intent_score : null),
    intent_score: row.intent_score,
    intent_grade: row.intent_grade,
    verification_state: verification,
    candidate_type: row.candidate_type,
    candidate_priority: row.candidate_priority,
    recommended_motion: handoff?.recommended_motion ?? hints.recommended_motion,
    recommended_urgency: handoff?.recommended_urgency ?? hints.recommended_urgency,
    recommended_owner: handoff?.recommended_owner ?? hints.recommended_owner,
    human_approval_state: approval,
    owner_id: row.owner_id,
    status: row.status,
    pipeline_status: row.pipeline_status,
    human_review_required: row.human_review_required,
    session_count: row.session_count,
    visit_count: row.visit_count,
    candidate_confidence: row.candidate_confidence,
    last_activity_at: lastActivityAt,
    time_since_activity_label: formatTimeSince(lastActivityAt),
    intent_indicators: intentIndicators,
    has_operator_handoff: handoff != null,
    has_lead_engine_run: isPipelineRun(run),
  }
}
