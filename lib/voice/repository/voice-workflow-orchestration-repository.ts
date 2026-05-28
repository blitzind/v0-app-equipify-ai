import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceWorkflowOrchestrationEventPublicView,
  VoiceWorkflowOrchestrationEventType,
  VoiceWorkflowOrchestrationPublicView,
  VoiceWorkflowOrchestrationStatus,
  VoiceWorkflowOrchestrationType,
} from "@/lib/voice/workflow-orchestration/types"

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

type OrchestrationRow = {
  id: string
  organization_id: string
  orchestration_type: VoiceWorkflowOrchestrationType
  orchestration_status: VoiceWorkflowOrchestrationStatus
  priority: number
  source_session_id: string | null
  source_call_id: string | null
  source_campaign_id: string | null
  relationship_memory_profile_id: string | null
  related_customer_id: string | null
  related_prospect_id: string | null
  related_opportunity_id: string | null
  assigned_operator_id: string | null
  escalation_level: number
  compliance_state: string | null
  next_recommended_action: string | null
  blocked_reason: string | null
  orchestration_summary: string
  metadata_json: Record<string, unknown> | unknown
  created_at: string
  updated_at: string
  resolved_at: string | null
}

type EventRow = {
  id: string
  organization_id: string
  orchestration_id: string
  event_type: VoiceWorkflowOrchestrationEventType
  source_system: string
  evidence_text: string
  linked_session_id: string | null
  linked_call_id: string | null
  payload_json: Record<string, unknown> | unknown
  created_by: string | null
  created_at: string
}

function mapOrchestration(row: OrchestrationRow): VoiceWorkflowOrchestrationPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    orchestrationType: row.orchestration_type,
    orchestrationStatus: row.orchestration_status,
    priority: row.priority,
    sourceSessionId: row.source_session_id,
    sourceCallId: row.source_call_id,
    sourceCampaignId: row.source_campaign_id,
    relationshipMemoryProfileId: row.relationship_memory_profile_id,
    relatedCustomerId: row.related_customer_id,
    relatedProspectId: row.related_prospect_id,
    relatedOpportunityId: row.related_opportunity_id,
    assignedOperatorId: row.assigned_operator_id,
    escalationLevel: row.escalation_level,
    complianceState: row.compliance_state,
    nextRecommendedAction: row.next_recommended_action,
    blockedReason: row.blocked_reason,
    orchestrationSummary: row.orchestration_summary,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  }
}

function mapEvent(row: EventRow): VoiceWorkflowOrchestrationEventPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    orchestrationId: row.orchestration_id,
    eventType: row.event_type,
    sourceSystem: row.source_system,
    evidenceText: row.evidence_text,
    linkedSessionId: row.linked_session_id,
    linkedCallId: row.linked_call_id,
    payload:
      row.payload_json && typeof row.payload_json === "object"
        ? (row.payload_json as Record<string, unknown>)
        : {},
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

const ACTIVE_STATUSES: VoiceWorkflowOrchestrationStatus[] = [
  "pending",
  "active",
  "awaiting_operator",
  "awaiting_customer",
  "compliance_hold",
  "escalated",
  "blocked",
]

