/** GE-AIOS-15D/15E — Pure snapshot projection helpers (client-safe). */

import type { GrowthRelationshipStage } from "@/lib/growth/lead-memory/memory-types"
import { GROWTH_RELATIONSHIP_STAGES } from "@/lib/growth/lead-memory/memory-types"
import {
  GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
  type RelationshipLeadSnapshot,
} from "@/lib/growth/relationship/relationship-lead-snapshot-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRelationshipStage(value: unknown): GrowthRelationshipStage | null {
  const normalized = asString(value)
  return (GROWTH_RELATIONSHIP_STAGES as readonly string[]).includes(normalized)
    ? (normalized as GrowthRelationshipStage)
    : null
}

export function readCanonicalCompanyIdFromLeadMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null
  return asString((metadata as Record<string, unknown>).canonical_company_id) || null
}

export type RelationshipLeadStateSourceRow = {
  id: string
  metadata?: Record<string, unknown> | null
  relationshipStrengthTier?: string | null
  relationshipLastMeaningfulTouchAt?: string | null
  followUpAt?: string | null
  nextBestAction?: string | null
  nextBestActionReason?: string | null
  workflowHealth?: string | null
  workflowHealthReason?: string | null
  relationshipSummary?: string | null
  conversationSummary?: string | null
  conversationSentiment?: string | null
  conversationLastMeaningfulConversationAt?: string | null
}

export function projectRelationshipStateSnapshot(input: {
  lead: RelationshipLeadStateSourceRow
  profile?: Record<string, unknown> | null
  relationshipContext?: Record<string, unknown> | null
}): RelationshipLeadSnapshot {
  const lead = input.lead
  const profile = input.profile ?? null
  const relationship = input.relationshipContext ?? null

  const relationshipStage =
    asRelationshipStage(profile?.relationship_stage) ??
    asRelationshipStage(relationship?.relationship_stage) ??
    null

  const relationshipHealth =
    asString(lead.relationshipSummary) ||
    asString(lead.workflowHealth) ||
    asString(profile?.summary) ||
    null

  const workflowHealth = asString(lead.workflowHealth)
  const nextBestAction = asString(lead.nextBestAction)
  const waitingOnOperator =
    workflowHealth === "blocked" ||
    workflowHealth === "waiting_on_operator" ||
    nextBestAction.includes("approve")

  return {
    qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
    lead_id: lead.id,
    canonical_company_id: readCanonicalCompanyIdFromLeadMetadata(lead.metadata),
    relationship_stage: relationshipStage,
    relationship_health: relationshipHealth,
    relationship_strength_tier: asString(lead.relationshipStrengthTier) || null,
    last_meaningful_touch_at:
      asString(lead.relationshipLastMeaningfulTouchAt) ||
      asString(lead.conversationLastMeaningfulConversationAt) ||
      null,
    next_touch_at: asString(lead.followUpAt) || null,
    follow_up_due_at: asString(lead.followUpAt) || null,
    waiting_on_operator: waitingOnOperator,
    waiting_on_customer: workflowHealth === "waiting_on_customer",
    blocked_reason: asString(lead.workflowHealthReason) || null,
    next_best_action: nextBestAction || null,
    next_best_action_reason: asString(lead.nextBestActionReason) || null,
    memory_context_available: Boolean(profile),
    conversation_context_available: Boolean(asString(lead.conversationSummary)),
  }
}

const TIMELINE_SUMMARY_LIMIT = 3 as const

export function buildConversationTimelineSummary(
  entries: Array<{ title: string; summary: string }>,
): string | null {
  if (entries.length === 0) return null
  return entries
    .slice(0, TIMELINE_SUMMARY_LIMIT)
    .map((entry) => {
      const summary = entry.summary.trim() || entry.title.trim()
      return summary ? summary.replace(/\.$/, "") : null
    })
    .filter(Boolean)
    .join(" · ")
}

