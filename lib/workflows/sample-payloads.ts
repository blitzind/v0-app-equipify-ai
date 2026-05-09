/**
 * Workflow Automations Phase 2 — sample event payloads per trigger.
 *
 * Used by:
 *   - the builder's "Preview payload" panel
 *   - the "Run test" simulator (server-side) so we can evaluate
 *     conditions against a realistic shape without touching real data
 *
 * No I/O. Pure constants. Safe to import from server or client.
 */

import type { WorkflowEventContext, WorkflowTriggerType } from "@/lib/workflows/types"

const TODAY_ISO = "2026-05-07"

export const SAMPLE_PAYLOADS: Record<
  WorkflowTriggerType,
  Omit<WorkflowEventContext, "organization_id" | "trigger_type">
> = {
  prospect_status_changed: {
    today: TODAY_ISO,
    prospect: {
      id: "<prospect-id>",
      company_name: "Acme Industrial Services",
      contact_name: "Jordan Lee",
      contact_email: "jordan@acme.example",
      previous_status: "contacted",
      next_status: "proposal_sent",
      reason: "manual_edit",
      next_follow_up_at: "2026-05-12T14:00:00Z",
      estimated_value_cents: 480000,
    },
  },
  work_order_created: {
    today: TODAY_ISO,
    work_order: {
      id: "<work-order-id>",
      title: "Annual scale calibration",
      status: "open",
      priority: "high",
      customer_id: "<customer-id>",
      equipment_id: "<equipment-id>",
    },
  },
  work_order_completed: {
    today: TODAY_ISO,
    work_order: {
      id: "<work-order-id>",
      title: "Quarterly belt inspection",
      status: "completed",
      priority: "medium",
      duration_minutes: 95,
      customer_id: "<customer-id>",
      equipment_id: "<equipment-id>",
    },
  },
  work_order_status_changed: {
    today: TODAY_ISO,
    previous_work_order: { status: "scheduled" },
    work_order: {
      id: "<work-order-id>",
      title: "Repair — gear noise",
      status: "in_progress",
      priority: "urgent",
      customer_id: "<customer-id>",
    },
  },
  maintenance_due: {
    today: TODAY_ISO,
    maintenance_plan: {
      id: "<maintenance-plan-id>",
      next_due: "2026-05-14",
      cadence: "quarterly",
      equipment_id: "<equipment-id>",
    },
  },
  invoice_overdue: {
    today: TODAY_ISO,
    invoice: {
      id: "<invoice-id>",
      number: "INV-1042",
      due_date: "2026-04-22",
      days_overdue: 15,
      amount_cents: 248500,
      balance_cents: 248500,
      customer_id: "<customer-id>",
    },
  },
  quote_accepted: {
    today: TODAY_ISO,
    quote: {
      id: "<quote-id>",
      number: "Q-220",
      total_cents: 312000,
      customer_id: "<customer-id>",
    },
  },
  equipment_warranty_expiring: {
    today: TODAY_ISO,
    equipment: {
      id: "<equipment-id>",
      name: "Conveyor #3",
      warranty_end: "2026-06-04",
    },
    equipment_category: "Conveyor",
  },
  certificate_uploaded: {
    today: TODAY_ISO,
    calibration_record: {
      id: "<calibration-record-id>",
      equipment_id: "<equipment-id>",
      released_at: "2026-05-07T09:42:00Z",
      certificate_number: "CAL-2026-0521",
    },
  },
  ai_assistant_digest_ready: {
    today: TODAY_ISO,
    ai_assistant: {
      assistant_id: "<assistant-id>",
      digest_summary: "Three jobs at risk for tomorrow; one customer waiting on a part.",
    },
  },
}

export function samplePayloadFor(
  triggerType: WorkflowTriggerType,
  organizationId: string,
): WorkflowEventContext {
  return {
    organization_id: organizationId,
    trigger_type: triggerType,
    ...SAMPLE_PAYLOADS[triggerType],
  }
}

/** Pretty-printed JSON used by the Preview Payload panel. */
export function samplePayloadJson(triggerType: WorkflowTriggerType): string {
  return JSON.stringify(
    {
      trigger_type: triggerType,
      ...SAMPLE_PAYLOADS[triggerType],
    },
    null,
    2,
  )
}
