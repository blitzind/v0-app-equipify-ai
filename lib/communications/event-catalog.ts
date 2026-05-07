/**
 * Communications Center Phase 1 — event-type catalog.
 *
 * Maps the free-text `event_type` strings used by the various event
 * sources (invoices, quotes, prospects, workflow automations, portal,
 * scheduling, certificate releases, etc.) to manager-friendly labels
 * and category buckets. Unknown event types fall back to a generic
 * label derived from the string.
 *
 * Pure module — no I/O. Used by the timeline list, the detail drawer,
 * and the embedded "Recent communications" sections so naming stays
 * consistent everywhere.
 */

export type EventCategory =
  | "billing"
  | "operations"
  | "marketing"
  | "system"
  | "portal"
  | "ai"

export type EventTypeMeta = {
  label: string
  category: EventCategory
  /** True when the source system flags this event as automated. */
  alwaysAutomated?: boolean
}

const CATALOG: Record<string, EventTypeMeta> = {
  // Billing
  invoice_email: { label: "Invoice email", category: "billing" },
  invoice_reminder: { label: "Invoice reminder", category: "billing", alwaysAutomated: true },
  invoice_overdue_notice: { label: "Invoice overdue notice", category: "billing", alwaysAutomated: true },
  invoice_payment_recorded: { label: "Invoice payment recorded", category: "billing" },
  quote_email: { label: "Quote email", category: "billing" },
  quote_follow_up: { label: "Quote follow-up", category: "billing", alwaysAutomated: true },

  // Operations
  appointment_confirmation: { label: "Appointment confirmation", category: "operations" },
  scheduling_event: { label: "Scheduling event", category: "operations" },
  work_order_summary_email: { label: "Work order summary", category: "operations" },
  work_order_reminder: { label: "Work order reminder", category: "operations", alwaysAutomated: true },
  maintenance_reminder: { label: "Maintenance reminder", category: "operations", alwaysAutomated: true },
  certificate_released: { label: "Certificate released", category: "operations" },
  certificate_uploaded: { label: "Certificate uploaded", category: "operations" },

  // Marketing / prospects
  prospect_follow_up: { label: "Prospect follow-up", category: "marketing" },
  prospect_status_changed: { label: "Prospect status changed", category: "marketing" },
  prospect_ai_draft_generated: { label: "AI follow-up draft", category: "ai" },
  prospect_converted: { label: "Prospect converted", category: "marketing" },

  // AI assistants
  ai_assistant_run_completed: { label: "AI assistant run", category: "ai" },
  ai_followup_email_draft: { label: "AI email draft", category: "ai" },

  // Portal
  portal_document_index_view: { label: "Portal documents viewed", category: "portal" },
  portal_document_download: { label: "Portal document downloaded", category: "portal" },
  portal_session_login: { label: "Portal sign-in", category: "portal" },
  portal_invoice_view: { label: "Portal invoice viewed", category: "portal" },
  portal_quote_view: { label: "Portal quote viewed", category: "portal" },

  // System
  workflow_automation: { label: "Workflow automation", category: "system", alwaysAutomated: true },
  workflow_email: { label: "Automation email", category: "system", alwaysAutomated: true },
  internal_notice: { label: "Internal note", category: "system" },
  email_outbound: { label: "Email", category: "operations" },
  sms_outbound: { label: "SMS", category: "operations" },
  customer_inbound: { label: "Customer reply", category: "operations" },
}

export function eventTypeMeta(eventType: string): EventTypeMeta {
  return (
    CATALOG[eventType] ?? {
      label: humanize(eventType),
      category: "operations",
    }
  )
}

function humanize(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
}

/** Stable ordered list of types for filter dropdowns. */
export function listEventTypeMetas(): Array<EventTypeMeta & { id: string }> {
  return Object.entries(CATALOG)
    .map(([id, meta]) => ({ id, ...meta }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
