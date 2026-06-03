import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  acceptOpportunityRecommendation,
  dismissOpportunityRecommendation,
  fetchOpportunityRecommendationById,
} from "@/lib/growth/opportunity-intelligence/crm-intelligence"
import { readGrowthLeadRevenueReadinessSnapshot } from "@/lib/growth/revenue-workflow/recompute-revenue-readiness"
import {
  GROWTH_REVENUE_EXECUTION_PLAN_METADATA_KEY,
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  GROWTH_REVENUE_PLAYBOOK_SUGGESTION_METADATA_KEY,
  type GrowthBuyingSignalEvidence,
  type GrowthOpportunityReviewContext,
  type GrowthRevenuePlaybookKey,
  type GrowthSalesExecutionPlan,
} from "@/lib/growth/revenue-execution/revenue-execution-types"
import { resolveRevenuePlaybook } from "@/lib/growth/revenue-execution/revenue-playbooks"
import { fetchLeadReplyExecutionContext } from "@/lib/growth/revenue-execution/reply-execution-context"
import { generateSalesExecutionPlan } from "@/lib/growth/revenue-execution/sales-execution-plan"
import { appendRevenueExecutionTimelineEntry } from "@/lib/growth/revenue-execution/revenue-timeline"

type Row = Record<string, unknown>

function recommendationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("opportunity_recommendations")
}

function readExecutionPlan(metadata: Record<string, unknown> | null | undefined): GrowthSalesExecutionPlan | null {
  const raw = metadata?.[GROWTH_REVENUE_EXECUTION_PLAN_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  const plan = raw as GrowthSalesExecutionPlan
  if (plan.qaMarker !== GROWTH_REVENUE_EXECUTION_QA_MARKER) return null
  return plan
}

function readStoredPlaybookKey(metadata: Record<string, unknown> | null | undefined): GrowthRevenuePlaybookKey | null {
  const raw = metadata?.[GROWTH_REVENUE_PLAYBOOK_SUGGESTION_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  const key = (raw as { key?: unknown }).key
  return typeof key === "string" ? (key as GrowthRevenuePlaybookKey) : null
}

function mapBuyingSignalEvidence(row: Row): GrowthBuyingSignalEvidence {
  const meta = (row.metadata as Record<string, unknown> | undefined) ?? {}
  const snippet = String(row.evidence_snippet ?? "").trim()
  const signalType = String(row.signal_type)
  const contextParts = [
    typeof meta.threadSubject === "string" ? meta.threadSubject : null,
    typeof meta.replyExcerpt === "string" ? meta.replyExcerpt : null,
    typeof meta.context === "string" ? meta.context : null,
  ].filter(Boolean)

  return {
    signalType,
    evidenceSnippet: snippet || signalType.replace(/_/g, " "),
    confidence: row.confidence ? String(row.confidence) : null,
    source: row.source ? String(row.source) : null,
    supportingContext: contextParts.length > 0 ? contextParts.join(" · ") : null,
  }
}

export async function fetchOpportunityReviewContext(
  admin: SupabaseClient,
  recommendationId: string,
): Promise<GrowthOpportunityReviewContext | null> {
  const rec = await fetchOpportunityRecommendationById(admin, recommendationId)
  if (!rec) return null

  const leadId = rec.leadId
  const [lead, memory, signalsRes, replyContext] = await Promise.all([
    fetchGrowthLeadById(admin, leadId),
    buildLeadMemoryInfluenceContext(admin, leadId),
    admin
      .schema("growth")
      .from("opportunity_signals")
      .select("signal_type, evidence_snippet, confidence, source, metadata, detected_at")
      .eq("lead_id", leadId)
      .order("detected_at", { ascending: false })
      .limit(20),
    fetchLeadReplyExecutionContext(admin, { leadId, contactEmail: lead?.contactEmail }),
  ])

  const signalRows = (signalsRes.data ?? []) as Row[]
  const signalTypes = signalRows.map((s) => String(s.signal_type))
  const buyingSignals = signalRows.map(mapBuyingSignalEvidence)
  const meta = rec.metadata ?? {}

  const playbook = resolveRevenuePlaybook({
    signalTypes,
    recommendationTypes: [rec.recommendationType],
    classification: replyContext.latestReplyClassification,
    unresolvedObjectionCount: memory.unresolvedObjectionCount,
    commitmentCount: memory.commitmentSummaries.length,
    engagementTrend: memory.engagementTrend,
    relationshipStage: memory.relationshipStage,
    hasCompetitiveSignal: signalTypes.includes("competitive_signal"),
    isExistingCustomer: memory.relationshipStage === "customer",
  })

  if (playbook && lead && readStoredPlaybookKey(lead.metadata) !== playbook.key) {
    await persistPlaybookSuggestion(admin, leadId, playbook)
  }

  const readiness = readGrowthLeadRevenueReadinessSnapshot(lead?.metadata)
  let executionPlan = readExecutionPlan(lead?.metadata)

  if (!executionPlan && lead) {
    executionPlan = generateSalesExecutionPlan({
      leadId,
      revenueReadinessScore: readiness?.score ?? null,
      revenueReadinessTier: readiness?.tier ?? null,
      recommendationType: rec.recommendationType,
      recommendationStage: typeof meta.recommendedStage === "string" ? meta.recommendedStage : null,
      hasMeetingIntent: signalTypes.includes("meeting_interest"),
      hasPricingIntent: signalTypes.includes("pricing_interest") || signalTypes.includes("budget_signal"),
      hasProposalIntent: signalTypes.includes("proposal_request"),
      unresolvedObjectionCount: memory.unresolvedObjectionCount,
      hasPositiveReply: replyContext.hasPositiveReply,
      connectedCallCount: lead.connectedCallCount,
      playbookKey: playbook?.key ?? null,
    })
  }

  return {
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
    recommendation: rec,
    revenueReadiness: readiness,
    playbook,
    executionPlan,
    buyingSignals,
    commitments: memory.commitmentSummaries.slice(0, 5),
    objections: memory.topObjections.slice(0, 5),
    relationshipStage: memory.relationshipStage,
    engagementTrend: memory.engagementTrend,
  }
}

export async function snoozeOpportunityRecommendation(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string; snoozeUntil: string; note?: string },
): Promise<void> {
  const { data: existing, error } = await recommendationsTable(admin)
    .select("*")
    .eq("id", input.recommendationId)
    .maybeSingle()
  if (error || !existing) throw new Error("recommendation_not_found")
  const row = existing as Row
  if (row.status !== "pending") throw new Error("invalid_status")

  const now = new Date().toISOString()
  await recommendationsTable(admin)
    .update({
      updated_at: now,
      metadata: {
        ...((row.metadata as Record<string, unknown>) ?? {}),
        reviewState: "snoozed",
        snoozedUntil: input.snoozeUntil,
        snoozedBy: input.actorUserId,
        snoozeNote: input.note ?? null,
        requiresHumanApproval: true,
        qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
      },
    })
    .eq("id", input.recommendationId)

  await appendRevenueExecutionTimelineEntry(admin, String(row.lead_id), {
    occurredAt: now,
    category: "review_action",
    title: "Recommendation snoozed",
    summary: `Snoozed until ${input.snoozeUntil} — operator action, no automation.`,
    metadata: { recommendationId: input.recommendationId, action: "snooze" },
  })
}

export async function requestMoreResearchForRecommendation(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string; note?: string },
): Promise<void> {
  const { data: existing, error } = await recommendationsTable(admin)
    .select("*")
    .eq("id", input.recommendationId)
    .maybeSingle()
  if (error || !existing) throw new Error("recommendation_not_found")
  const row = existing as Row
  if (row.status !== "pending") throw new Error("invalid_status")

  const now = new Date().toISOString()
  await recommendationsTable(admin)
    .update({
      updated_at: now,
      metadata: {
        ...((row.metadata as Record<string, unknown>) ?? {}),
        reviewState: "research_requested",
        researchRequestedAt: now,
        researchRequestedBy: input.actorUserId,
        researchNote: input.note ?? null,
        requiresHumanApproval: true,
        qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
      },
    })
    .eq("id", input.recommendationId)

  await appendRevenueExecutionTimelineEntry(admin, String(row.lead_id), {
    occurredAt: now,
    category: "review_action",
    title: "More research requested",
    summary: input.note ?? "Operator requested additional research before acting.",
    metadata: { recommendationId: input.recommendationId, action: "request_research" },
  })
}

