import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeBuyingMomentum } from "@/lib/growth/revenue-intelligence/buying-momentum-engine"
import { buildBuyingCommitteeMap } from "@/lib/growth/revenue-intelligence/buying-committee-map"
import {
  detectOpportunitySignalsFromReplyV2,
  type DetectedRevenueOpportunitySignal,
} from "@/lib/growth/revenue-intelligence/opportunity-signal-engine"
import { recordCampaignRevenueAttribution } from "@/lib/growth/revenue-intelligence/campaign-revenue-attribution-phase6"
import { buildRevenueIntelligenceCopilot } from "@/lib/growth/revenue-intelligence/revenue-copilot-service"
import {
  computeGlobalSalesExecutionInsights,
  upsertSalesExecutionInsightSnapshot,
} from "@/lib/growth/revenue-intelligence/sales-execution-insights"
import { GROWTH_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"
import type { GrowthReplyBuyingSignalEvidence } from "@/lib/growth/reply-intelligence/reply-intent-types"
import type { ReplyIntentClassificationV2Result } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"
import type { GrowthReplyObjectionEvidence } from "@/lib/growth/reply-intelligence/reply-intent-types"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

async function persistOpportunitySignals(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    signals: DetectedRevenueOpportunitySignal[]
    occurredAt: string
  },
): Promise<string[]> {
  const signalIds: string[] = []
  for (const signal of input.signals) {
    const { data, error } = await admin
      .schema("growth")
      .from("opportunity_signals")
      .insert({
        lead_id: input.leadId,
        signal_type: signal.signalType,
        confidence: signal.confidence,
        evidence_snippet: signal.excerpt.slice(0, 500),
        source: signal.source,
        metadata: signal.attribution,
        detected_at: input.occurredAt,
      })
      .select("id")
      .single()
    if (error) continue
    const signalId = String((data as { id: string }).id)
    signalIds.push(signalId)

    await admin.schema("growth").from("opportunity_signal_timeline_events").insert({
      lead_id: input.leadId,
      signal_id: signalId,
      outbound_reply_id: input.replyId,
      event_kind: "signal_detected",
      signal_type: signal.signalType,
      confidence: signal.confidence,
      evidence_excerpt: signal.excerpt.slice(0, 500),
      source: signal.source,
      occurred_at: input.occurredAt,
      payload: signal.attribution,
    }).catch(() => undefined)
  }
  return signalIds
}

