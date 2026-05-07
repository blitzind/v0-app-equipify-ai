import { NextResponse } from "next/server"
import {
  buildCompletedCertificatePdfHtml,
  loadCompletedCertificateItemByRecordId,
} from "@/lib/calibration-certificates"
import { canPortalDownloadCertificate } from "@/lib/portal/portal-certificate-items"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { recordId } = await context.params
  if (!UUID_RE.test(recordId)) {
    return NextResponse.json({ error: "Invalid certificate id." }, { status: 400 })
  }

  const { svc, portalUser } = ctx
  const orgId = portalUser.organization_id
  const custId = portalUser.customer_id

  const allowed = await canPortalDownloadCertificate(svc, orgId, custId, recordId)
  if (!allowed) {
    return NextResponse.json(
      {
        error: "certificate_locked",
        message: "This certificate is not available for download yet.",
      },
      { status: 403 },
    )
  }

  try {
    const item = await loadCompletedCertificateItemByRecordId(svc, orgId, recordId)
    if (!item) {
      return NextResponse.json({ error: "Certificate not found." }, { status: 404 })
    }

    const html = await buildCompletedCertificatePdfHtml(svc, item)
    const safeName = `certificate-${item.workOrderLabel.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 40) || "record"}.html`

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not build certificate."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
