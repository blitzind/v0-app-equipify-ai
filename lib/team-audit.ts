import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export type TeamAuditAction =
  | "member_invited"
  | "member_role_changed"
  | "member_suspended"
  | "member_reactivated"
  | "member_removed"

export async function insertTeamAuditEvent(params: {
  organizationId: string
  action: TeamAuditAction
  actorUserId: string | null
  recordType: string
  recordId: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const admin = createServiceRoleSupabaseClient()
    const { error } = await admin.from("organization_audit_events").insert({
      organization_id: params.organizationId,
      action: params.action,
      actor_user_id: params.actorUserId,
      record_type: params.recordType,
      record_id: params.recordId,
      metadata: params.metadata ?? {},
    })
    if (error) {
      console.warn("[organization_audit_events] team audit insert skipped:", error.message)
    }
  } catch (e) {
    console.warn("[organization_audit_events] team audit insert failed:", e)
  }
}
