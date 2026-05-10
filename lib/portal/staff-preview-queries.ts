import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { mapEquipmentStatus, mapMaintenancePlanStatus, mapQuoteStatus } from "@/lib/portal/display-mappers"
import { buildPortalCertificateItems } from "@/lib/portal/portal-certificate-items"
import { buildPortalDocuments } from "@/lib/portal/portal-documents"
import { resolvePortalDocumentScope } from "@/lib/portal/portal-document-scope"
import { fetchPortalInvoiceListItems } from "@/lib/portal/portal-invoice-list"
import { fetchPortalWorkOrderListItems } from "@/lib/portal/portal-work-order-list"
import { isPortalQuoteCustomerActionableDb, quotePastExpirationYmd } from "@/lib/org-quotes-invoices/quote-approval"
import { daysUntilDue, summarizeMaintenanceForecast } from "@/lib/maintenance-plans/forecast"
export async function staffPreviewEquipmentItems(svc: SupabaseClient, organizationId: string, customerId: string) {
  const { data, error } = await svc
    .from("equipment")
    .select(
      "id, name, equipment_code, manufacturer, category, serial_number, status, install_date, warranty_expires_at, last_service_at, next_due_at, location_label",
    )
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .order("name", { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    equipmentCode: (r.equipment_code as string | null) ?? null,
    manufacturer: (r.manufacturer as string | null) ?? null,
    category: (r.category as string | null) ?? null,
    serialNumber: (r.serial_number as string | null) ?? null,
    statusLabel: mapEquipmentStatus(r.status as string),
    installDate: (r.install_date as string | null) ?? null,
    warrantyExpiresAt: (r.warranty_expires_at as string | null) ?? null,
    lastServiceAt: (r.last_service_at as string | null) ?? null,
    nextDueAt: (r.next_due_at as string | null) ?? null,
    locationLabel: (r.location_label as string | null) ?? null,
  }))
}

/** Quote rows for staff preview — approval/decline are always disabled (no impersonation). */
export async function staffPreviewQuoteItems(svc: SupabaseClient, organizationId: string, customerId: string) {
  const { data, error } = await svc
    .from("org_quotes")
    .select("id, quote_number, title, amount_cents, status, created_at, expires_at")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  const todayYmd = new Date().toISOString().slice(0, 10)

  return (data ?? []).map((r) => {
    const status = r.status as string
    const pastExp = quotePastExpirationYmd(r.expires_at as string | null, todayYmd)
    const actionable = isPortalQuoteCustomerActionableDb(status) && !pastExp && status !== "expired"
    return {
      id: r.id as string,
      quoteNumber: r.quote_number as string,
      title: r.title as string,
      amountCents: r.amount_cents as number,
      statusLabel: mapQuoteStatus(status),
      statusDb: status,
      createdAt: r.created_at as string,
      expiresAt: (r.expires_at as string | null) ?? null,
      expiredByDate: pastExp && status !== "expired",
      /** Always false in staff preview — use live portal to exercise approval flows. */
      canApprove: false,
      canDecline: false,
      /** Whether the quote would be actionable for a real signed-in customer. */
      wouldBeActionableForCustomer: actionable,
    }
  })
}

export async function staffPreviewMaintenancePayload(svc: SupabaseClient, organizationId: string, customerId: string) {
  const { data: rows, error } = await svc
    .from("maintenance_plans")
    .select("id, name, status, priority, next_due_date, interval_value, interval_unit, equipment_id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .order("next_due_date", { ascending: true, nullsFirst: false })

  if (error) throw new Error(error.message)

  const eids = [...new Set((rows ?? []).map((r) => r.equipment_id).filter(Boolean))] as string[]
  let em = new Map<string, string>()
  if (eids.length > 0) {
    const { data: eqs } = await svc.from("equipment").select("id, name").eq("organization_id", organizationId).in("id", eids)
    em = new Map((eqs ?? []).map((e) => [e.id as string, (e.name as string) ?? ""]))
  }

  const items = (rows ?? []).map((p) => {
    const nextDue = (p.next_due_date as string | null) ?? null
    const offset = nextDue ? daysUntilDue(nextDue) : null
    return {
      id: p.id as string,
      name: p.name as string,
      statusLabel: mapMaintenancePlanStatus(p.status as string),
      priority: p.priority as string,
      nextDueDate: nextDue,
      intervalLabel: `${p.interval_value} ${p.interval_unit}`,
      equipmentName: em.get(p.equipment_id as string) ?? "Equipment",
      daysUntilNext: offset,
    }
  })

  const forecast = summarizeMaintenanceForecast(
    (rows ?? []).map((r) => ({
      id: r.id as string,
      status: String(r.status ?? ""),
      next_due_date: (r.next_due_date as string | null) ?? null,
      is_archived: false,
      customer_id: customerId,
      equipment_id: (r.equipment_id as string | null) ?? null,
      equipment_name: em.get(r.equipment_id as string) ?? "Equipment",
    })),
  )

  return {
    items,
    forecast: {
      forecastableCount: forecast.forecastableCount,
      overdue: forecast.exclusive.overdue,
      cumulative: forecast.cumulative,
      exclusive: forecast.exclusive,
    },
  }
}

export async function staffPreviewDocumentsPack(svc: SupabaseClient, organizationId: string, customerId: string) {
  const scope = await resolvePortalDocumentScope(svc, {
    organizationId,
    rootCustomerId: customerId,
  })
  return buildPortalDocuments(svc, {
    organizationId,
    customerIds: scope.customerIds,
    accountLabels: scope.accountLabels,
    rootCustomerId: scope.rootCustomerId,
    rollupEnabled: scope.rollupEnabled,
  })
}

export async function staffPreviewCertificates(svc: SupabaseClient, organizationId: string, customerId: string) {
  return buildPortalCertificateItems(svc, organizationId, customerId)
}

export { fetchPortalInvoiceListItems, fetchPortalWorkOrderListItems }
