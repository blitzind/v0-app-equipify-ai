import type { SupabaseClient } from "@supabase/supabase-js"
import { modeLabel } from "@/lib/portal/certificate-release-staff"
import type { CertificateReleaseMode } from "@/lib/portal/certificate-release"
import { resolveEffectiveCertificateReleaseMode } from "@/lib/portal/certificate-release"
import { buildPortalDocuments } from "@/lib/portal/portal-documents"
import { resolvePortalDocumentScope } from "@/lib/portal/portal-document-scope"
import { fetchPortalDashboardBundle, type PortalDashboardBundle } from "@/lib/portal/portal-dashboard-bundle"
import { portalDisplayStatus } from "@/lib/service-requests/portal-display-status"
import type { ServiceRequestStatus } from "@/lib/service-requests/types"

export type StaffPortalPreviewCustomerSource = "sample" | "active"

export type StaffPortalPreviewCustomerOption = {
  id: string
  companyName: string
  source: StaffPortalPreviewCustomerSource
  recordStatus: "active" | "inactive"
}

/** Mirrors org + customer portal defaults that affect documents / certificates (live portal uses the same rows). */
export type StaffPortalPreviewWorkspaceContext = {
  effectiveCertificateReleaseMode: CertificateReleaseMode
  effectiveCertificateReleaseLabel: string
  documentRollupEnabled: boolean
  documentSchemaMigrationPending: boolean
}

export type StaffPortalPreviewSnapshot = {
  /** Customers available for the staff preview picker (non-archived). */
  customerOptions: StaffPortalPreviewCustomerOption[]
  /** True when scoped to a real org customer (URL param, or first available). */
  hasPreviewCustomer: boolean
  previewCustomer: {
    id: string
    companyName: string
    source: StaffPortalPreviewCustomerSource
    /** Row status — preview may fall back to inactive when no active customers exist. */
    recordStatus: "active" | "inactive"
  } | null
  /** Present when `hasPreviewCustomer`; aligns certificate + document scope with the customer portal. */
  workspacePortalContext: StaffPortalPreviewWorkspaceContext | null
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

const PREVIEW_CUSTOMER_LIST_LIMIT = 500

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function toCustomerOption(row: {
  id: string
  company_name: string
  is_sample?: boolean | null
  status?: string | null
}): StaffPortalPreviewCustomerOption | null {
  const name = String(row.company_name ?? "").trim()
  if (!row.id || !name) return null

  const recordStatus: "active" | "inactive" = row.status === "inactive" ? "inactive" : "active"
  const isSample = row.is_sample === true
  return {
    id: row.id,
    companyName: name,
    source: isSample ? "sample" : "active",
    recordStatus,
  }
}

async function fetchPreviewCustomerOptions(
  svc: SupabaseClient,
  organizationId: string,
): Promise<StaffPortalPreviewCustomerOption[]> {
  const { data: rows, error } = await svc
    .from("customers")
    .select("id, company_name, is_sample, status")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("is_sample", { ascending: false })
    .order("status", { ascending: true })
    .order("company_name", { ascending: true })
    .limit(PREVIEW_CUSTOMER_LIST_LIMIT)

  if (error || !rows?.length) return []

  return (
    rows as Array<{
      id: string
      company_name: string
      is_sample?: boolean | null
      status?: string | null
    }>
  )
    .map(toCustomerOption)
    .filter((x): x is StaffPortalPreviewCustomerOption => x != null)
}

/** Single customer verified for org + not archived (staff preview; no cross-org). */
async function fetchCustomerOptionById(
  svc: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<StaffPortalPreviewCustomerOption | null> {
  const { data: row, error } = await svc
    .from("customers")
    .select("id, company_name, is_sample, status")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .is("archived_at", null)
    .maybeSingle()

  if (error || !row) return null
  return toCustomerOption(row as {
    id: string
    company_name: string
    is_sample?: boolean | null
    status?: string | null
  })
}

function emptySnapshot(customerOptions: StaffPortalPreviewCustomerOption[]): StaffPortalPreviewSnapshot {
  return {
    customerOptions,
    hasPreviewCustomer: false,
    previewCustomer: null,
    workspacePortalContext: null,
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

/**
 * Read-only snapshot for `/portal/preview` — caller must already verify staff org access.
 * Uses the same aggregations as the customer dashboard + document library scope resolver.
 *
 * @param opts.customerId When a valid UUID for a non-archived customer in this org, use it;
 *   otherwise the first available customer is selected.
 */
export async function loadStaffPortalPreviewSnapshot(
  svc: SupabaseClient,
  organizationId: string,
  opts?: { customerId?: string | null },
): Promise<StaffPortalPreviewSnapshot> {
  const customerOptions = await fetchPreviewCustomerOptions(svc, organizationId)

  const requestedRaw = opts?.customerId?.trim() ?? ""
  const requestedId = UUID_RE.test(requestedRaw) ? requestedRaw : ""

  let previewCustomer: StaffPortalPreviewSnapshot["previewCustomer"] = null
  if (requestedId) {
    previewCustomer = await fetchCustomerOptionById(svc, organizationId, requestedId)
  }
  if (!previewCustomer && customerOptions.length > 0) {
    previewCustomer = customerOptions[0]!
  }

  if (!previewCustomer) {
    return emptySnapshot(customerOptions)
  }

  const custId = previewCustomer.id

  const [
    dashboard,
    openSrRes,
    recentSrRes,
    equipSpotRes,
    docScope,
    orgCertRes,
    custCertRes,
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
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    resolvePortalDocumentScope(svc, { organizationId, rootCustomerId: custId }),
    svc.from("organizations").select("portal_certificate_release_mode").eq("id", organizationId).maybeSingle(),
    svc
      .from("customers")
      .select("portal_certificate_release_mode")
      .eq("organization_id", organizationId)
      .eq("id", custId)
      .maybeSingle(),
  ])

  const orgCertMode = (orgCertRes.data as { portal_certificate_release_mode?: string | null } | null)
    ?.portal_certificate_release_mode
  const custCertMode = (custCertRes.data as { portal_certificate_release_mode?: string | null } | null)
    ?.portal_certificate_release_mode
  const effectiveCertificateReleaseMode = resolveEffectiveCertificateReleaseMode({
    organizationMode: orgCertMode,
    customerMode: custCertMode,
    invoiceOverrides: [],
  })

  const workspacePortalContext: StaffPortalPreviewWorkspaceContext = {
    effectiveCertificateReleaseMode,
    effectiveCertificateReleaseLabel: modeLabel(effectiveCertificateReleaseMode),
    documentRollupEnabled: docScope.rollupEnabled,
    documentSchemaMigrationPending: docScope.schemaMigrationPending,
  }

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
    customerOptions,
    hasPreviewCustomer: true,
    previewCustomer,
    workspacePortalContext,
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
