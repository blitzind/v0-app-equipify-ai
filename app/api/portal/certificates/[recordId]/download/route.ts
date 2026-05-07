import { NextResponse } from "next/server"
import {
  buildCompletedCertificatePdfHtml,
  loadCompletedCertificateItemByRecordId,
} from "@/lib/calibration-certificates"
import { canPortalDownloadCertificate } from "@/lib/portal/portal-certificate-items"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { resolvePortalDocumentScope } from "@/lib/portal/portal-document-scope"
import { getRequestMeta, requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Portal certificate download.
 *
 * Phase 2: scope-aware via `resolvePortalDocumentScope`. In the default
 * single-customer scope this behaves identically to Phase 1 — the
 * existing release evaluation in `canPortalDownloadCertificate` is the
 * sole gate. When consolidated rollup is explicitly enabled for this
 * portal user / workspace, descendant-customer certificates become
 * eligible (release rule still applied unchanged against the actual
 * owning customer).
 */
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

  const scope = await resolvePortalDocumentScope(svc, {
    organizationId: orgId,
    rootCustomerId: portalUser.customer_id,
  })
  const allowedCustomerIds = new Set(scope.customerIds)

  // Resolve the record's owning customer via its work order, scoped to org.
  const { data: rec } = await svc
    .from("calibration_records")
    .select("work_order_id")
    .eq("organization_id", orgId)
    .eq("id", recordId)
    .maybeSingle()

  const recRow = rec as { work_order_id?: string | null } | null
  if (!recRow?.work_order_id) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 })
  }

  const { data: wo } = await svc
    .from("work_orders")
    .select("customer_id")
    .eq("organization_id", orgId)
    .eq("id", recRow.work_order_id)
    .maybeSingle()

  const woCustomerId = (wo as { customer_id?: string | null } | null)?.customer_id ?? null
  if (!woCustomerId || !allowedCustomerIds.has(woCustomerId)) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 })
  }

  // Existing release evaluation — unchanged. We pass the actual owning
  // customer so cross-account rollup downloads still go through the same
  // payment / manual / immediate logic as a same-account download would.
  const allowed = await canPortalDownloadCertificate(svc, orgId, woCustomerId, recordId)
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

    // Telemetry — only after the gate clears. No UUIDs, no signed URLs.
    const meta = await getRequestMeta()
    void logPortalActivity(svc, {
      organizationId: orgId,
      portalUserId: portalUser.id,
      action: "portal_document_download",
      path: "/api/portal/certificates/:id/download",
      resourceType: "certificate",
      metadata: {
        kind: "certificate",
        source_category: "calibration",
        cross_account: woCustomerId !== portalUser.customer_id,
        rollup_enabled: scope.rollupEnabled,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

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