export function projectRelationshipConversationSnapshot(input: {
  leadId: string
  thread?: Record<string, unknown> | null
  reply?: Record<string, unknown> | null
  timelineEntries?: Array<{ title: string; summary: string }>
  conversationSummary?: string | null
  conversationSentiment?: string | null
  conversationLastMeaningfulAt?: string | null
}): Partial<RelationshipLeadSnapshot> {
  const latestReplyAt =
    asString(input.reply?.received_at) || asString(input.conversationLastMeaningfulAt) || null

  const latestReplySentiment =
    asString(input.reply?.intent) || asString(input.conversationSentiment) || null

  const conversationTimelineSummary =
    asString(input.conversationSummary) ||
    buildConversationTimelineSummary(input.timelineEntries ?? []) ||
    null

  const threadStatus = asString(input.thread?.thread_status)
  const waitingOnCustomer = threadStatus === "waiting"
  const waitingOnOperator = threadStatus === "needs_review" || threadStatus === "open"

  return {
    latest_conversation_thread_id: asString(input.thread?.id) || null,
    latest_conversation_status: threadStatus || null,
    latest_reply_at: latestReplyAt,
    latest_reply_sentiment: latestReplySentiment,
    conversation_timeline_summary: conversationTimelineSummary,
    next_touch_at: asString(input.thread?.sla_due_at) || null,
    follow_up_due_at: asString(input.thread?.sla_due_at) || null,
    waiting_on_customer: waitingOnCustomer,
    waiting_on_operator: waitingOnOperator,
    conversation_context_available: Boolean(
      input.thread || input.reply || (input.timelineEntries?.length ?? 0) > 0 || conversationTimelineSummary,
    ),
  }
}

export function mergeRelationshipLeadSnapshotParts(
  state: RelationshipLeadSnapshot,
  conversation: Partial<RelationshipLeadSnapshot>,
): RelationshipLeadSnapshot {
  return {
    ...state,
    ...conversation,
    lead_id: state.lead_id,
    qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
    waiting_on_operator: state.waiting_on_operator || conversation.waiting_on_operator === true,
    waiting_on_customer: state.waiting_on_customer || conversation.waiting_on_customer === true,
    last_meaningful_touch_at:
      state.last_meaningful_touch_at || conversation.latest_reply_at || null,
    next_touch_at: conversation.next_touch_at ?? state.next_touch_at ?? null,
    follow_up_due_at: conversation.follow_up_due_at ?? state.follow_up_due_at ?? null,
    memory_context_available: state.memory_context_available,
    conversation_context_available: conversation.conversation_context_available ?? state.conversation_context_available,
  }
}

export function compactRelationshipLeadSnapshot(
  snapshot: RelationshipLeadSnapshot,
): RelationshipLeadSnapshot {
  const compact: RelationshipLeadSnapshot = {
    qa_marker: snapshot.qa_marker,
    lead_id: snapshot.lead_id,
  }

  const optionalKeys = [
    "canonical_company_id",
    "relationship_stage",
    "relationship_health",
    "relationship_strength_tier",
    "last_meaningful_touch_at",
    "next_touch_at",
    "follow_up_due_at",
    "latest_conversation_thread_id",
    "latest_conversation_status",
    "latest_reply_at",
    "latest_reply_sentiment",
    "conversation_timeline_summary",
    "blocked_reason",
    "next_best_action",
    "next_best_action_reason",
  ] as const

  for (const key of optionalKeys) {
    const value = snapshot[key]
    if (value != null && value !== "" && value !== false) {
      ;(compact as Record<string, unknown>)[key] = value
    }
  }

  if (snapshot.waiting_on_operator) compact.waiting_on_operator = true
  if (snapshot.waiting_on_customer) compact.waiting_on_customer = true
  if (snapshot.memory_context_available) compact.memory_context_available = true
  if (snapshot.conversation_context_available) compact.conversation_context_available = true

  return compact
}

export function hasRelationshipSnapshotSignal(snapshot: RelationshipLeadSnapshot): boolean {
  return Boolean(
    snapshot.relationship_stage ||
      snapshot.relationship_health ||
      snapshot.latest_conversation_thread_id ||
      snapshot.latest_reply_at ||
      snapshot.next_best_action ||
      snapshot.waiting_on_operator ||
      snapshot.waiting_on_customer ||
      snapshot.conversation_timeline_summary,
  )
}
