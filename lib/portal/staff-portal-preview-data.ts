import type { SupabaseClient } from "@supabase/supabase-js"
import { buildPortalDocuments } from "@/lib/portal/portal-documents"
import { resolvePortalDocumentScope } from "@/lib/portal/portal-document-scope"
import { fetchPortalDashboardBundle, type PortalDashboardBundle } from "@/lib/portal/portal-dashboard-bundle"
import { portalDisplayStatus } from "@/lib/service-requests/portal-display-status"
import type { ServiceRequestStatus } from "@/lib/service-requests/types"

export type StaffPortalPreviewCustomerSource = "sample" | "active"

export type StaffPortalPreviewSnapshot = {
  /** True when scoped to a real org customer (sample preferred, else first active). */
  hasPreviewCustomer: boolean
  previewCustomer: {
    id: string
    companyName: string
    source: StaffPortalPreviewCustomerSource
  } | null
  dashboard: PortalDashboardBundle | null
  /** Portal document library: items the customer could see (release rules applied). */
  documentsAvailable: number
  documentsListed: number
  recentDocument: {
    title: string
    kind: string
    statusLabel: string
    occurredAt: string
  } | null
  openServiceRequests: number
  recentServiceRequest: {
    summary: string
    statusLabel: string
    createdAt: string
  } | null
  equipmentSpotlight: {
    name: string
    detail: string | null
  } | null
  /**
   * When true, show a small secondary “layout reference” strip (no per-card fiction
   * when real rows exist).
   */
  showLayoutFallback: boolean
}

async function pickPreviewCustomer(
  svc: SupabaseClient,
  organizationId: string,
): Promise<{ id: string; companyName: string; source: StaffPortalPreviewCustomerSource } | null> {
  const { data: sample } = await svc
    .from("customers")
    .select("id, company_name")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("is_archived", false)
    .eq("is_sample", true)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (sample?.id && sample.company_name) {
    return {
      id: sample.id as string,
      companyName: String(sample.company_name).trim(),
      source: "sample",
    }
  }

  const { data: anyCustomer } = await svc
    .from("customers")
    .select("id, company_name")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("is_archived", false)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (anyCustomer?.id && anyCustomer.company_name) {
    return {
      id: anyCustomer.id as string,
      companyName: String(anyCustomer.company_name).trim(),
      source: "active",
    }
  }

  return null
}

/**
 * Read-only snapshot for `/portal/preview` — caller must already verify staff org access.
 * Uses the same aggregations as the customer dashboard + document library scope resolver.
 */
export async function loadStaffPortalPreviewSnapshot(
  svc: SupabaseClient,
  organizationId: string,
): Promise<StaffPortalPreviewSnapshot> {
  const previewCustomer = await pickPreviewCustomer(svc, organizationId)

  if (!previewCustomer) {
    return {
      hasPreviewCustomer: false,
      previewCustomer: null,
      dashboard: null,
      documentsAvailable: 0,
      documentsListed: 0,
      recentDocument: null,
      openServiceRequests: 0,
      recentServiceRequest: null,
      equipmentSpotlight: null,
      showLayoutFallback: true,
    }
  }

  const custId = previewCustomer.id

  const [
    dashboard,
    openSrRes,
    recentSrRes,
    equipSpotRes,
    docScope,
  ] = await Promise.all([
    fetchPortalDashboardBundle(svc, organizationId, custId),
    svc
      .from("org_service_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("customer_id", custId)
      .in("status", ["new", "reviewing", "approved", "needs_info"]),
    svc
      .from("org_service_requests")
      .select("issue_summary, status, created_at")
      .eq("organization_id", organizationId)
      .eq("customer_id", custId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    svc
      .from("equipment")
      .select("name, manufacturer, category, location_label, serial_number")
      .eq("organization_id", organizationId)
      .eq("customer_id", custId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    resolvePortalDocumentScope(svc, { organizationId, rootCustomerId: custId }),
  ])

  let documentsAvailable = 0
  let documentsListed = 0
  let recentDocument: StaffPortalPreviewSnapshot["recentDocument"] = null

  try {
    const docPack = await buildPortalDocuments(svc, {
      organizationId,
      customerIds: docScope.customerIds,
      accountLabels: docScope.accountLabels,
      rootCustomerId: docScope.rootCustomerId,
      rollupEnabled: docScope.rollupEnabled,
    })
    documentsListed = docPack.items.length
    documentsAvailable = docPack.countsByAvailability.available ?? 0
    const sorted = [...docPack.items].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    const pick = sorted.find((it) => it.viewPath || it.downloadPath) ?? sorted[0]
    if (pick) {
      recentDocument = {
        title: pick.title,
        kind: pick.kind.replace(/_/g, " "),
        statusLabel: pick.statusLabel,
        occurredAt: pick.occurredAt,
      }
    }
  } catch {
    documentsAvailable = dashboard.certificateSummary.unlocked
    documentsListed = dashboard.certificateSummary.total
  }

  const openServiceRequests = openSrRes.count ?? 0
  const srRow = recentSrRes.data as
    | { issue_summary?: string; status?: string; created_at?: string }
    | null
  const recentServiceRequest =
    srRow?.issue_summary && srRow.created_at ?
      {
        summary: String(srRow.issue_summary),
        statusLabel: portalDisplayStatus((srRow.status ?? "new") as ServiceRequestStatus),
        createdAt: srRow.created_at,
      }
    : null

  const eq = equipSpotRes.data as {
    name?: string
    manufacturer?: string | null
    category?: string | null
    location_label?: string | null
    serial_number?: string | null
  } | null

  let equipmentSpotlight: StaffPortalPreviewSnapshot["equipmentSpotlight"] = null
  if (eq?.name) {
    const parts = [eq.manufacturer?.trim(), eq.category?.trim()].filter(Boolean)
    let detail = parts.length > 0 ? parts.join(" · ") : null
    if (eq.location_label?.trim()) {
      detail = detail ? `${detail} · ${eq.location_label.trim()}` : eq.location_label.trim()
    }
    if (eq.serial_number?.trim()) {
      const tail = eq.serial_number.trim().slice(-4)
      detail = detail ? `${detail} · Serial …${tail}` : `Serial …${tail}`
    }
    equipmentSpotlight = { name: eq.name, detail }
  }

  const hasSignal =
    dashboard.stats.equipmentTotal > 0 ||
    dashboard.stats.openWorkOrders > 0 ||
    dashboard.stats.unpaidInvoiceCount > 0 ||
    documentsAvailable > 0 ||
    openServiceRequests > 0 ||
    dashboard.nextAppointment != null ||
    dashboard.recentCompletedService != null ||
    dashboard.recentWorkOrders.length > 0 ||
    dashboard.recentInvoices.length > 0 ||
    recentServiceRequest != null ||
    equipmentSpotlight != null ||
    recentDocument != null ||
    dashboard.certificateSummary.total > 0 ||
    dashboard.nextScheduledService != null

  const showLayoutFallback = !hasSignal

  return {
    hasPreviewCustomer: true,
    previewCustomer,
    dashboard,
    documentsAvailable,
    documentsListed,
    recentDocument,
    openServiceRequests,
    recentServiceRequest,
    equipmentSpotlight,
    showLayoutFallback,
  }
}
