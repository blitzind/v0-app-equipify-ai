/**
 * Customer Portal Document Library — Phase 1
 *
 * Aggregates the documents a portal customer is allowed to see into a single,
 * unified shape so the new `/portal/documents` page can group/filter without
 * duplicating any release logic.
 *
 * Strict rules:
 *   - Tenant-scoped via `organization_id` and customer scoping is preserved.
 *   - Reuses existing release evaluation for certificates
 *     (`buildPortalCertificateItems`) — never opens a new release path.
 *   - Certificate attachments inherit the locked/unlocked state of their
 *     parent calibration record. Attachments that have no parent record
 *     (rare/legacy) are deliberately excluded from the portal here; future
 *     phases can introduce explicit release semantics for those.
 *   - Customer-facing copy never exposes raw UUIDs. Storage paths stay
 *     server-side; downloads go through purpose-built API routes.
 *   - Customer arg accepts an array so we are forward-compatible with the
 *     parent/child rollup foundation, but Phase 1 callers always pass a
 *     single id matching `portalUser.customer_id`.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildPortalCertificateItems,
  type PortalCertificateItem,
} from "@/lib/portal/portal-certificate-items"
import { mapInvoiceStatus, mapWorkOrderStatus } from "@/lib/portal/display-mappers"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"

export type PortalDocumentKind =
  | "invoice"
  | "certificate"
  | "work_order_summary"
  | "certificate_attachment"

export type PortalDocumentAvailability =
  | "available"
  | "awaiting_payment"
  | "awaiting_release"
  | "not_yet_available"

export type PortalDocumentItem = {
  /**
   * Stable client-side key. Format: `<kind>:<sourceId>` so the UI never
   * needs to construct it from raw UUIDs.
   */
  key: string
  kind: PortalDocumentKind
  /** Customer-facing title — never a UUID. */
  title: string
  /** Optional short subtitle, e.g. equipment + location. */
  subtitle: string | null
  /** ISO timestamp used for date-range filtering and sort. */
  occurredAt: string
  /** Human-readable equipment label (or `null` for org-wide documents). */
  equipmentLabel: string | null
  /** Service location label when known (preserves portal continuity). */
  locationLabel: string | null
  availability: PortalDocumentAvailability
  /** Customer-facing reason / next-step hint. */
  availabilityReason: string
  /** Click target inside the portal (page route, never an API route). */
  viewPath: string | null
  /**
   * Direct file/HTML download URL. Always a server-vetted endpoint that
   * re-checks portal session + release rules; never a raw storage URL.
   * `null` when the document is not yet downloadable.
   */
  downloadPath: string | null
  /** Status pill text (e.g. "Paid", "Awaiting payment"). */
  statusLabel: string
  /** Lightweight metadata for filtering. Never includes raw UUIDs. */
  meta: {
    invoiceNumber: string | null
    workOrderNumber: number | null
    workOrderDisplay: string | null
  }
}

export type PortalDocumentsResult = {
  items: PortalDocumentItem[]
  /** Distinct equipment options for the filter dropdown. */
  equipmentOptions: Array<{ value: string; label: string }>
  /** Counts by kind, computed once on the server. */
  countsByKind: Record<PortalDocumentKind, number>
  /** Counts by availability state, used to drive the UI banners. */
  countsByAvailability: Record<PortalDocumentAvailability, number>
}

const EMPTY_KIND_COUNTS: Record<PortalDocumentKind, number> = {
  invoice: 0,
  certificate: 0,
  work_order_summary: 0,
  certificate_attachment: 0,
}

const EMPTY_AVAIL_COUNTS: Record<PortalDocumentAvailability, number> = {
  available: 0,
  awaiting_payment: 0,
  awaiting_release: 0,
  not_yet_available: 0,
}

/** Internal: extract a customer-friendly availability for an invoice row. */
function invoiceAvailability(status: string): PortalDocumentAvailability {
  switch (status) {
    case "paid":
      return "available"
    case "draft":
      // Draft invoices should never reach the portal; this is a safety net.
      return "not_yet_available"
    case "overdue":
    case "sent":
    default:
      // The invoice document itself is always viewable; the portal page
      // exposes pay-status separately. We keep "available" here so the
      // customer can read the invoice to act on it.
      return "available"
  }
}

