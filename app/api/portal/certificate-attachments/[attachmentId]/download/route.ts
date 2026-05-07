import { NextResponse } from "next/server"
import { canPortalDownloadCertificate } from "@/lib/portal/portal-certificate-items"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { resolvePortalDocumentScope } from "@/lib/portal/portal-document-scope"
import { getRequestMeta, requirePortalSession } from "@/lib/portal/require-portal-session"
import { signedUrlForAttachmentPath } from "@/lib/work-orders/work-order-tab-data"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Customer Portal Document Library — uploaded certificate attachments.
 *
 * Strict release gate (unchanged from Phase 1 in single-customer mode):
 *   1. Portal session is required.
 *   2. The attachment must belong to a calibration record (parent cert).
 *   3. The owning work order must belong to a customer the portal session
 *      is allowed to see — by default just the portal user's own customer
 *      (`scope.customerIds = [self]`), or, when consolidated visibility
 *      is explicitly enabled (Phase 2), any descendant customer.
 *   4. The parent calibration record must be unlocked under the existing
 *      `canPortalDownloadCertificate` policy *for the actual owning
 *      customer*. We never invent a new release rule here.
 *
 * We redirect to a short-lived signed Supabase Storage URL rather than
 * streaming the file through Node, mirroring the existing portal
 * certificate download flow (server-vetted gate + client-fetched
 * payload). Telemetry is emitted server-side and never includes the
 * signed URL or the underlying storage path.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { attachmentId } = await context.params
  if (!UUID_RE.test(attachmentId)) {
    return NextResponse.json({ error: "Invalid attachment id." }, { status: 400 })
  }

  const { svc, portalUser } = ctx
  const orgId = portalUser.organization_id

  const scope = await resolvePortalDocumentScope(svc, {
    organizationId: orgId,
    rootCustomerId: portalUser.customer_id,
  })
  const allowedCustomerIds = new Set(scope.customerIds)

  const { data: attRow, error: attErr } = await svc
    .from("certificate_attachments")
    .select(
      "id, work_order_id, calibration_record_id, storage_path, file_name, file_type",
    )
    .eq("organization_id", orgId)
    .eq("id", attachmentId)
    .maybeSingle()

  if (attErr) {
    // 42P01 / "does not exist" — the table isn't in this database yet.
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 })
  }
  const att = attRow as
    | {
        id: string
        work_order_id: string
        calibration_record_id: string | null
        storage_path: string
        file_name: string
        file_type: string
      }
    | null
  if (!att) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 })
  }

  if (!att.calibration_record_id) {
    return NextResponse.json(
      {
        error: "attachment_locked",
        message: "This attachment is not available in the portal yet.",
      },
      { status: 403 },
    )
  }

  // Verify the work order belongs to a customer in the portal session's scope.
  const { data: wo } = await svc
    .from("work_orders")
    .select("customer_id")
    .eq("organization_id", orgId)
    .eq("id", att.work_order_id)
    .maybeSingle()

  const woCustomerId = (wo as { customer_id?: string | null } | null)?.customer_id ?? null
  if (!woCustomerId || !allowedCustomerIds.has(woCustomerId)) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 })
  }

  // Existing parent-certificate release evaluation, run against the
  // *actual owning customer* — not the portal session customer — so the
  // release rule keeps applying correctly under rollup.
  const allowed = await canPortalDownloadCertificate(
    svc,
    orgId,
    woCustomerId,
    att.calibration_record_id,
  )
  if (!allowed) {
    return NextResponse.json(
      {
        error: "attachment_locked",
        message: "This attachment is not yet available for download.",
      },
      { status: 403 },
    )
  }

  const signed = await signedUrlForAttachmentPath(svc, att.storage_path, 600)
  if (!signed) {
    return NextResponse.json(
      { error: "Could not build download URL." },
      { status: 502 },
    )
  }

  // Telemetry — log AFTER the gate has been cleared, never include the
  // signed URL or the storage path.
  const meta = await getRequestMeta()
  void logPortalActivity(svc, {
    organizationId: orgId,
    portalUserId: portalUser.id,
    action: "portal_document_download",
    path: "/api/portal/certificate-attachments/:id/download",
    resourceType: "certificate_attachment",
    metadata: {
      kind: "certificate_attachment",
      source_category: "calibration",
      file_type: att.file_type ?? null,
      cross_account: woCustomerId !== portalUser.customer_id,
      rollup_enabled: scope.rollupEnabled,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.redirect(signed, { status: 302 })
}