async function persistBuyingMomentum(
  admin: SupabaseClient,
  input: {
    leadId: string
    momentum: ReturnType<typeof computeBuyingMomentum>
    stakeholderCount: number
  },
): Promise<void> {
  const snapshotDate = new Date().toISOString().slice(0, 10)
  const { data: prior } = await admin
    .schema("growth")
    .from("buying_momentum_snapshots")
    .select("momentum_score")
    .eq("lead_id", input.leadId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = {
    lead_id: input.leadId,
    snapshot_date: snapshotDate,
    momentum_score: input.momentum.momentumScore,
    momentum_trend: input.momentum.momentumTrend,
    reply_velocity_score: input.momentum.replyVelocityScore,
    engagement_depth_score: input.momentum.engagementDepthScore,
    stakeholder_count: input.stakeholderCount,
    objection_resolution_score: input.momentum.objectionResolutionScore,
    outbound_interaction_score: input.momentum.outboundInteractionScore,
    evidence: input.momentum.evidence,
    explainability: { lines: input.momentum.explainability },
    qa_marker: GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await admin
    .schema("growth")
    .from("buying_momentum_snapshots")
    .select("id")
    .eq("lead_id", input.leadId)
    .eq("snapshot_date", snapshotDate)
    .maybeSingle()

  if (existing) {
    await admin.schema("growth").from("buying_momentum_snapshots").update(row).eq("id", (existing as { id: string }).id)
  } else {
    await admin.schema("growth").from("buying_momentum_snapshots").insert(row)
  }

  void prior
}

async function persistBuyingCommitteeMap(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyLabel: string
    bodyPreview: string | null | undefined
    signals: DetectedRevenueOpportunitySignal[]
  },
): Promise<ReturnType<typeof buildBuyingCommitteeMap>> {
  const map = buildBuyingCommitteeMap({
    leadId: input.leadId,
    companyLabel: input.companyLabel,
    bodyPreview: input.bodyPreview,
    signals: input.signals,
  })

  const snapshotDate = new Date().toISOString().slice(0, 10)
  const row = {
    lead_id: input.leadId,
    snapshot_date: snapshotDate,
    stakeholder_count: map.stakeholderCount,
    completeness_score: map.completenessScore,
    committee_members: map.committeeMembers,
    missing_stakeholder_suggestions: map.missingStakeholderSuggestions,
    evidence: map.evidence,
    qa_marker: GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await admin
    .schema("growth")
    .from("buying_committee_maps")
    .select("id")
    .eq("lead_id", input.leadId)
    .eq("snapshot_date", snapshotDate)
    .maybeSingle()

  if (existing) {
    await admin.schema("growth").from("buying_committee_maps").update(row).eq("id", (existing as { id: string }).id)
  } else {
    await admin.schema("growth").from("buying_committee_maps").insert(row)
  }

  for (const member of map.committeeMembers) {
    await admin
      .schema("growth")
      .from("buying_committee_signals")
      .insert({
        lead_id: input.leadId,
        contact_label: member.label,
        role_hint: member.roleHint,
        signal_strength: "medium",
        evidence_snippet: member.evidence.slice(0, 500),
        source: "revenue_intelligence_v1",
      })
      .catch(() => undefined)
  }

  return map
}

export async function processRevenueIntelligence(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    companyName?: string | null
    bodyPreview: string | null | undefined
    classification: ReplyIntentClassificationV2Result
    buyingSignals: GrowthReplyBuyingSignalEvidence[]
    objections: GrowthReplyObjectionEvidence[]
    threadReplyCount: number
    responseLatencyMs: number | null
    recommendedOperatorAction?: string | null
    campaignId?: string | null
    sequenceEnrollmentId?: string | null
    receivedAt: string
  },
): Promise<{ signalCount: number; momentumScore: number; momentumTrend: string }> {
  const signals = detectOpportunitySignalsFromReplyV2({
    bodyPreview: input.bodyPreview,
    classification: input.classification,
    buyingSignals: input.buyingSignals,
    threadReplyCount: input.threadReplyCount,
    responseLatencyMs: input.responseLatencyMs,
  })

  if (signals.length > 0) {
    await persistOpportunitySignals(admin, {
      leadId: input.leadId,
      replyId: input.replyId,
      signals,
      occurredAt: input.receivedAt,
    })
    await appendGrowthLeadTimelineEvent(admin, {
      leadId: input.leadId,
      eventType: "opportunity_signal_timeline_recorded",
      title: "Opportunity signals recorded",
      summary: `${signals.length} evidence-backed signal(s) from reply.`,
      outboundReplyId: input.replyId,
      payload: { signal_types: signals.map((s) => s.signalType) },
    }).catch(() => undefined)
  }

  const { count: outboundCount } = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", input.leadId)

  const committeeMap = await persistBuyingCommitteeMap(admin, {
    leadId: input.leadId,
    companyLabel: input.companyName ?? "Account",
    bodyPreview: input.bodyPreview,
    signals,
  })

  const { data: priorMomentum } = await admin
    .schema("growth")
    .from("buying_momentum_snapshots")
    .select("momentum_score")
    .eq("lead_id", input.leadId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const momentum = computeBuyingMomentum({
    threadReplyCount: input.threadReplyCount,
    responseLatencyMs: input.responseLatencyMs,
    buyingSignalCount: input.buyingSignals.length,
    objectionCount: input.objections.length,
    resolvedObjectionCount: 0,
    outboundMessageCount: outboundCount ?? 0,
    stakeholderCount: committeeMap.stakeholderCount,
    priorMomentumScore: (priorMomentum as { momentum_score?: number } | null)?.momentum_score ?? null,
  })

  await persistBuyingMomentum(admin, {
    leadId: input.leadId,
    momentum,
    stakeholderCount: committeeMap.stakeholderCount,
  })

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "buying_momentum_updated",
    title: "Buying momentum updated",
    summary: `Momentum ${momentum.momentumScore}/100 (${momentum.momentumTrend}).`,
    outboundReplyId: input.replyId,
    payload: { explainability: momentum.explainability },
  }).catch(() => undefined)

  const copilot = buildRevenueIntelligenceCopilot({
    companyLabel: input.companyName ?? "Account",
    momentum,
    signals,
    objectionCategories: input.objections.map((o) => o.category),
    committeeCompleteness: committeeMap.completenessScore,
    missingStakeholders: committeeMap.missingStakeholderSuggestions,
    recommendedOperatorAction: input.recommendedOperatorAction,
  })

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "revenue_intelligence_copilot_assisted",
    title: "Revenue intelligence copilot",
    summary: copilot.accountSummary,
    outboundReplyId: input.replyId,
    payload: { assisted_label: copilot.assistedLabel, suggested_next: copilot.suggestedNextAction },
  }).catch(() => undefined)

  await recordCampaignRevenueAttribution(admin, {
    leadId: input.leadId,
    campaignId: input.campaignId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    classification: input.classification,
    signals,
  }).catch(() => undefined)

  const insights = await computeGlobalSalesExecutionInsights(admin).catch(() => null)
  if (insights) {
    await upsertSalesExecutionInsightSnapshot(admin, { scopeType: "global", insights }).catch(() => undefined)
  }

  return {
    signalCount: signals.length,
    momentumScore: momentum.momentumScore,
    momentumTrend: momentum.momentumTrend,
  }
}
