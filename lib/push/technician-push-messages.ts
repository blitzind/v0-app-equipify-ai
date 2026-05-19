import type { TechnicianPushAlertType } from "@/lib/push/technician-push-alert-types"

export type TechnicianPushMessageInput = {
  alertType: TechnicianPushAlertType
  workOrderTitle?: string | null
  customerName?: string | null
  scheduledLabel?: string | null
}

export type TechnicianPushMessage = {
  title: string
  body: string
}

export function buildTechnicianPushMessage(input: TechnicianPushMessageInput): TechnicianPushMessage {
  const wo = input.workOrderTitle?.trim() || "Work order"
  const customer = input.customerName?.trim()
  const schedule = input.scheduledLabel?.trim()

  switch (input.alertType) {
    case "work_assigned":
      return {
        title: "Work assigned",
        body: customer ? `${customer} — ${wo}` : wo,
      }
    case "schedule_changed":
      return {
        title: "Schedule changed",
        body: schedule
          ? `${wo} · ${schedule}`
          : customer
            ? `${customer} — ${wo}`
            : wo,
      }
    case "urgent_callback":
      return {
        title: "Urgent callback",
        body: customer ? `${customer} needs a callback` : `Urgent callback for ${wo}`,
      }
    case "notes_added":
      return {
        title: "Note added",
        body: customer ? `${customer} — ${wo}` : `Update on ${wo}`,
      }
    case "signature_needed":
      return {
        title: "Signature needed",
        body: customer ? `${customer} — ${wo}` : `${wo} is waiting for a signature`,
      }
    default: {
      const _exhaustive: never = input.alertType
      return _exhaustive
    }
  }
}

export function technicianPushIdempotencyKey(args: {
  alertType: TechnicianPushAlertType
  organizationId: string
  recipientUserId: string
  relatedEntityId?: string | null
  bucket?: string | null
}): string {
  const entity = args.relatedEntityId?.trim() || "none"
  const bucket = args.bucket?.trim() || "v1"
  return `tech_push:${args.alertType}:${args.organizationId}:${args.recipientUserId}:${entity}:${bucket}`
}
