/** GE-AIOS-15D — Project persisted relationship snapshot onto graph context (client-safe). */

import type { GrowthAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { GrowthRelationshipStage } from "@/lib/growth/lead-memory/memory-types"
import {
  GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
  type RelationshipLeadSnapshot,
  type RelationshipLeadSnapshotMap,
} from "@/lib/growth/relationship/relationship-lead-snapshot-types"
import {
  buildRelationshipGraphContext,
  type AvaRelationshipGraphContext,
  type RelationshipGraphBindingInput,
} from "@/lib/growth/relationship/relationship-graph-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function relationshipSnapshotToGraphBinding(
  snapshot: RelationshipLeadSnapshot,
): RelationshipGraphBindingInput {
  return {
    lead_id: snapshot.lead_id,
    canonical_company_id: snapshot.canonical_company_id ?? null,
    relationship_stage: snapshot.relationship_stage ?? null,
    relationship_health: snapshot.relationship_health ?? null,
    relationship_strength_tier: snapshot.relationship_strength_tier ?? null,
    last_meaningful_touch_at: snapshot.last_meaningful_touch_at ?? null,
    next_touch_at: snapshot.next_touch_at ?? null,
    follow_up_due_at: snapshot.follow_up_due_at ?? null,
    latest_conversation_thread_id: snapshot.latest_conversation_thread_id ?? null,
    latest_conversation_status: snapshot.latest_conversation_status ?? null,
    latest_reply_at: snapshot.latest_reply_at ?? null,
    latest_reply_sentiment: snapshot.latest_reply_sentiment ?? null,
    conversation_timeline_summary: snapshot.conversation_timeline_summary ?? null,
    waiting_on_operator: snapshot.waiting_on_operator ?? false,
    waiting_on_customer: snapshot.waiting_on_customer ?? false,
    blocked_reason: snapshot.blocked_reason ?? null,
    next_best_action: snapshot.next_best_action ?? null,
    next_best_action_reason: snapshot.next_best_action_reason ?? null,
    memory_context_available: snapshot.memory_context_available ?? false,
    business_intelligence_context_available: Boolean(snapshot.canonical_company_id),
  }
}

export function enrichRelationshipGraphWithSnapshot(
  base: AvaRelationshipGraphContext,
  snapshot?: RelationshipLeadSnapshot | null,
): AvaRelationshipGraphContext {
  if (!snapshot) return base

  const projected = buildRelationshipGraphContext({
    ...relationshipSnapshotToGraphBinding(snapshot),
    lead_id: base.lead_id ?? snapshot.lead_id,
    canonical_company_id: base.canonical_company_id ?? snapshot.canonical_company_id ?? null,
    company_id: base.company_id,
    person_id: base.person_id,
    committee_role: base.committee_role,
    relationship_stage: snapshot.relationship_stage ?? base.relationship_stage,
    relationship_health: snapshot.relationship_health ?? base.relationship_health,
    relationship_strength_tier: snapshot.relationship_strength_tier ?? base.relationship_strength_tier,
    last_meaningful_touch_at:
      snapshot.last_meaningful_touch_at ?? base.last_meaningful_touch_at,
    next_touch_at: snapshot.next_touch_at ?? base.next_touch_at,
    follow_up_due_at: snapshot.follow_up_due_at ?? base.follow_up_due_at,
    latest_conversation_thread_id:
      snapshot.latest_conversation_thread_id ??
      base.latest_conversation_thread_id ??
      base.conversation_thread_id,
    latest_conversation_status:
      snapshot.latest_conversation_status ?? base.latest_conversation_status,
    latest_reply_at: snapshot.latest_reply_at ?? base.latest_reply_at,
    latest_reply_sentiment: snapshot.latest_reply_sentiment ?? base.latest_reply_sentiment,
    conversation_timeline_summary:
      snapshot.conversation_timeline_summary ?? base.conversation_timeline_summary,
    waiting_on_operator: snapshot.waiting_on_operator ?? base.waiting_on_operator,
    waiting_on_customer: snapshot.waiting_on_customer ?? base.waiting_on_customer,
    blocked_reason: snapshot.blocked_reason ?? base.blocked_reason,
    next_best_action: snapshot.next_best_action ?? base.next_best_action,
    next_best_action_reason: snapshot.next_best_action_reason ?? base.next_best_action_reason,
    conversation_thread_id:
      snapshot.latest_conversation_thread_id ??
      base.latest_conversation_thread_id ??
      base.conversation_thread_id,
    opportunity_id: base.opportunity_id,
    next_best_action_id: base.next_best_action_id,
    assigned_specialist: base.assigned_specialist,
    decision_score: base.decision_score,
    memory_context_available:
      snapshot.memory_context_available ?? base.memory_context_available,
    business_intelligence_context_available:
      base.business_intelligence_context_available ||
      Boolean(snapshot.canonical_company_id),
  })

  return {
    ...base,
    ...projected,
    qa_marker: base.qa_marker,
    organization_id: base.organization_id ?? projected.organization_id,
    person_id: base.person_id ?? projected.person_id,
    committee_role: base.committee_role ?? projected.committee_role,
    decision_score: base.decision_score ?? projected.decision_score,
    next_best_action_id: base.next_best_action_id ?? projected.next_best_action_id,
    assigned_specialist: base.assigned_specialist ?? projected.assigned_specialist,
  }
}

function inferStageFromResearchRow(row: NonNullable<GrowthAvaResearchLoopSummary["leadResults"]>[number]): GrowthRelationshipStage {
  if (row.readyForOutreachReview) return "evaluating"
  if (row.qualificationStatus === "completed") return "engaged"
  if (row.hasBuyingSignals) return "engaged"
  if (row.outcome === "completed") return "aware"
  return "unknown"
}

/** Lightweight client projections from Ava research loop (no DB). */
export function buildRelationshipLeadSnapshotsFromResearchLoop(
  research: GrowthAvaResearchLoopSummary | null | undefined,
): RelationshipLeadSnapshotMap {
  const map: RelationshipLeadSnapshotMap = {}
  if (!research?.leadResults?.length) return map

  for (const row of research.leadResults) {
    const leadId = asString(row.leadId)
    if (!leadId) continue

    const stage = inferStageFromResearchRow(row)
    map[leadId] = {
      qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
      lead_id: leadId,
      relationship_stage: stage,
      relationship_health: row.readyForOutreachReview ? "ready_for_outreach_review" : null,
      waiting_on_operator: row.readyForOutreachReview === true,
      blocked_reason: row.readyForOutreachReview ? "operator_approval" : null,
      next_best_action: row.readyForOutreachReview
        ? "approve_outreach"
        : row.qualificationStatus === "completed"
          ? "continue_qualification"
          : "research_company",
      next_best_action_reason: row.skipReason ?? null,
      memory_context_available: false,
      conversation_context_available: false,
    }
  }

  return map
}

export function mergeRelationshipLeadSnapshotMaps(
  ...maps: Array<RelationshipLeadSnapshotMap | undefined | null>
): RelationshipLeadSnapshotMap {
  const merged: RelationshipLeadSnapshotMap = {}
  for (const map of maps) {
    if (!map) continue
    for (const [leadId, snapshot] of Object.entries(map)) {
      merged[leadId] = merged[leadId]
        ? {
            ...merged[leadId]!,
            ...snapshot,
            lead_id: leadId,
            qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
          }
        : snapshot
    }
  }
  return merged
}
