import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeGrowthActorUserIdForDb } from "@/lib/growth/actor-user-id"
import { appendGovernancePolicyEvent } from "@/lib/growth/governance/governance-events"
import type { GrowthGovernanceEvaluationResult } from "@/lib/growth/governance/governance-types"

export type AppendGovernanceApprovalAuditInput = {
  actorUserId?: string | null
  actorEmail: string
  action: string
  entityType: string
  entityId?: string | null
  sourceRoute: string
  approvalReason?: string
  evaluation: GrowthGovernanceEvaluationResult
}

export async function appendGovernanceApprovalAudit(
  admin: SupabaseClient,
  input: AppendGovernanceApprovalAuditInput,
): Promise<void> {
  const actorUserId = normalizeGrowthActorUserIdForDb(input.actorUserId)

  const { error } = await admin.schema("growth").from("governance_approval_audit").insert({
    actor_user_id: actorUserId,
    actor_email: input.actorEmail,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    source_route: input.sourceRoute,
    approval_reason: input.approvalReason ?? "",
    policy_snapshot: input.evaluation.policySnapshot,
    risk_flags: input.evaluation.riskFlags,
    metadata: {
      appliedPolicyIds: input.evaluation.appliedPolicyIds,
    },
  })
  if (error) throw new Error(error.message)

  await appendGovernancePolicyEvent(admin, {
    eventType: "approval_audited",
    policyId: input.evaluation.appliedPolicyIds[0] ?? null,
    severity: input.evaluation.riskFlags.length > 0 ? "medium" : "info",
    title: "Governance approval audited",
    description: `${input.action} on ${input.entityType}`,
    actorUserId,
    actorEmail: input.actorEmail,
    metadata: {
      entityId: input.entityId ?? null,
      sourceRoute: input.sourceRoute,
    },
  }).catch(() => undefined)
}

export async function listGovernanceApprovalAudit(
  admin: SupabaseClient,
  input?: { limit?: number },
) {
  let query = admin
    .schema("growth")
    .from("governance_approval_audit")
    .select("*")
    .order("recorded_at", { ascending: false })
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    actorEmail: String(row.actor_email ?? ""),
    action: String(row.action ?? ""),
    entityType: String(row.entity_type ?? ""),
    entityId: row.entity_id ? String(row.entity_id) : null,
    sourceRoute: String(row.source_route ?? ""),
    approvalReason: String(row.approval_reason ?? ""),
    riskFlags: Array.isArray(row.risk_flags) ? (row.risk_flags as string[]) : [],
    recordedAt: String(row.recorded_at ?? ""),
  }))
}
