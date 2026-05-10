import type { InternalNotificationEventType } from "@/lib/internal-notifications/types"

export const INTERNAL_NOTIFICATION_EVENT_LABELS: Record<InternalNotificationEventType, string> = {
  service_request_new: "New service request submitted",
  service_request_sla_at_risk: "Service request SLA at risk",
  service_request_sla_overdue: "Service request SLA overdue",
  work_order_overdue: "Work order overdue (past scheduled date)",
  work_order_unassigned: "Work order unassigned after threshold",
  maintenance_due_soon: "Maintenance / calibration due soon",
  maintenance_overdue: "Maintenance / calibration overdue",
  quote_approved: "Quote approved (recent)",
  quote_declined: "Quote declined (recent)",
  invoice_overdue: "Invoice overdue (financial visibility)",
  repeat_failure_risk: "Repeat failure / repair risk",
  warranty_expiring_soon: "Warranty expiring soon",
}