export async function createWorkflowOrchestration(
  admin: SupabaseClient,
  input: {
    organizationId: string
    orchestrationType: VoiceWorkflowOrchestrationType
    priority?: number
    sourceSessionId?: string | null
    sourceCallId?: string | null
    sourceCampaignId?: string | null
    relationshipMemoryProfileId?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relatedOpportunityId?: string | null
    orchestrationSummary?: string
    nextRecommendedAction?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<VoiceWorkflowOrchestrationPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_workflow_orchestrations")
    .insert({
      organization_id: input.organizationId,
      orchestration_type: input.orchestrationType,
      priority: input.priority ?? 50,
      source_session_id: input.sourceSessionId ?? null,
      source_call_id: input.sourceCallId ?? null,
      source_campaign_id: input.sourceCampaignId ?? null,
      relationship_memory_profile_id: input.relationshipMemoryProfileId ?? null,
      related_customer_id: input.relatedCustomerId ?? null,
      related_prospect_id: input.relatedProspectId ?? null,
      related_opportunity_id: input.relatedOpportunityId ?? null,
      orchestration_summary: input.orchestrationSummary ?? "",
      next_recommended_action: input.nextRecommendedAction ?? null,
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapOrchestration(data as OrchestrationRow)
}

export async function getWorkflowOrchestration(
  admin: SupabaseClient,
  organizationId: string,
  orchestrationId: string,
): Promise<VoiceWorkflowOrchestrationPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_workflow_orchestrations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", orchestrationId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapOrchestration(data as OrchestrationRow) : null
}

export async function updateWorkflowOrchestration(
  admin: SupabaseClient,
  input: {
    organizationId: string
    orchestrationId: string
    patch: Partial<{
      orchestrationStatus: VoiceWorkflowOrchestrationStatus
      assignedOperatorId: string | null
      escalationLevel: number
      complianceState: string | null
      nextRecommendedAction: string | null
      blockedReason: string | null
      orchestrationSummary: string
      resolvedAt: string | null
      metadata: Record<string, unknown>
    }>
  },
): Promise<VoiceWorkflowOrchestrationPublicView | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.patch.orchestrationStatus) update.orchestration_status = input.patch.orchestrationStatus
  if (input.patch.assignedOperatorId !== undefined) update.assigned_operator_id = input.patch.assignedOperatorId
  if (input.patch.escalationLevel !== undefined) update.escalation_level = input.patch.escalationLevel
  if (input.patch.complianceState !== undefined) update.compliance_state = input.patch.complianceState
  if (input.patch.nextRecommendedAction !== undefined) update.next_recommended_action = input.patch.nextRecommendedAction
  if (input.patch.blockedReason !== undefined) update.blocked_reason = input.patch.blockedReason
  if (input.patch.orchestrationSummary) update.orchestration_summary = input.patch.orchestrationSummary
  if (input.patch.resolvedAt !== undefined) update.resolved_at = input.patch.resolvedAt
  if (input.patch.metadata) update.metadata_json = input.patch.metadata

  const { data, error } = await admin
    .schema("voice")
    .from("voice_workflow_orchestrations")
    .update(update)
    .eq("organization_id", input.organizationId)
    .eq("id", input.orchestrationId)
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapOrchestration(data as OrchestrationRow) : null
}

export async function listActiveWorkflowOrchestrations(
  admin: SupabaseClient,
  organizationId: string,
  limit = 100,
): Promise<VoiceWorkflowOrchestrationPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_workflow_orchestrations")
    .select("*")
    .eq("organization_id", organizationId)
    .in("orchestration_status", ACTIVE_STATUSES)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapOrchestration(row as OrchestrationRow))
}

export async function appendWorkflowOrchestrationEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    orchestrationId: string
    eventType: VoiceWorkflowOrchestrationEventType
    sourceSystem?: string
    evidenceText: string
    linkedSessionId?: string | null
    linkedCallId?: string | null
    payload?: Record<string, unknown>
    createdBy?: string | null
  },
): Promise<VoiceWorkflowOrchestrationEventPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_workflow_orchestration_events")
    .insert({
      organization_id: input.organizationId,
      orchestration_id: input.orchestrationId,
      event_type: input.eventType,
      source_system: input.sourceSystem ?? "workflow_orchestration",
      evidence_text: input.evidenceText,
      linked_session_id: input.linkedSessionId ?? null,
      linked_call_id: input.linkedCallId ?? null,
      payload_json: input.payload ?? {},
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapEvent(data as EventRow)
}

export async function listWorkflowOrchestrationEvents(
  admin: SupabaseClient,
  organizationId: string,
  orchestrationId: string,
  limit = 50,
): Promise<VoiceWorkflowOrchestrationEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_workflow_orchestration_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("orchestration_id", orchestrationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export async function listRecentWorkflowOrchestrationEvents(
  admin: SupabaseClient,
  organizationId: string,
  limit = 30,
): Promise<VoiceWorkflowOrchestrationEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_workflow_orchestration_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export async function expireStaleWorkflowOrchestrations(
  admin: SupabaseClient,
  organizationId: string,
  staleBeforeIso: string,
): Promise<number> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_workflow_orchestrations")
    .update({
      orchestration_status: "expired",
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .in("orchestration_status", ACTIVE_STATUSES)
    .is("resolved_at", null)
    .lt("updated_at", staleBeforeIso)
    .select("id")

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return data?.length ?? 0
}

export async function countOperatorActiveWorkflows(
  admin: SupabaseClient,
  organizationId: string,
  operatorId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_workflow_orchestrations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("assigned_operator_id", operatorId)
    .in("orchestration_status", ["active", "escalated", "awaiting_customer"])

  if (error) return 0
  return count ?? 0
}
