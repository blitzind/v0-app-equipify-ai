/** Built-in operational automations — metrics derived from `communication_events` where possible. */
export type CommunicationAutomationBlueprint = {
  key: string
  label: string
  trigger: string
  description: string
  /** Event types that roll up into this automation for last-run / counts. */
  eventTypes: string[]
}

export const COMMUNICATION_AUTOMATION_BLUEPRINTS: CommunicationAutomationBlueprint[] = [
  {
    key: "unpaid_invoice_reminders",
    label: "Unpaid invoice reminders",
    trigger: "Invoice past due or unpaid (synced in-app reminders)",
    description: "Surfaces overdue invoices inside Equipify and optional workflow emails.",
    eventTypes: ["invoice_reminder"],
  },
  {
    key: "quote_follow_ups",
    label: "Quote follow-ups",
    trigger: "Quotes sent but still awaiting customer response",
    description: "Follow-up tasks generated for aging quotes.",
    eventTypes: ["quote_follow_up"],
  },
  {
    key: "maintenance_reminders",
    label: "Maintenance reminders",
    trigger: "Maintenance plans with upcoming or overdue service dates",
    description: "PM schedules and customer-facing maintenance notices.",
    eventTypes: ["maintenance_reminder"],
  },
  {
    key: "work_order_reminders",
    label: "Work order scheduling reminders",
    trigger: "Scheduled work orders in the next window",
    description: "Internal reminders before crew dispatch.",
    eventTypes: ["work_order_reminder"],
  },
  {
    key: "review_requests",
    label: "Review requests",
    trigger: "Workflow or manual review solicitations",
    description: "Placeholder until dedicated review events are emitted.",
    eventTypes: ["review_request"],
  },
  {
    key: "warranty_reminders",
    label: "Warranty reminders",
    trigger: "Workflow `equipment_warranty_expiring` automations",
    description: "Uses workflow automation when configured (no standalone event type yet).",
    eventTypes: [],
  },
]