function woSummaryAvailability(status: string): PortalDocumentAvailability {
  if (status === "completed" || status === "completed_pending_signature") return "available"
  if (status === "invoiced") return "available"
  return "not_yet_available"
}

function reasonForAvailability(a: PortalDocumentAvailability): string {
  switch (a) {
    case "available":
      return "Ready to view or download."
    case "awaiting_payment":
      return "Becomes available once the related invoice is paid."
    case "awaiting_release":
      return "Your service provider hasn't released this yet."
    case "not_yet_available":
      return "Not yet available — typically appears once service or invoicing is complete."
  }
}

/** Map a `PortalCertificateItem` into the unified document shape. */
function certificateToDocument(c: PortalCertificateItem): PortalDocumentItem {
  let availability: PortalDocumentAvailability
  if (c.unlocked) availability = "available"
  else if (c.reasonCode === "locked_payment") availability = "awaiting_payment"
  else if (c.reasonCode === "locked_manual") availability = "awaiting_release"
  else availability = "not_yet_available"

  return {
    key: `certificate:${c.id}`,
    kind: "certificate",
    title: c.templateName || "Certificate",
    subtitle: c.equipmentName,
    occurredAt: c.createdAt,
    equipmentLabel: c.equipmentName,
    locationLabel: c.equipmentLocationLabel,
    availability,
    availabilityReason: c.reasonLabel || reasonForAvailability(availability),
    // Certificates don't have a portal detail page yet; the certificates
    // index already shows full state. Link there for context.
    viewPath: "/portal/certificates",
    downloadPath: c.downloadPath,
    statusLabel:
      availability === "available"
        ? "Available"
        : availability === "awaiting_payment"
          ? "Awaiting payment"
          : availability === "awaiting_release"
            ? "Awaiting release"
            : "Not yet available",
    meta: {
      invoiceNumber: null,
      workOrderNumber: null,
      workOrderDisplay: c.workOrderId
        ? getWorkOrderDisplay({ id: c.workOrderId, workOrderNumber: null })
        : null,
    },
  }
}

/**
 * Build the unified document list for one (or, in the future, several)
 * portal customers within a single workspace.
 */
