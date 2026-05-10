/**
 * Communications — failed / bounced delivery retry.
 *
 * Maps a retriable `communication_events` row to the same live routes used by
 * draft hand-off (`lib/communications/draft-handoff.ts`). No Resend calls here.
 */

import { planDraftHandoff, type HandoffPlan } from "@/lib/communications/draft-handoff"
import { isValidEmail } from "@/lib/email/format"
import type { CommunicationEventRow } from "@/lib/notifications/types"

export type FailedDeliveryRetryPlan = HandoffPlan

/**
 * Build the live route + payload to replay a failed outbound email.
 * Caller performs the server `fetch` with the user's session cookie.
 */
export function planFailedDeliveryRetry(row: CommunicationEventRow): FailedDeliveryRetryPlan {
  if (row.channel !== "email") {
    return {
      kind: "unsupported",
      reason: "Only email deliveries can be retried from Communications today.",
    }
  }

  if (row.event_type === "prospect_followup_email") {
    return {
      kind: "unsupported",
      reason:
        "This touch was logged manually and did not send mail. Start a new draft or email the prospect from their record.",
    }
  }

  if (row.event_type === "communication_draft") {
    return planDraftHandoff(row)
  }

  const meta = (row.metadata ?? {}) as Record<string, unknown>

  if (meta.variant === "ai_ops_reminder") {
    return {
      kind: "unsupported",
      reason:
        "Payment reminders are sent from AI Ops. Use that flow to follow up; Communications cannot replay this template.",
    }
  }

  if (!row.related_entity_type || !row.related_entity_id) {
    return {
      kind: "missing_field",
      field: "related_entity_id",
      reason: "This event is not linked to a record we can use to resend automatically.",
    }
  }

  if (row.related_entity_type === "prospect") {
    return {
      kind: "unsupported",
      reason: "Prospect log entries do not send email. Create a communications draft linked to this prospect instead.",
    }
  }

  const to = row.recipient_address?.trim() ?? ""
  if (!isValidEmail(to)) {
    return {
      kind: "missing_field",
      field: "recipient_address",
      reason: "A valid recipient address is required to retry this send.",
    }
  }

  const organizationId = row.organization_id
  const entity = row.related_entity_type

  switch (row.event_type) {
    case "invoice_email": {
      if (entity !== "invoice") {
        return { kind: "unsupported", reason: "Invoice email retry requires an invoice-linked event." }
      }
      const variant = meta.variant === "send" || meta.variant === "resend" ? meta.variant : "resend"
      return {
        kind: "ok",
        target: {
          path: "/api/email/invoice",
          routeLabel: "invoice email",
          payload: {
            organizationId,
            invoiceId: row.related_entity_id,
            to,
            variant,
          },
        },
      }
    }
    case "quote_email": {
      if (entity !== "quote") {
        return { kind: "unsupported", reason: "Quote email retry requires a quote-linked event." }
      }
      const variant = meta.variant === "send" || meta.variant === "resend" ? meta.variant : "resend"
      return {
        kind: "ok",
        target: {
          path: "/api/email/quote",
          routeLabel: "quote email",
          payload: {
            organizationId,
            quoteId: row.related_entity_id,
            to,
            variant,
          },
        },
      }
    }
    case "work_order_summary_email":
    case "appointment_confirmation_email": {
      if (entity !== "work_order") {
        return { kind: "unsupported", reason: "Work order email retry requires a work-order-linked event." }
      }
      const variant =
        row.event_type === "appointment_confirmation_email" ? "appointment_confirmation" : "summary"
      return {
        kind: "ok",
        target: {
          path: "/api/email/work-order-summary",
          routeLabel:
            variant === "appointment_confirmation" ? "appointment confirmation email" : "work-order summary email",
          payload: {
            organizationId,
            workOrderId: row.related_entity_id,
            to,
            variant,
          },
        },
      }
    }
    default:
      return {
        kind: "unsupported",
        reason: `Automatic retry is not available for event type “${row.event_type}”.`,
      }
  }
}
