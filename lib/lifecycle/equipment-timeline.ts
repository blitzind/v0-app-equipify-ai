import type { ServiceTimelineEvent } from "@/lib/lifecycle/service-timeline"

function isoFromDate(d: string): string {
  if (!d) return ""
  const t = new Date(d + "T12:00:00").getTime()
  return Number.isNaN(t) ? d : new Date(t).toISOString()
}

export type EquipmentTimelineWO = {
  id: string
  created_at: string
  completed_at: string | null
  title: string
  type: string
  status: string
  work_order_number?: number | null
  maintenance_plan_id: string | null
  total_parts_cents?: number | null
  total_labor_cents?: number | null
  technicianLabel?: string | null
}

export type EquipmentTimelineInvoice = {
  id: string
  issued_at: string | null
  title: string
  status: string | null
  amount_cents: number | null
  invoice_number?: string | null
}

export type EquipmentTimelineCert = {
  id: string
  created_at: string
  templateName: string | null
  workOrderLabel: string | null
}

export type EquipmentTimelinePlan = {
  id: string
  name: string
  status: string
  next_due_date: string | null
}

export type EquipmentTimelineMeta = {
  installDate?: string | null
  warrantyExpires?: string | null
  nextDueAt?: string | null
  nextCalibrationDueAt?: string | null
}

/**
 * Unified asset-centric timeline: installs, PM, certificates, invoices, service, compliance cues.
 * Sorted oldest → newest (aligned with other lifecycle timelines).
 */
export function buildEquipmentLifecycleTimeline(
  meta: EquipmentTimelineMeta,
  workOrders: EquipmentTimelineWO[],
  invoices: EquipmentTimelineInvoice[],
  certs: EquipmentTimelineCert[],
  plans: EquipmentTimelinePlan[],
): ServiceTimelineEvent[] {
  const events: ServiceTimelineEvent[] = []
  const todayYmd = new Date().toISOString().slice(0, 10)

  if (meta.installDate?.trim()) {
    events.push({
      id: "eq-install",
      at: isoFromDate(meta.installDate.slice(0, 10)),
      label: "Installed / recorded",
      tone: "default",
    })
  }

  if (meta.warrantyExpires?.trim()) {
    events.push({
      id: "eq-warranty-end",
      at: isoFromDate(meta.warrantyExpires.slice(0, 10)),
      label: "Warranty expiration",
      tone: "info",
    })
  }

  for (const p of plans) {
    if (p.next_due_date?.trim()) {
      const nd = p.next_due_date.slice(0, 10)
      const overdue = nd < todayYmd
      events.push({
        id: `plan-${p.id}-due`,
        at: isoFromDate(nd),
        label: overdue ? "Maintenance overdue" : "Maintenance due",
        detail: p.name,
        tone: overdue ? "warning" : "info",
      })
    }
  }

  if (meta.nextDueAt?.trim()) {
    const nd = meta.nextDueAt.slice(0, 10)
    const overdue = nd < todayYmd
    events.push({
      id: "eq-next-service",
      at: isoFromDate(nd),
      label: overdue ? "Next service date (overdue)" : "Next service date",
      tone: overdue ? "warning" : "info",
    })
  }

  if (meta.nextCalibrationDueAt?.trim()) {
    const nd = meta.nextCalibrationDueAt.slice(0, 10)
    const overdue = nd < todayYmd
    events.push({
      id: "eq-next-cal",
      at: isoFromDate(nd),
      label: overdue ? "Calibration / compliance due (overdue)" : "Calibration / compliance due",
      tone: overdue ? "danger" : "warning",
    })
  }

  for (const wo of workOrders) {
    events.push({
      id: `wo-${wo.id}-opened`,
      at: wo.created_at,
      label: "Work order opened",
      detail: wo.title,
      tone: "default",
    })

    if (wo.technicianLabel?.trim()) {
      events.push({
        id: `wo-${wo.id}-tech`,
        at: wo.completed_at ?? wo.created_at,
        label: "Technician on service",
        detail: wo.technicianLabel.trim(),
        tone: "info",
      })
    }

    if (wo.maintenance_plan_id) {
      events.push({
        id: `wo-${wo.id}-pm`,
        at: wo.completed_at ?? wo.created_at,
        label: "Preventive maintenance visit",
        detail: wo.title,
        tone: "success",
      })
    }

    if (wo.completed_at && (wo.total_parts_cents ?? 0) > 0) {
      events.push({
        id: `wo-${wo.id}-parts`,
        at: wo.completed_at,
        label: "Parts & materials on work order",
        tone: "info",
      })
    }

    if (wo.completed_at) {
      events.push({
        id: `wo-${wo.id}-done`,
        at: wo.completed_at,
        label: "Service completed",
        detail: wo.title,
        tone: "success",
      })
    }
  }

  for (const c of certs) {
    events.push({
      id: `cert-${c.id}`,
      at: c.created_at,
      label: "Certificate / calibration record",
      detail: [c.templateName?.trim() || "Certificate", c.workOrderLabel?.trim()].filter(Boolean).join(" · "),
      tone: "success",
    })
  }

  for (const inv of invoices) {
    const at = inv.issued_at?.trim() ? isoFromDate(inv.issued_at.slice(0, 10)) : new Date().toISOString()
    const amt =
      inv.amount_cents != null
        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(inv.amount_cents / 100)
        : undefined
    events.push({
      id: `inv-${inv.id}`,
      at,
      label: "Invoice issued",
      detail: [inv.invoice_number?.trim() || inv.title?.trim() || "Invoice", inv.status, amt].filter(Boolean).join(" · "),
      tone: "info",
    })
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  return events
}

/** Aggregate invoice cents by manufacturer (requires caller to bucket equipment same manufacturer). */
export function sumInvoiceAmountCents(invoices: Pick<EquipmentTimelineInvoice, "amount_cents">[]): number {
  return invoices.reduce((s, i) => s + (typeof i.amount_cents === "number" ? i.amount_cents : 0), 0)
}
