/** GE-AIOS-15B — Canonical Sales relationship graph (client-safe). */

import type { GrowthRelationshipStage } from "@/lib/growth/lead-memory/memory-types"
import type { AvaSpecialistId } from "@/lib/growth/specialists/types"

export const GROWTH_RELATIONSHIP_GRAPH_QA_MARKER = "ge-aios-15b-relationship-graph-v1" as const
export const GROWTH_RELATIONSHIP_GRAPH_15D_QA_MARKER =
  "ge-aios-15d-relationship-stage-conversation-v1" as const

/**
 * Canonical relationship context carried on work items.
 * `growth.leads` is the relationship workspace; graph refs are projections, not duplicates.
 */
export type AvaRelationshipGraphContext = {
  qa_marker: typeof GROWTH_RELATIONSHIP_GRAPH_QA_MARKER
  organization_id?: string | null
  lead_id: string | null
  canonical_company_id: string | null
  company_id: string | null
  person_id: string | null
  committee_role: string | null
  relationship_stage: GrowthRelationshipStage | null
  relationship_health: string | null
  relationship_strength_tier: string | null
  last_meaningful_touch_at: string | null
  next_touch_at: string | null
  follow_up_due_at: string | null
  conversation_thread_id: string | null
  latest_conversation_thread_id: string | null
  latest_conversation_status: string | null
  latest_reply_at: string | null
  latest_reply_sentiment: string | null
  conversation_timeline_summary: string | null
  waiting_on_operator: boolean
  waiting_on_customer: boolean
  blocked_reason: string | null
  next_best_action: string | null
  next_best_action_reason: string | null
  opportunity_id: string | null
  next_best_action_id: string | null
  assigned_specialist: AvaSpecialistId | null
  decision_score: number | null
  memory_context_available: boolean
  business_intelligence_context_available: boolean
  relationship_state_qa_marker?: typeof GROWTH_RELATIONSHIP_GRAPH_15D_QA_MARKER | null
}

export type RelationshipGraphBindingInput = {
  organization_id?: string | null
  lead_id?: string | null
  canonical_company_id?: string | null
  company_id?: string | null
  person_id?: string | null
  committee_role?: string | null
  relationship_stage?: GrowthRelationshipStage | null
  relationship_health?: string | null
  relationship_strength_tier?: string | null
  last_meaningful_touch_at?: string | null
  next_touch_at?: string | null
  follow_up_due_at?: string | null
  conversation_thread_id?: string | null
  latest_conversation_thread_id?: string | null
  latest_conversation_status?: string | null
  latest_reply_at?: string | null
  latest_reply_sentiment?: string | null
  conversation_timeline_summary?: string | null
  waiting_on_operator?: boolean
  waiting_on_customer?: boolean
  blocked_reason?: string | null
  next_best_action?: string | null
  next_best_action_reason?: string | null
  opportunity_id?: string | null
  next_best_action_id?: string | null
  assigned_specialist?: AvaSpecialistId | null
  decision_score?: number | null
  memory_context_available?: boolean
  business_intelligence_context_available?: boolean
  relationship_state_qa_marker?: typeof GROWTH_RELATIONSHIP_GRAPH_15D_QA_MARKER | null
}

function hasRelationshipStateProjection(input: RelationshipGraphBindingInput): boolean {
  return Boolean(
    input.relationship_stage ||
      input.relationship_health ||
      input.latest_conversation_thread_id ||
      input.conversation_thread_id ||
      input.latest_reply_at ||
      input.conversation_timeline_summary ||
      input.next_best_action ||
      input.waiting_on_operator ||
      input.waiting_on_customer,
  )
}

export function buildRelationshipGraphContext(
  input: RelationshipGraphBindingInput,
): AvaRelationshipGraphContext {
  const latestThreadId = input.latest_conversation_thread_id ?? input.conversation_thread_id ?? null
  return {
    qa_marker: GROWTH_RELATIONSHIP_GRAPH_QA_MARKER,
    organization_id: input.organization_id ?? null,
    lead_id: input.lead_id ?? null,
    canonical_company_id: input.canonical_company_id ?? null,
    company_id: input.company_id ?? null,
    person_id: input.person_id ?? null,
    committee_role: input.committee_role ?? null,
    relationship_stage: input.relationship_stage ?? null,
    relationship_health: input.relationship_health ?? null,
    relationship_strength_tier: input.relationship_strength_tier ?? null,
    last_meaningful_touch_at: input.last_meaningful_touch_at ?? null,
    next_touch_at: input.next_touch_at ?? null,
    follow_up_due_at: input.follow_up_due_at ?? null,
    conversation_thread_id: latestThreadId,
    latest_conversation_thread_id: latestThreadId,
    latest_conversation_status: input.latest_conversation_status ?? null,
    latest_reply_at: input.latest_reply_at ?? null,
    latest_reply_sentiment: input.latest_reply_sentiment ?? null,
    conversation_timeline_summary: input.conversation_timeline_summary ?? null,
    waiting_on_operator: input.waiting_on_operator ?? false,
    waiting_on_customer: input.waiting_on_customer ?? false,
    blocked_reason: input.blocked_reason ?? null,
    next_best_action: input.next_best_action ?? null,
    next_best_action_reason: input.next_best_action_reason ?? null,
    opportunity_id: input.opportunity_id ?? null,
    next_best_action_id: input.next_best_action_id ?? null,
    assigned_specialist: input.assigned_specialist ?? null,
    decision_score: input.decision_score ?? null,
    memory_context_available: input.memory_context_available ?? false,
    business_intelligence_context_available: input.business_intelligence_context_available ?? false,
    relationship_state_qa_marker: hasRelationshipStateProjection(input)
      ? GROWTH_RELATIONSHIP_GRAPH_15D_QA_MARKER
      : null,
  }
}

export function hasRelationshipGraphBinding(context: AvaRelationshipGraphContext | null | undefined): boolean {
  if (!context) return false
  return Boolean(
    context.lead_id ||
      context.canonical_company_id ||
      context.person_id ||
      context.conversation_thread_id,
  )
}
