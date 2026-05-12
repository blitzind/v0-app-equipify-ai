/**
 * Human-readable BlitzPay UI labels only. API keys, DB enums, and business logic stay unchanged.
 */

const BLITZPAY_UI_LABELS: Record<string, string> = {
  // Mobile audit (Phase 6A)
  intent_captured: "Field intent saved",
  intent_synced: "Mobile intent synced",
  signature_captured: "Signature captured",
  payroll_item_reviewed: "Payroll line reviewed",
  treasury_snapshot_viewed: "Treasury summary viewed",
  sync_batch_processed: "Mobile batch processed",
  conflict_detected: "Sync conflict detected",
  manual_override: "Manual override recorded",

  // Claims audit (Phase 5C)
  claim_created: "Claim created",
  claim_submitted: "Claim submitted",
  reserve_adjusted: "Reserve adjusted",
  payout_scheduled: "Payout scheduled",
  payout_completed: "Payout completed",
  protection_plan_created: "Protection plan created",
  storm_event_created: "Storm event recorded",

  // Actor types (display when surfaced)
  system: "System",
  admin: "Admin",
  user: "User",
  technician: "Technician",
  worker: "Automation worker",
  customer: "Customer",

  // Observability audit (Phase 6B)
  event_created: "Financial event recorded",
  event_replayed: "Event reprocessed",
  workflow_started: "Workflow started",
  workflow_failed: "Workflow failed",
  workflow_replayed: "Workflow reprocessed",
  idempotency_conflict: "Duplicate request prevented",
  queue_backpressure: "Processing backlog elevated",
  worker_override: "Automation rule override",
  manual_replay: "Manual reprocess requested",

  // Workflow types (Phase 6B)
  collections_retry: "Collections retry workflow",
  payroll_processing: "Payroll processing workflow",
  financing_sync: "Financing sync workflow",
  procurement_sync: "Procurement sync workflow",
  claims_review: "Claims review workflow",
  treasury_snapshot: "Treasury snapshot workflow",
  ai_generation: "AI generation workflow",
  mobile_sync: "Mobile sync",

  // Financial event types (Phase 6B)
  payment: "Payment",
  collections: "Collections",
  payroll: "Payroll",
  financing: "Financing",
  treasury: "Treasury",
  procurement: "Procurement",
  claims: "Claims",
  accounting: "Accounting",

  // Mobile intents
  payment_collection: "Payment collection",
  customer_signature: "Customer signature",
  financing_request: "Financing request",
  claim_intake: "Claim intake",
  payroll_review: "Payroll review",
  treasury_note: "Treasury note",
  protection_plan_offer: "Protection plan offer",

  // Mobile signature authorization types
  payment_approval: "Payment approval",
  ach_authorization_acknowledgment: "ACH authorization acknowledgment",
  financing_acknowledgment: "Financing acknowledgment",
  protection_plan_acknowledgment: "Protection plan acknowledgment",
  claim_acknowledgment: "Claim acknowledgment",

  // Mobile payroll approval types
  labor_hours: "Labor hours",
  contractor_settlement: "Contractor settlement",

  // Mobile sync batches
  partially_failed: "Completed with issues",

  // Audience / roles (treasury snapshots)
  field_supervisor: "Field supervisor",

  // Collections engine
  failed_payment: "Failed payment",
  overdue_invoice: "Overdue invoice",
  partial_payment: "Partial payment",
  manual_review: "Manual review",
  reminder_sent: "Reminder sent",
  retry_scheduled: "Retry scheduled",
  retry_attempted: "Retry attempted",
  payment_collected: "Payment collected",
  escalation_triggered: "Escalation started",
  flow_paused: "Recovery paused",
  flow_resumed: "Recovery resumed",
  marked_uncollectible: "Marked uncollectible",
  manual_resolution: "Manually resolved",
  manual_retry: "Manual retry",
  scheduled_retry: "Scheduled retry",
  autopay: "Autopay",

  // Multi-region sync (Phase 6B)
  degraded: "Degraded",
  replaying: "Catch-up sync",
  offline: "Offline",

  // Common lifecycle / queue wording
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
  cancelled: "Canceled",
  skipped: "Skipped",
  succeeded: "Succeeded",
  replayed: "Replayed",
  archived: "Archived",
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  synced: "Synced",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  captured: "Captured",
  verified: "Verified",
  pending: "Pending",
  disputed: "Disputed",
  expired: "Expired",
  custom: "Custom",
  commission: "Commission",
  reimbursement: "Reimbursement",
  bonus: "Bonus",
  reminder: "Reminder",
  escalation: "Escalation",
  settlement: "Settlement",
}

function titleCaseWordsFromSnake(raw: string): string {
  const s = raw.trim()
  if (!s) return ""
  if (!s.includes("_") && !s.includes("-")) {
    const lower = s.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

/**
 * Maps known BlitzPay enum / audit / workflow keys to operator-friendly copy; unknown keys become title-style phrases.
 */
export function formatBlitzpayUiLabel(raw: string | null | undefined): string {
  const key = raw?.trim()
  if (!key) return "—"
  return BLITZPAY_UI_LABELS[key] ?? titleCaseWordsFromSnake(key)
}
