import type { SupabaseClient } from "@supabase/supabase-js"
import type { LinkedInvoiceRow } from "@/lib/portal/work-order-invoices"

/** Operational aging buckets for unpaid invoice exposure (not accounting). */
export type InvoiceAgingBucket =
  | "current"
  | "due_soon"
  | "od_1_15"
  | "od_16_30"
  | "od_31_60"
  | "od_60_plus"

export type WoInvoiceAggregate = {
  maxDaysOverdue: number
  hasDueSoon: boolean
  hasOverdue: boolean
  hasAnyUnpaid: boolean
  worstBucket: InvoiceAgingBucket
}

const PAID = "paid"

function ymdParts(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysBetweenYmd(startYmd: string, endYmd: string): number {
  const a = new Date(startYmd + "T12:00:00Z").getTime()
  const b = new Date(endYmd + "T12:00:00Z").getTime()
  return Math.round((b - a) / 86400000)
}

function bucketForOverdueDays(d: number): Exclude<InvoiceAgingBucket, "current" | "due_soon"> {
  if (d <= 15) return "od_1_15"
  if (d <= 30) return "od_16_30"
  if (d <= 60) return "od_31_60"
  return "od_60_plus"
}

function emptyAgg(): WoInvoiceAggregate {
  return {
    maxDaysOverdue: 0,
    hasDueSoon: false,
    hasOverdue: false,
    hasAnyUnpaid: false,
    worstBucket: "current",
  }
}

type InvRow = {
  id: string
  status: string
  due_date: string | null
  issued_at: string | null
  work_order_id: string | null
  portal_certificate_release_override: string | null
}

/**
 * Single batch pass: linked invoices per work order + operational aging aggregates.
 * Merges legacy `work_order_id` with `invoice_work_order_links` (deduped per WO).
 */
export async function fetchWorkOrderInvoiceOpsBatch(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderIds: string[],
): Promise<{
  aggregates: Map<string, WoInvoiceAggregate>
  linkedByWo: Map<string, LinkedInvoiceRow[]>
}> {
  const aggregates = new Map<string, WoInvoiceAggregate>()
  const linkedByWo = new Map<string, LinkedInvoiceRow[]>()
  for (const id of workOrderIds) {
    aggregates.set(id, emptyAgg())
    linkedByWo.set(id, [])
  }
  if (workOrderIds.length === 0) return { aggregates, linkedByWo }

  const todayYmd = ymdParts(new Date())

  const [directRes, linkRes] = await Promise.all([
    supabase
      .from("org_invoices")
      .select("id, status, due_date, issued_at, work_order_id, portal_certificate_release_override")
      .eq("organization_id", organizationId)
      .in("work_order_id", workOrderIds),
    supabase
      .from("invoice_work_order_links")
      .select("invoice_id, work_order_id")
      .eq("organization_id", organizationId)
      .in("work_order_id", workOrderIds),
  ])

  if (directRes.error) throw new Error(directRes.error.message)
  if (linkRes.error) throw new Error(linkRes.error.message)

  const byWo = new Map<string, Map<string, InvRow>>()

  function addInv(woId: string, row: InvRow) {
    let m = byWo.get(woId)
    if (!m) {
      m = new Map()
      byWo.set(woId, m)
    }
    m.set(row.id, row)
  }

  for (const row of (directRes.data ?? []) as InvRow[]) {
    if (row.work_order_id) addInv(row.work_order_id, row)
  }

  const extraIds = new Set<string>()
  for (const r of (linkRes.data ?? []) as { invoice_id: string; work_order_id: string }[]) {
    extraIds.add(r.invoice_id)
  }

  if (extraIds.size > 0) {
    const { data: extraRows, error } = await supabase
      .from("org_invoices")
      .select("id, status, due_date, issued_at, work_order_id, portal_certificate_release_override")
      .eq("organization_id", organizationId)
      .in("id", [...extraIds])
    if (error) throw new Error(error.message)
    const invMap = new Map((extraRows ?? []).map((r) => [(r as InvRow).id, r as InvRow]))
    for (const r of (linkRes.data ?? []) as { invoice_id: string; work_order_id: string }[]) {
      const inv = invMap.get(r.invoice_id)
      if (inv) addInv(r.work_order_id, inv)
    }
  }

  const sevenDays = new Date()
  sevenDays.setUTCDate(sevenDays.getUTCDate() + 7)
  const sevenYmd = ymdParts(sevenDays)

  for (const woId of workOrderIds) {
    const invMap = byWo.get(woId)
    const linked: LinkedInvoiceRow[] = invMap
      ? [...invMap.values()].map((inv) => ({
          id: inv.id,
          status: inv.status,
          portal_certificate_release_override: inv.portal_certificate_release_override,
        }))
      : []
    linkedByWo.set(woId, linked)

    if (!invMap || invMap.size === 0) continue

    let maxDaysOverdue = 0
    let hasDueSoon = false
    let hasOverdue = false
    let hasAnyUnpaid = false

    for (const inv of invMap.values()) {
      if (inv.status === PAID) continue
      hasAnyUnpaid = true
      const due = inv.due_date?.trim()
        ? inv.due_date.trim().slice(0, 10)
        : inv.issued_at?.trim()
          ? inv.issued_at.trim().slice(0, 10)
          : null

      if (!due) continue

      if (due < todayYmd) {
        const od = daysBetweenYmd(due, todayYmd)
        if (od > maxDaysOverdue) maxDaysOverdue = od
        hasOverdue = true
      } else if (due <= sevenYmd && due >= todayYmd) {
        hasDueSoon = true
      }
    }

    let worstBucket: InvoiceAgingBucket = "current"
    if (maxDaysOverdue > 0) {
      worstBucket = bucketForOverdueDays(maxDaysOverdue)
    } else if (hasDueSoon) {
      worstBucket = "due_soon"
    }

    aggregates.set(woId, {
      maxDaysOverdue,
      hasDueSoon,
      hasOverdue,
      hasAnyUnpaid,
      worstBucket,
    })
  }

  return { aggregates, linkedByWo }
}
