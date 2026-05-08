import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { resolvePortalDocumentScope } from "@/lib/portal/portal-document-scope"
import { getRequestMeta, requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function relatedCustomerId(
  svc: SupabaseClient,
  organizationId: string,
  entityType: string,
  entityId: string,
): Promise<string | null> {
  if (entityType === "customer") return entityId
  if (entityType === "invoice") {
    const { data } = await svc.from("org_invoices").select("customer_id").eq("organization_id", organizationId).eq("id", entityId).maybeSingle()
    return (data as { customer_id?: string | null } | null)?.customer_id ?? null
  }
  if (entityType === "work_order") {
    const { data } = await svc.from("work_orders").select("customer_id").eq("organization_id", organizationId).eq("id", entityId).maybeSingle()
    return (data as { customer_id?: string | null } | null)?.customer_id ?? null
  }
  if (entityType === "equipment") {
    const { data } = await svc.from("equipment").select("customer_id").eq("organization_id", organizationId).eq("id", entityId).maybeSingle()
    return (data as { customer_id?: string | null } | null)?.customer_id ?? null
  }
  if (entityType === "quote") {
    const { data } = await svc.from("org_quotes").select("customer_id").eq("organization_id", organizationId).eq("id", entityId).maybeSingle()
    return (data as { customer_id?: string | null } | null)?.customer_id ?? null
  }
  if (entityType === "calibration_record") {
    const { data } = await svc
      .from("calibration_records")
      .select("work_orders(customer_id)")
      .eq("organization_id", organizationId)
      .eq("id", entityId)
      .maybeSingle()
    const row = data as { work_orders?: { customer_id?: string | null } | null } | null
    return row?.work_orders?.customer_id ?? null
  }
  return null
}

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

  const { data } = await svc
    .from("org_document_attachments")
    .select("id, storage_bucket, storage_path, file_name, mime_type, related_entity_type, related_entity_id, portal_visible, portal_release_status")
    .eq("organization_id", orgId)
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle()

  const attachment = data as
    | {
        id: string
        storage_bucket: string
        storage_path: string
        file_name: string
        mime_type: string
        related_entity_type: string
        related_entity_id: string
        portal_visible: boolean
        portal_release_status: string
      }
    | null

  if (!attachment || !attachment.portal_visible || attachment.portal_release_status !== "released") {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 })
  }

  const customerId = await relatedCustomerId(svc, orgId, attachment.related_entity_type, attachment.related_entity_id)
  if (!customerId || !allowedCustomerIds.has(customerId)) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 })
  }

  const { data: signed } = await svc.storage.from(attachment.storage_bucket).createSignedUrl(attachment.storage_path, 600)
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Could not build download URL." }, { status: 502 })
  }

  const meta = await getRequestMeta()
  void logPortalActivity(svc, {
    organizationId: orgId,
    portalUserId: portalUser.id,
    action: "portal_document_download",
    path: "/api/portal/attachments/:id/download",
    resourceType: "attachment",
    metadata: {
      kind: "attachment",
      related_entity_type: attachment.related_entity_type,
      file_type: attachment.mime_type,
      cross_account: customerId !== portalUser.customer_id,
      rollup_enabled: scope.rollupEnabled,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.redirect(signed.signedUrl, { status: 302 })
}
