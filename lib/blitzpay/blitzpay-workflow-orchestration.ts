import "server-only"

import { createHash } from "node:crypto"
import { canonicalJsonForBlitzpayEvent, isBlitzpayWorkflowReplayCandidateStatus } from "@/lib/blitzpay/blitzpay-event-sourcing"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { normalizeOrgMemberRole } from "@/lib/permissions/model"

export const BLITZPAY_WORKFLOW_LIST_CAP = 40
export const BLITZPAY_OBSERVABILITY_AUDIT_LIST_CAP = 40

export type BlitzpayWorkflowExecutionStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "canceled"
  | "replayed"

/** Bounded, deterministic transition (no automatic retries). */
export function nextBlitzpayWorkflowStatus(
  current: BlitzpayWorkflowExecutionStatus,
  action: "start" | "complete" | "fail" | "cancel" | "mark_replayed",
): BlitzpayWorkflowExecutionStatus | null {
  if (current === "replayed" || current === "canceled") return null
  if (action === "start" && current === "queued") return "processing"
  if (action === "complete" && current === "processing") return "completed"
  if (action === "fail" && current === "processing") return "failed"
  if (action === "cancel" && (current === "queued" || current === "processing")) return "canceled"
  if (action === "mark_replayed" && current === "failed") return "replayed"
  return null
}

export function hashBlitzpayObservabilityAuditEntry(input: {
  organizationId: string | null
  auditType: string
  auditSummary: string
  workflowExecutionId: string | null
  financialEventId: string | null
  actorType: string
  actorId: string | null
  metadata: Record<string, unknown>
  pepper?: string
}): string {
  const body = canonicalJsonForBlitzpayEvent({
    organization_id: input.organizationId,
    audit_type: input.auditType,
    audit_summary: input.auditSummary,
    workflow_execution_id: input.workflowExecutionId,
    financial_event_id: input.financialEventId,
    actor_type: input.actorType,
    actor_id: input.actorId,
    metadata: input.metadata ?? {},
    pepper: input.pepper ?? "",
  })
  return createHash("sha256").update(body, "utf8").digest("hex")
}

export function validateBlitzpayWorkflowReplayAuthorization(input: {
  orgMemberRole: string | null
  userEmail: string | null | undefined
}): { ok: true } | { ok: false; code: "forbidden" } {
  if (input.userEmail && isPlatformAdminEmail(input.userEmail)) return { ok: true }
  const r = normalizeOrgMemberRole(input.orgMemberRole)
  if (r === "owner" || r === "admin") return { ok: true }
  return { ok: false, code: "forbidden" }
}

export function validateBlitzpayManualReplayRequest(input: {
  currentStatus: string
}): { ok: true } | { ok: false; code: string } {
  if (!isBlitzpayWorkflowReplayCandidateStatus(input.currentStatus)) {
    return { ok: false, code: "not_replayable_state" }
  }
  return { ok: true }
}
