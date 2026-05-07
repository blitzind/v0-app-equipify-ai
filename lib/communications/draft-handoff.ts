/**
 * Communications Center Phase 3 — draft → live send hand-off.
 *
 * Pure adapter that maps a `communication_events` draft row to the
 * appropriate live send route. **No sending logic lives here.** The
 * adapter only constructs the request body that the matching domain
 * route already accepts (invoice email, quote email, work-order
 * summary, prospect follow-up). The route handler dispatches via
 * server-to-server fetch using the caller's session cookie so all
 * existing auth, billing, audit, and provider behavior is preserved.
 */

import type { CommunicationEventRow, RelatedEntityType } from "@/lib/notifications/types"

export type HandoffTarget = {
  /** Absolute path of the live route that performs the actual send. */
  path: string
  /** JSON body forwarded to that route. */
  payload: Record<string, unknown>
  /** Stable label for the lifecycle entry. */
  routeLabel: string
}

export type HandoffPlan =
  | { kind: "ok"; target: HandoffTarget }
  | { kind: "unsupported"; reason: string }
  | { kind: "missing_field"; field: string; reason: string }

/**
 * Decide which live route handles a draft, and produce the payload
 * to forward. Caller is responsible for the actual fetch + lifecycle
 * updates.
 */
export function planDraftHandoff(draft: CommunicationEventRow): HandoffPlan {
  if (!draft.related_entity_type || !draft.related_entity_id) {
    return {
      kind: "missing_field",
      field: "related_entity_type",
      reason: "Draft is not linked to an entity yet — add a link before sending.",
    }
  }

  const type = draft.related_entity_type as RelatedEntityType
  const recipient = draft.recipient_address?.trim() ?? ""

  switch (type) {
    case "invoice":
      if (!recipient) {
        return {
          kind: "missing_field",
          field: "recipient_address",
          reason: "Invoice email needs a recipient address.",
        }
      }
      return {
        kind: "ok",
        target: {
          path: "/api/email/invoice",
          routeLabel: "invoice email",
          payload: {
            organizationId: draft.organization_id,
            invoiceId: draft.related_entity_id,
            to: recipient,
            subject: draft.title || undefined,
            message: draft.body ?? undefined,
            variant: "send",
          },
        },
      }
    case "quote":
      if (!recipient) {
        return {
          kind: "missing_field",
          field: "recipient_address",
          reason: "Quote email needs a recipient address.",
        }
      }
      return {
        kind: "ok",
        target: {
          path: "/api/email/quote",
          routeLabel: "quote email",
          payload: {
            organizationId: draft.organization_id,
            quoteId: draft.related_entity_id,
            to: recipient,
            subject: draft.title || undefined,
            message: draft.body ?? undefined,
            variant: "send",
          },
        },
      }
    case "work_order":
      if (!recipient) {
        return {
          kind: "missing_field",
          field: "recipient_address",
          reason: "Work-order summary email needs a recipient address.",
        }
      }
      return {
        kind: "ok",
        target: {
          path: "/api/email/work-order-summary",
          routeLabel: "work-order summary email",
          payload: {
            organizationId: draft.organization_id,
            workOrderId: draft.related_entity_id,
            to: recipient,
            message: draft.body ?? undefined,
            variant: "summary",
          },
        },
      }
    case "prospect":
      return {
        kind: "ok",
        target: {
          path: `/api/organizations/${draft.organization_id}/prospects/${draft.related_entity_id}/follow-up`,
          routeLabel: "prospect follow-up",
          payload: {
            channel: draft.channel,
            summary: draft.summary ?? draft.title,
            body: draft.body ?? null,
          },
        },
      }
    default:
      return {
        kind: "unsupported",
        reason: `No live send route is wired for ${type} drafts yet. Phase 3 ships invoice / quote / work-order / prospect.`,
      }
  }
}

/** Identify whether a row is a Phase 2 draft (vs. a normal pending row). */
export function isDraftRow(row: CommunicationEventRow): boolean {
  if (row.event_type === "communication_draft") return true
  const md = row.metadata as Record<string, unknown> | null
  return Boolean(md && md.is_draft === true)
}
