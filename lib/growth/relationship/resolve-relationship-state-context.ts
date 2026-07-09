/**
 * GE-AIOS-15D — Read persisted relationship state for graph projection (server-only).
 * Does not recompute scoring engines — reads existing persisted columns only.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
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

function readCanonicalCompanyId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null
  return asString((metadata as Record<string, unknown>).canonical_company_id) || null
}

export async function resolveRelationshipStateContext(
  admin: SupabaseClient,
  leadId: string,
): Promise<RelationshipLeadSnapshot | null> {
  const id = asString(leadId)
  if (!id) return null

  const [leadRes, profileRes, relationshipRes] = await Promise.all([
    admin
      .schema("growth")
      .from("leads")
      .select(
        "id, metadata, relationship_strength_tier, relationship_last_meaningful_touch_at, follow_up_at, next_best_action, next_best_action_reason, workflow_health, workflow_health_reason, relationship_summary, conversation_summary, conversation_sentiment, conversation_last_meaningful_conversation_at",
      )
      .eq("id", id)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("lead_memory_profiles")
      .select("relationship_stage, summary, memory_coverage_score")
      .eq("lead_id", id)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("relationship_context")
      .select("relationship_stage, engagement_trend, progression_score, risk_flags")
      .eq("lead_id", id)
      .maybeSingle(),
  ])

  if (leadRes.error) throw new Error(leadRes.error.message)
  if (!leadRes.data) return null

  const lead = leadRes.data as Record<string, unknown>
  const profile = (profileRes.data as Record<string, unknown> | null) ?? null
  const relationship = (relationshipRes.data as Record<string, unknown> | null) ?? null

  const relationshipStage =
    asRelationshipStage(profile?.relationship_stage) ??
    asRelationshipStage(relationship?.relationship_stage) ??
    null

  const relationshipHealth =
    asString(lead.relationship_summary) ||
    asString(lead.workflow_health) ||
    asString(profile?.summary) ||
    null

  const workflowHealth = asString(lead.workflow_health)
  const waitingOnOperator =
    workflowHealth === "blocked" ||
    workflowHealth === "waiting_on_operator" ||
    asString(lead.next_best_action).includes("approve")

  return {
    qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
    lead_id: id,
    canonical_company_id: readCanonicalCompanyId(lead.metadata),
    relationship_stage: relationshipStage,
    relationship_health: relationshipHealth,
    relationship_strength_tier: asString(lead.relationship_strength_tier) || null,
    last_meaningful_touch_at:
      asString(lead.relationship_last_meaningful_touch_at) ||
      asString(lead.conversation_last_meaningful_conversation_at) ||
      null,
    next_touch_at: asString(lead.follow_up_at) || null,
    follow_up_due_at: asString(lead.follow_up_at) || null,
    waiting_on_operator: waitingOnOperator,
    waiting_on_customer: workflowHealth === "waiting_on_customer",
    blocked_reason: asString(lead.workflow_health_reason) || null,
    next_best_action: asString(lead.next_best_action) || null,
    next_best_action_reason: asString(lead.next_best_action_reason) || null,
    memory_context_available: Boolean(profile),
    conversation_context_available: Boolean(asString(lead.conversation_summary)),
  }
}