export async function saveSalesExecutionPlan(
  admin: SupabaseClient,
  leadId: string,
  plan: GrowthSalesExecutionPlan,
): Promise<GrowthSalesExecutionPlan> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) throw new Error("lead_not_found")

  const saved: GrowthSalesExecutionPlan = {
    ...plan,
    leadId,
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
    updatedAt: new Date().toISOString(),
    editable: true,
    requiresHumanApproval: true,
  }

  await admin
    .schema("growth")
    .from("leads")
    .update({
      metadata: {
        ...(lead.metadata ?? {}),
        [GROWTH_REVENUE_EXECUTION_PLAN_METADATA_KEY]: saved,
      },
    })
    .eq("id", leadId)

  await appendRevenueExecutionTimelineEntry(admin, leadId, {
    occurredAt: saved.updatedAt,
    category: "execution_plan",
    title: "Execution plan updated",
    summary: saved.summary,
    metadata: { stepCount: saved.steps.length },
  })

  return saved
}

export async function fetchSalesExecutionPlanForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthSalesExecutionPlan | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null
  return readExecutionPlan(lead.metadata)
}

export async function persistPlaybookSuggestion(
  admin: SupabaseClient,
  leadId: string,
  playbook: import("@/lib/growth/revenue-execution/revenue-execution-types").GrowthRevenuePlaybook,
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return

  const suggestedAt = new Date().toISOString()
  await admin
    .schema("growth")
    .from("leads")
    .update({
      metadata: {
        ...(lead.metadata ?? {}),
        [GROWTH_REVENUE_PLAYBOOK_SUGGESTION_METADATA_KEY]: {
          ...playbook,
          suggestedAt,
        },
      },
    })
    .eq("id", leadId)

  await appendRevenueExecutionTimelineEntry(admin, leadId, {
    occurredAt: suggestedAt,
    category: "playbook",
    title: `Playbook: ${playbook.title}`,
    summary: playbook.summary,
    metadata: { playbookKey: playbook.key },
  })
}

export { acceptOpportunityRecommendation, dismissOpportunityRecommendation }
