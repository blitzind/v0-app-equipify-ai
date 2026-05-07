import { NextResponse } from "next/server"
import { buildPortalDocuments } from "@/lib/portal/portal-documents"
import { resolvePortalDocumentScope } from "@/lib/portal/portal-document-scope"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { getRequestMeta, requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

/**
 * Customer Portal Document Library
 *
 * Phase 2: this route now resolves the consolidated visibility scope
 * (parent-account rollup), but the *single-customer* scope remains the
 * default. Cross-account access is only ever in effect when both the
 * org default and/or per-customer override explicitly enable it.
 *
 * - Reuses existing portal session/cookie auth.
 * - Reuses every per-domain release rule (invoices, certificates, work
 *   orders, certificate attachments) untouched.
 * - Logs an aggregate index-view event for telemetry without leaking
 *   any UUIDs or storage paths.
 */
export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  try {
    const scope = await resolvePortalDocumentScope(svc, {
      organizationId: portalUser.organization_id,
      rootCustomerId: portalUser.customer_id,
    })

    const result = await buildPortalDocuments(svc, {
      organizationId: portalUser.organization_id,
      customerIds: scope.customerIds,
      accountLabels: scope.accountLabels,
      rootCustomerId: scope.rootCustomerId,
      rollupEnabled: scope.rollupEnabled,
    })

    // Telemetry: index view. Only counts/scope flags — no UUIDs, no labels
    // that aren't already user-visible, no signed URLs.
    const meta = await getRequestMeta()
    void logPortalActivity(svc, {
      organizationId: portalUser.organization_id,
      portalUserId: portalUser.id,
      action: "portal_document_index_view",
      path: "/portal/documents",
      resourceType: "document_index",
      metadata: {
        rollup_enabled: scope.rollupEnabled,
        account_count: scope.customerIds.length,
        total_items: result.items.length,
        counts_by_kind: result.countsByKind,
        counts_by_availability: result.countsByAvailability,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load documents."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
