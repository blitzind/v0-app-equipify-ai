import { NextResponse } from "next/server"
import { canPortalDownloadCertificate } from "@/lib/portal/portal-certificate-items"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { signedUrlForAttachmentPath } from "@/lib/work-orders/work-order-tab-data"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Customer Portal Document Library — Phase 1
 *
 * Streams a short-lived signed URL for an uploaded certificate
 * attachment. Strict release gate:
 *   1. Portal session is required.
 *   2. The attachment must belong to a calibration record (parent cert).
 *   3. The parent calibration record must be unlocked under the existing
 *      `canPortalDownloadCertificate` policy. We never invent a new
 *      release rule here — the same payment / manual / immediate logic
 *      that gates the certificate's own download gates this attachment.
 *   4. The owning work order must belong to the portal user's customer.
 *
 * We intentionally redirect to a short-lived signed Supabase Storage URL
 * rather than streaming the file through the Node runtime, mirroring
 * how the existing portal certificate download already works
 * (server-vetted gate + client-fetched payload).
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
  const custId = portalUser.customer_id

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

  // Phase 1: portal can only see attachments tied to a parent calibration
  // record. Anything else is outside the established release model.
  if (!att.calibration_record_id) {
    return NextResponse.json(
      {
        error: "attachment_locked",
        message: "This attachment is not available in the portal yet.",
      },
      { status: 403 },
    )
  }

  // Verify the work order belongs to this customer (mirrors the existing
  // portal certificate download flow).
  const { data: wo } = await svc
    .from("work_orders")
    .select("customer_id")
    .eq("organization_id", orgId)
    .eq("id", att.work_order_id)
    .maybeSingle()

  if (!wo || (wo as { customer_id: string }).customer_id !== custId) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 })
  }

  // Reuse the existing parent-certificate release evaluation — no new gate.
  const allowed = await canPortalDownloadCertificate(
    svc,
    orgId,
    custId,
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

  return NextResponse.redirect(signed, { status: 302 })
}
