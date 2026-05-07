import type { AdminInvoice } from "@/lib/mock-data"
import type { WorkOrder } from "@/lib/mock-data"
import { invoiceTermsCodeLabel } from "@/lib/billing/invoice-terms"

export type ServiceTimelineTone = "default" | "info" | "success" | "warning" | "danger"

export type ServiceTimelineEvent = {
  id: string
  /** ISO or sortable datetime string */
  at: string
  label: string
  detail?: string
  tone?: ServiceTimelineTone
}

function isoFromDate(d: string): string {
  if (!d) return ""
  const t = new Date(d + "T12:00:00").getTime()
  return Number.isNaN(t) ? d : new Date(t).toISOString()
}

/** Chronological events for a work order + optional linked invoices (same customer scope). */
export function buildWorkOrderServiceTimeline(
  wo: Pick<
    WorkOrder,
    | "id"
    | "createdAt"
    | "status"
    | "scheduledDate"
    | "scheduledTime"
    | "completedDate"
    | "technicianName"
    | "calibrationTemplateId"
  >,
  invoices: Pick<
    AdminInvoice,
    "id" | "invoiceNumber" | "issueDate" | "dueDate" | "status" | "paidDate" | "amount" | "sentAt" | "termsCode"
  >[],
): ServiceTimelineEvent[] {
  const events: ServiceTimelineEvent[] = []

  if (wo.createdAt) {
    events.push({
      id: "wo-created",
      at: isoFromDate(wo.createdAt.slice(0, 10)),
      label: "Work order created",
      detail: wo.status ? `Status: ${wo.status}` : undefined,
      tone: "default",
    })
  }

  if (wo.scheduledDate) {
    const st = wo.scheduledTime?.trim()
    events.push({
      id: "wo-scheduled",
      at: isoFromDate(wo.scheduledDate),
      label: "Appointment scheduled",
      detail: st ? `Time: ${st}` : undefined,
      tone: "info",
    })
  }

  if (wo.technicianName?.trim()) {
    events.push({
      id: "tech-assigned",
      at: isoFromDate(wo.scheduledDate || wo.createdAt?.slice(0, 10) || ""),
      label: "Technician on work order",
      detail: wo.technicianName.trim(),
      tone: "info",
    })
  }

  if (wo.completedDate) {
    events.push({
      id: "wo-completed",
      at: isoFromDate(wo.completedDate.slice(0, 10)),
      label: "Work completed",
      tone: "success",
    })
  }

  if (wo.calibrationTemplateId) {
    events.push({
      id: "cert-template",
      at: isoFromDate(wo.completedDate?.slice(0, 10) || wo.createdAt?.slice(0, 10) || ""),
      label: "Certificate template assigned",
      tone: "info",
    })
  }

  for (const inv of invoices) {
    const base = inv.issueDate ? isoFromDate(inv.issueDate) : new Date().toISOString()
    events.push({
      id: `inv-${inv.id}-issued`,
      at: base,
      label: "Invoice issued",
      detail: inv.invoiceNumber ? `${inv.invoiceNumber} · ${inv.status}` : inv.status,
      tone: "info",
    })
    if (inv.termsCode) {
      events.push({
        id: `inv-${inv.id}-terms`,
        at: base,
        label: "Payment terms",
        detail: invoiceTermsCodeLabel(inv.termsCode),
        tone: "default",
      })
    }
    if (inv.sentAt) {
      events.push({
        id: `inv-${inv.id}-sent`,
        at: inv.sentAt,
        label: "Invoice sent",
        tone: "info",
      })
    }
    if (inv.status === "Paid" && inv.paidDate) {
      events.push({
        id: `inv-${inv.id}-paid`,
        at: isoFromDate(inv.paidDate),
        label: "Payment recorded",
        detail: inv.amount != null ? `$${inv.amount.toFixed(2)}` : undefined,
        tone: "success",
      })
    } else if (inv.status === "Overdue" || (inv.dueDate && inv.status !== "Paid")) {
      events.push({
        id: `inv-${inv.id}-open`,
        at: inv.dueDate ? isoFromDate(inv.dueDate) : base,
        label: "Outstanding balance",
        detail: inv.dueDate ? `Due ${inv.dueDate}` : undefined,
        tone: "warning",
      })
    }
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  return events
}

/** Invoice-centric timeline (detail drawer / page). */
export function buildInvoiceServiceTimeline(
  inv: Pick<
    AdminInvoice,
    | "issueDate"
    | "dueDate"
    | "paidDate"
    | "status"
    | "amount"
    | "sentAt"
    | "invoiceNumber"
    | "termsCode"
    | "createdBy"
  >,
  workOrderLabels: { id: string; label: string }[],
): ServiceTimelineEvent[] {
  const events: ServiceTimelineEvent[] = []
  const issueIso = inv.issueDate ? isoFromDate(inv.issueDate) : new Date().toISOString()

  events.push({
    id: "inv-created",
    at: issueIso,
    label: "Invoice created",
    detail: inv.invoiceNumber ?? undefined,
    tone: "default",
  })

  if (inv.termsCode) {
    events.push({
      id: "inv-terms",
      at: issueIso,
      label: "Terms",
      detail: invoiceTermsCodeLabel(inv.termsCode),
      tone: "default",
    })
  }

  if (inv.sentAt) {
    events.push({
      id: "inv-sent",
      at: inv.sentAt,
      label: "Invoice sent to customer",
      tone: "info",
    })
  }

  for (const wo of workOrderLabels) {
    events.push({
      id: `link-wo-${wo.id}`,
      at: issueIso,
      label: "Linked work order",
      detail: wo.label,
      tone: "info",
    })
  }

  if (inv.status === "Paid" && inv.paidDate) {
    events.push({
      id: "inv-paid",
      at: isoFromDate(inv.paidDate),
      label: "Marked paid",
      detail: inv.amount != null ? `$${inv.amount.toFixed(2)}` : undefined,
      tone: "success",
    })
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  return events
}
