import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export async function insertOrganizationAuditEvent(params: {
  organizationId: string
  action: "record_archived" | "record_restored"
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
      console.warn("[organization_audit_events] insert skipped:", error.message)
    }
  } catch (e) {
    console.warn("[organization_audit_events] insert failed:", e)
  }
}
