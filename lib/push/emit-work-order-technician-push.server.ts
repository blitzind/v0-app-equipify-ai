import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { sendTechnicianPushNotification } from "@/lib/push/send-technician-push.server"
import type { TechnicianPushAlertType } from "@/lib/push/technician-push-alert-types"

export type EmitWorkOrderTechnicianPushInput = {
  organizationId: string
  recipientUserId: string
  workOrderId: string
  alertType: TechnicianPushAlertType
  workOrderTitle?: string | null
  customerName?: string | null
  scheduledLabel?: string | null
  idempotencyBucket?: string | null
  createdBy?: string | null
}

/**
 * Call from trusted server paths when dispatch changes a technician assignment or schedule.
 * No-op when recipient has no registered devices (audited as skipped).
 */
export async function emitWorkOrderTechnicianPush(
  svc: SupabaseClient,
  input: EmitWorkOrderTechnicianPushInput,
) {
  return sendTechnicianPushNotification(svc, {
    alertType: input.alertType,
    organizationId: input.organizationId,
    recipientUserId: input.recipientUserId,
    relatedEntityType: "work_order",
    relatedEntityId: input.workOrderId,
    workOrderTitle: input.workOrderTitle,
    customerName: input.customerName,
    scheduledLabel: input.scheduledLabel,
    idempotencyBucket: input.idempotencyBucket,
    createdBy: input.createdBy,
  })
}
