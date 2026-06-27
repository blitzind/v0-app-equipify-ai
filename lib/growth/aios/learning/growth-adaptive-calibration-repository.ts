/** GE-AI-3D-PROD-2 — Adaptive calibration repository (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_ADAPTIVE_CALIBRATION_PROPOSAL_TYPES,
  GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
  GROWTH_ADAPTIVE_CALIBRATION_RISK_LEVELS,
  GROWTH_ADAPTIVE_CALIBRATION_STATUSES,
  GROWTH_ADAPTIVE_CALIBRATION_TARGET_SYSTEMS,
  type GrowthAdaptiveCalibrationProposal,
  type GrowthAdaptiveCalibrationProposalType,
  type GrowthAdaptiveCalibrationRiskLevel,
  type GrowthAdaptiveCalibrationStatus,
  type GrowthAdaptiveCalibrationTargetSystem,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"

type ProposalRow = {
  id: string
  organization_id: string
  source_insight_id: string
  target_system: string
  proposal_type: string
  status: string
  title: string
  summary: string
  proposed_change: Record<string, unknown> | null
  evidence: unknown
  confidence: number
  impact: number
  sample_size: number
  risk_level: string
  requires_operator_approval: boolean
  approved_by_user_id: string | null
  approved_at: string | null
  rejected_by_user_id: string | null
  rejected_at: string | null
  rejection_reason: string | null
  idempotency_key: string
  expires_at: string | null
  created_at: string
}

const PROPOSAL_SELECT =
  "id, organization_id, source_insight_id, target_system, proposal_type, status, title, summary, proposed_change, evidence, confidence, impact, sample_size, risk_level, requires_operator_approval, approved_by_user_id, approved_at, rejected_by_user_id, rejected_at, rejection_reason, idempotency_key, expires_at, created_at"

function proposalsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("adaptive_calibration_proposals")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("adaptive_calibration_events")
}

function isTargetSystem(value: string): value is GrowthAdaptiveCalibrationTargetSystem {
  return (GROWTH_ADAPTIVE_CALIBRATION_TARGET_SYSTEMS as readonly string[]).includes(value)
}

function isProposalType(value: string): value is GrowthAdaptiveCalibrationProposalType {
  return (GROWTH_ADAPTIVE_CALIBRATION_PROPOSAL_TYPES as readonly string[]).includes(value)
}

function isStatus(value: string): value is GrowthAdaptiveCalibrationStatus {
  return (GROWTH_ADAPTIVE_CALIBRATION_STATUSES as readonly string[]).includes(value)
}

function isRiskLevel(value: string): value is GrowthAdaptiveCalibrationRiskLevel {
  return (GROWTH_ADAPTIVE_CALIBRATION_RISK_LEVELS as readonly string[]).includes(value)
}

export function mapAdaptiveCalibrationProposalRow(row: ProposalRow): GrowthAdaptiveCalibrationProposal {
  const proposedChange = (row.proposed_change ?? {}) as GrowthAdaptiveCalibrationProposal["proposedChange"]
  const evidence = Array.isArray(row.evidence)
    ? (row.evidence as GrowthAdaptiveCalibrationProposal["evidence"])
    : []

  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceInsightId: row.source_insight_id,
    targetSystem: isTargetSystem(row.target_system) ? row.target_system : "communication_engine",
    proposalType: isProposalType(row.proposal_type) ? row.proposal_type : "monitor_only",
    status: isStatus(row.status) ? row.status : "proposed",
    title: row.title,
    summary: row.summary,
    proposedChange,
    evidence,
    confidence: Number(row.confidence),
    impact: Number(row.impact),
    sampleSize: row.sample_size,
    riskLevel: isRiskLevel(row.risk_level) ? row.risk_level : "medium",
    review: {
      requiresOperatorApproval: row.requires_operator_approval,
      approvedByUserId: row.approved_by_user_id ?? undefined,
      approvedAt: row.approved_at ?? undefined,
      rejectedByUserId: row.rejected_by_user_id ?? undefined,
      rejectedAt: row.rejected_at ?? undefined,
      rejectionReason: row.rejection_reason ?? undefined,
    },
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? undefined,
  }
}

export async function fetchAdaptiveCalibrationProposalById(
  admin: SupabaseClient,
  input: { organizationId: string; proposalId: string },
): Promise<GrowthAdaptiveCalibrationProposal | null> {
  const { data, error } = await proposalsTable(admin)
    .select(PROPOSAL_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("id", input.proposalId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapAdaptiveCalibrationProposalRow(data as ProposalRow) : null
}

export async function fetchAdaptiveCalibrationProposalByIdempotencyKey(
  admin: SupabaseClient,
  input: { organizationId: string; idempotencyKey: string },
): Promise<GrowthAdaptiveCalibrationProposal | null> {
  const { data, error } = await proposalsTable(admin)
    .select(PROPOSAL_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapAdaptiveCalibrationProposalRow(data as ProposalRow) : null
}

export async function upsertAdaptiveCalibrationProposal(
  admin: SupabaseClient,
  input: {
    organizationId: string
    idempotencyKey: string
    proposal: GrowthAdaptiveCalibrationProposal
  },
): Promise<{ proposal: GrowthAdaptiveCalibrationProposal; inserted: boolean }> {
  const existing = await fetchAdaptiveCalibrationProposalByIdempotencyKey(admin, {
    organizationId: input.organizationId,
    idempotencyKey: input.idempotencyKey,
  })
  if (existing) return { proposal: existing, inserted: false }

  const { data, error } = await proposalsTable(admin)
    .insert({
      organization_id: input.organizationId,
      source_insight_id: input.proposal.sourceInsightId,
      target_system: input.proposal.targetSystem,
      proposal_type: input.proposal.proposalType,
      status: input.proposal.status,
      title: input.proposal.title,
      summary: input.proposal.summary,
      proposed_change: input.proposal.proposedChange,
      evidence: input.proposal.evidence,
      confidence: input.proposal.confidence,
      impact: input.proposal.impact,
      sample_size: input.proposal.sampleSize,
      risk_level: input.proposal.riskLevel,
      requires_operator_approval: true,
      idempotency_key: input.idempotencyKey,
      expires_at: input.proposal.expiresAt ?? null,
      qa_marker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
    })
    .select(PROPOSAL_SELECT)
    .single()

  if (error) {
    if (error.message.includes("duplicate")) {
      const retry = await fetchAdaptiveCalibrationProposalByIdempotencyKey(admin, {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      })
      if (retry) return { proposal: retry, inserted: false }
    }
    throw new Error(error.message)
  }

  return { proposal: mapAdaptiveCalibrationProposalRow(data as ProposalRow), inserted: true }
}

export async function updateAdaptiveCalibrationProposalStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    proposalId: string
    status: GrowthAdaptiveCalibrationStatus
    approvedByUserId?: string
    approvedAt?: string
    rejectedByUserId?: string
    rejectedAt?: string
    rejectionReason?: string
  },
): Promise<GrowthAdaptiveCalibrationProposal> {
  const patch: Record<string, unknown> = { status: input.status }
  if (input.approvedByUserId) patch.approved_by_user_id = input.approvedByUserId
  if (input.approvedAt) patch.approved_at = input.approvedAt
  if (input.rejectedByUserId) patch.rejected_by_user_id = input.rejectedByUserId
  if (input.rejectedAt) patch.rejected_at = input.rejectedAt
  if (input.rejectionReason) patch.rejection_reason = input.rejectionReason

  const { data, error } = await proposalsTable(admin)
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.proposalId)
    .select(PROPOSAL_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapAdaptiveCalibrationProposalRow(data as ProposalRow)
}

export async function appendAdaptiveCalibrationEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    proposalId?: string | null
    eventType: string
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await eventsTable(admin).insert({
    organization_id: input.organizationId,
    proposal_id: input.proposalId ?? null,
    event_type: input.eventType,
    payload: input.payload ?? {},
    qa_marker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
  })
  if (error) throw new Error(error.message)
}

export async function listAdaptiveCalibrationProposals(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number; statuses?: GrowthAdaptiveCalibrationStatus[] },
): Promise<GrowthAdaptiveCalibrationProposal[]> {
  let query = proposalsTable(admin)
    .select(PROPOSAL_SELECT)
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50)

  if (input.statuses?.length) {
    query = query.in("status", input.statuses)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapAdaptiveCalibrationProposalRow(row as ProposalRow))
}

export async function summarizeAdaptiveCalibrationByOrganization(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<{
  proposedCount: number
  approvedCount: number
  rejectedCount: number
  lastGeneratedAt: string | null
}> {
  const proposals = await listAdaptiveCalibrationProposals(admin, {
    organizationId: input.organizationId,
    limit: 100,
  })

  return {
    proposedCount: proposals.filter((row) => row.status === "proposed").length,
    approvedCount: proposals.filter((row) => row.status === "approved").length,
    rejectedCount: proposals.filter((row) => row.status === "rejected").length,
    lastGeneratedAt: proposals[0]?.createdAt ?? null,
  }
}