export async function buildPortalDocuments(
  svc: SupabaseClient,
  args: { organizationId: string; customerIds: string[] },
): Promise<PortalDocumentsResult> {
  const { organizationId, customerIds } = args
  const empty: PortalDocumentsResult = {
    items: [],
    equipmentOptions: [],
    countsByKind: { ...EMPTY_KIND_COUNTS },
    countsByAvailability: { ...EMPTY_AVAIL_COUNTS },
  }
  if (customerIds.length === 0) return empty

  const equipmentLabelById = new Map<string, string>()
  const locationLabelById = new Map<string, string | null>()

  // ─── Invoices ────────────────────────────────────────────────────────────
  const { data: invRows, error: invErr } = await svc
    .from("org_invoices")
    .select(
      "id, invoice_number, title, amount_cents, status, issued_at, paid_at, due_date, equipment_id",
    )
    .eq("organization_id", organizationId)
    .in("customer_id", customerIds)
    .neq("status", "draft")
    .neq("status", "void")
    .order("issued_at", { ascending: false })
    .limit(400)

  if (invErr) throw new Error(invErr.message)

  // ─── Work orders (for both summaries + certificate aggregation) ─────────
  const { data: woRows, error: woErr } = await svc
    .from("work_orders")
    .select(
      "id, work_order_number, title, status, scheduled_on, completed_at, equipment_id, customer_id",
    )
    .eq("organization_id", organizationId)
    .in("customer_id", customerIds)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(400)

  if (woErr) throw new Error(woErr.message)

  // Pre-fetch the equipment labels referenced by either invoices or WOs.
  const equipIds = new Set<string>()
  for (const r of invRows ?? []) {
    const eid = (r as { equipment_id?: string | null }).equipment_id
    if (eid) equipIds.add(eid)
  }
  for (const r of woRows ?? []) {
    const eid = (r as { equipment_id?: string | null }).equipment_id
    if (eid) equipIds.add(eid)
  }
  if (equipIds.size > 0) {
    const { data: eqs } = await svc
      .from("equipment")
      .select("id, name, location_label")
      .eq("organization_id", organizationId)
      .in("id", [...equipIds])
    for (const e of (eqs ?? []) as Array<{
      id: string
      name: string | null
      location_label: string | null
    }>) {
      equipmentLabelById.set(e.id, (e.name ?? "").trim() || "Equipment")
      locationLabelById.set(e.id, (e.location_label ?? null) || null)
    }
  }

  const items: PortalDocumentItem[] = []

  for (const r of (invRows ?? []) as Array<{
    id: string
    invoice_number: string | null
    title: string | null
    status: string
    issued_at: string
    paid_at: string | null
    due_date: string | null
    equipment_id: string | null
  }>) {
    const eid = r.equipment_id ?? null
    const eqLabel = eid ? equipmentLabelById.get(eid) ?? null : null
    const availability = invoiceAvailability(r.status)
    const statusLabel = mapInvoiceStatus(r.status)
    const number = r.invoice_number?.trim() || null
    items.push({
      key: `invoice:${r.id}`,
      kind: "invoice",
      title: number ? `Invoice ${number}` : r.title?.trim() || "Invoice",
      subtitle: r.title?.trim() || null,
      occurredAt: r.issued_at,
      equipmentLabel: eqLabel,
      locationLabel: eid ? locationLabelById.get(eid) ?? null : null,
      availability,
      availabilityReason:
        r.status === "paid"
          ? "Paid in full."
          : r.status === "overdue"
            ? "Overdue — payment still owed."
            : "Open — payment outstanding.",
      viewPath: `/portal/invoices/${r.id}`,
      // Phase 1: no PDF download yet. The detail page is the document.
      downloadPath: null,
      statusLabel,
      meta: {
        invoiceNumber: number,
        workOrderNumber: null,
        workOrderDisplay: null,
      },
    })
  }

  // ─── Work order summaries ───────────────────────────────────────────────
  for (const w of (woRows ?? []) as Array<{
    id: string
    work_order_number: number | null
    title: string | null
    status: string
    scheduled_on: string | null
    completed_at: string | null
    equipment_id: string | null
  }>) {
    const availability = woSummaryAvailability(w.status)
    if (availability === "not_yet_available") continue // Don't surface in-flight WOs as documents.
    const eid = w.equipment_id ?? null
    const eqLabel = eid ? equipmentLabelById.get(eid) ?? null : null
    const display = getWorkOrderDisplay({ id: w.id, workOrderNumber: w.work_order_number })
    const occurredAt =
      w.completed_at ?? (w.scheduled_on ? `${w.scheduled_on}T12:00:00` : new Date().toISOString())
    items.push({
      key: `work_order_summary:${w.id}`,
      kind: "work_order_summary",
      title: `Service summary — ${display}`,
      subtitle: w.title?.trim() || null,
      occurredAt,
      equipmentLabel: eqLabel,
      locationLabel: eid ? locationLabelById.get(eid) ?? null : null,
      availability,
      availabilityReason:
        w.status === "completed"
          ? "Service complete — full summary available."
          : w.status === "completed_pending_signature"
            ? "Service complete; signature still pending on file."
            : w.status === "invoiced"
              ? "Service complete and invoiced."
              : reasonForAvailability(availability),
      viewPath: "/portal/work-orders",
      downloadPath: null,
      statusLabel: mapWorkOrderStatus(w.status),
      meta: {
        invoiceNumber: null,
        workOrderNumber: w.work_order_number ?? null,
        workOrderDisplay: display,
      },
    })
  }

  // ─── Certificates (reuses existing release rules verbatim) ──────────────
  // For the parent-rollup foundation we iterate per-customer-id; in practice
  // Phase 1 always passes a single id so this is just one call.
  const certIndexByRecordId = new Map<string, PortalCertificateItem>()
  for (const customerId of customerIds) {
    try {
      const pack = await buildPortalCertificateItems(svc, organizationId, customerId)
      for (const c of pack.items) {
        items.push(certificateToDocument(c))
        certIndexByRecordId.set(c.id, c)
      }
    } catch {
      // Schema-drift safe: skip rather than 500.
    }
  }

  // ─── Certificate attachments tied to released records ───────────────────
  // Schema-drift safe: skip silently when the table is missing.
  const recordIds = [...certIndexByRecordId.keys()]
  if (recordIds.length > 0) {
    const { data: attRows, error: attErr } = await svc
      .from("certificate_attachments")
      .select(
        "id, work_order_id, equipment_id, calibration_record_id, category, file_name, file_type, file_size_bytes, uploaded_at",
      )
      .eq("organization_id", organizationId)
      .in("calibration_record_id", recordIds)
      .order("uploaded_at", { ascending: false })

    if (!attErr && attRows) {
      for (const row of attRows as Array<{
        id: string
        work_order_id: string
        equipment_id: string | null
        calibration_record_id: string | null
        category: string
        file_name: string
        file_type: string
        file_size_bytes: number | null
        uploaded_at: string
      }>) {
        const parent = row.calibration_record_id
          ? certIndexByRecordId.get(row.calibration_record_id) ?? null
          : null
        // Phase 1: only surface attachments that ride on top of a parent
        // calibration record we already evaluated above. This keeps the
        // release rule identical to the certificate's own rule — no new
        // release semantics are introduced here.
        if (!parent) continue

        let availability: PortalDocumentAvailability
        if (parent.unlocked) availability = "available"
        else if (parent.reasonCode === "locked_payment") availability = "awaiting_payment"
        else if (parent.reasonCode === "locked_manual") availability = "awaiting_release"
        else availability = "not_yet_available"

        const eid = row.equipment_id ?? null
        const eqLabel = eid ? equipmentLabelById.get(eid) ?? parent.equipmentName ?? null : parent.equipmentName ?? null
        const locationLabel =
          eid ? locationLabelById.get(eid) ?? parent.equipmentLocationLabel ?? null : parent.equipmentLocationLabel ?? null

        items.push({
          key: `certificate_attachment:${row.id}`,
          kind: "certificate_attachment",
          title: row.file_name?.trim() || "Certificate attachment",
          subtitle:
            row.category === "external_calibration"
              ? "Uploaded calibration document"
              : "Supplementary document",
          occurredAt: row.uploaded_at,
          equipmentLabel: eqLabel,
          locationLabel,
          availability,
          availabilityReason:
            availability === "available"
              ? "Available alongside the released certificate."
              : parent.reasonLabel || reasonForAvailability(availability),
          viewPath: "/portal/certificates",
          downloadPath:
            availability === "available"
              ? `/api/portal/certificate-attachments/${row.id}/download`
              : null,
          statusLabel:
            availability === "available"
              ? "Available"
              : availability === "awaiting_payment"
                ? "Awaiting payment"
                : availability === "awaiting_release"
                  ? "Awaiting release"
                  : "Not yet available",
          meta: {
            invoiceNumber: null,
            workOrderNumber: null,
            workOrderDisplay: row.work_order_id
              ? getWorkOrderDisplay({ id: row.work_order_id, workOrderNumber: null })
              : null,
          },
        })
      }
    }
  }

  // ─── Final sort: newest first by occurredAt ─────────────────────────────
  items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())

  // ─── Summary aggregates ─────────────────────────────────────────────────
  const countsByKind: Record<PortalDocumentKind, number> = { ...EMPTY_KIND_COUNTS }
  const countsByAvailability: Record<PortalDocumentAvailability, number> = {
    ...EMPTY_AVAIL_COUNTS,
  }
  const equipmentLabelSet = new Map<string, string>()
  for (const it of items) {
    countsByKind[it.kind] += 1
    countsByAvailability[it.availability] += 1
    if (it.equipmentLabel) {
      equipmentLabelSet.set(it.equipmentLabel, it.equipmentLabel)
    }
  }
  const equipmentOptions = [...equipmentLabelSet.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((label) => ({ value: label, label }))

  return {
    items,
    equipmentOptions,
    countsByKind,
    countsByAvailability,
  }
}
