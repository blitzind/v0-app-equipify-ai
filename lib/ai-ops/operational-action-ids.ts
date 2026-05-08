/**
 * AI Ops Phase 5 — operational action identifiers shared by API routes and UI.
 * Kept free of server-only imports so client components can reference safely.
 */

export const OPERATIONAL_ACTION_IDS = [
  "send_invoice_reminder",
  "create_follow_up_task",
  "create_workflow_automation",
  "assign_technician",
  "restock_inventory",
  "release_certificate",
  "schedule_maintenance",
  "draft_prospect_followup",
] as const

export type OperationalActionId = (typeof OPERATIONAL_ACTION_IDS)[number]
