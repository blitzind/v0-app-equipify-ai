import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type TrialOperationalSnapshot = {
  openWorkOrders: number
  agingScheduledWorkOrders: number
  staleProspects: number
  calibrationDueSoonEquipment: number
  maintenancePlansDueSoon: number
  overdueInvoiceCount: number
  workOrdersScheduledThisWeek: number
}

export const EMPTY_TRIAL_OPERATIONAL_SNAPSHOT: TrialOperationalSnapshot = {
  openWorkOrders: 0,
  agingScheduledWorkOrders: 0,
  staleProspects: 0,
  calibrationDueSoonEquipment: 0,
  maintenancePlansDueSoon: 0,
  overdueInvoiceCount: 0,
  workOrdersScheduledThisWeek: 0,
}

/**
 * Lightweight counts for trial AI mock enrichment — deterministic, org-scoped, no dollar amounts.
 */
export async function fetchTrialOperationalSnapshot(
  admin: SupabaseClient,
  organizationId: string,
): Promise<TrialOperationalSnapshot> {
  const oid = organizationId.trim()
  if (!oid) return { ...EMPTY_TRIAL_OPERATIONAL_SNAPSHOT }

  const today = new Date()
  const isoDate = today.toISOString().slice(0, 10)
  const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const weekStart = new Date(today)
  weekStart.setUTCDate(today.getUTCDate() - today.getUTCDay())
  const weekStartIso = weekStart.toISOString().slice(0, 10)

  try {
    const [
      openWo,
      agingWo,
      staleProspects,
      calSoon,
      pmSoon,
      overdueInv,
      woWeek,
    ] = await Promise.all([
      admin
        .from("work_orders")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", oid)
        .is("archived_at", null)
        .in("status", ["open", "scheduled", "in_progress"]),
      admin
        .from("work_orders")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", oid)
        .is("archived_at", null)
        .in("status", ["open", "scheduled", "in_progress"])
        .lt("scheduled_on", sevenDaysAgo.slice(0, 10)),
      admin
        .from("prospects")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", oid)
        .is("archived_at", null)
        .is("converted_customer_id", null)
        .or(`next_follow_up_at.is.null,next_follow_up_at.lt.${new Date().toISOString()}`),
      admin
        .from("equipment")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", oid)
        .is("archived_at", null)
        .not("next_calibration_due_at", "is", null)
        .lte("next_calibration_due_at", weekAhead)
        .gte("next_calibration_due_at", isoDate),
      admin
        .from("maintenance_plans")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", oid)
        .is("archived_at", null)
        .eq("status", "active")
        .not("next_due_date", "is", null)
        .lte("next_due_date", weekAhead)
        .gte("next_due_date", isoDate),
      admin
        .from("org_invoices")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", oid)
        .lt("due_date", isoDate)
        .in("status", ["sent", "unpaid", "overdue"]),
      admin
        .from("work_orders")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", oid)
        .is("archived_at", null)
        .gte("scheduled_on", weekStartIso)
        .lte("scheduled_on", weekAhead),
    ])

    return {
      openWorkOrders: openWo.count ?? 0,
      agingScheduledWorkOrders: agingWo.count ?? 0,
      staleProspects: staleProspects.count ?? 0,
      calibrationDueSoonEquipment: calSoon.count ?? 0,
      maintenancePlansDueSoon: pmSoon.count ?? 0,
      overdueInvoiceCount: overdueInv.count ?? 0,
      workOrdersScheduledThisWeek: woWeek.count ?? 0,
    }
  } catch {
    return { ...EMPTY_TRIAL_OPERATIONAL_SNAPSHOT }
  }
}
