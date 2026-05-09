import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getEffectiveOrgPermissions, getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import { canAccessAssignedAttachmentEntity } from "@/lib/permissions/technician-scope"
import {
  ATTACHMENT_VISIBILITY_SCOPES,
  DOCUMENT_ATTACHMENT_SELECT,
  releaseStatusForVisibility,
  type AttachmentVisibilityScope,
} from "@/lib/attachments/document-attachments"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function requireOrgAccess(organizationId: string, write = false) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { error: NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 }) }
  }

  const platformAdmin = isPlatformAdminEmail(user.email)
  let permissions = getOrgPermissionsForRole("owner")
  if (!platformAdmin) {
    const { data: mem, error } = await supabase
      .from("organization_members")
      .select("role, permission_profile, permissions_json")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    const role = (mem as { role?: string | null } | null)?.role ?? null
    permissions = getEffectiveOrgPermissions({
      role: normalizeOrgMemberRole(role),
      permissionProfile: (mem as { permission_profile?: string | null } | null)?.permission_profile ?? null,
      permissionsJson: (mem as { permissions_json?: unknown } | null)?.permissions_json ?? null,
    })
    if (error || !role || (write && !permissions.canUploadCertificateAttachments && !permissions.canReleaseCertificatesToPortal)) {
      return { error: NextResponse.json({ error: "forbidden", message: "You do not have access to this workspace." }, { status: 403 }) }
    }
  }

  return { userId: user.id, svc: createServiceRoleSupabaseClient(), permissions }
}

async function requireAttachmentAccess(
  gate: { userId: string; svc: ReturnType<typeof createServiceRoleSupabaseClient>; permissions: ReturnType<typeof getOrgPermissionsForRole> },
  organizationId: string,
  attachmentId: string,
) {
  const { data, error } = await gate.svc
    .from("org_document_attachments")
    .select("storage_bucket, storage_path, related_entity_type, related_entity_id")
    .eq("organization_id", organizationId)
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error || !data) return null
  const row = data as {
    storage_bucket: string
    storage_path: string
    related_entity_type: string
    related_entity_id: string
  }
  const allowed = await canAccessAssignedAttachmentEntity(gate.svc, {
    organizationId,
    userId: gate.userId,
    permissions: gate.permissions,
    entityType: row.related_entity_type,
    entityId: row.related_entity_id,
  })
  return allowed ? row : null
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; attachmentId: string }> },
) {
  const { organizationId, attachmentId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(attachmentId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireOrgAccess(organizationId)
  if ("error" in gate) return gate.error

  const row = await requireAttachmentAccess(gate, organizationId, attachmentId)
  if (!row) return NextResponse.json({ error: "not_found", message: "Attachment not found." }, { status: 404 })
  const { data: signed, error: signedErr } = await gate.svc.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, 600)
  if (signedErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "download_failed", message: "Could not create a secure download URL." }, { status: 502 })
  }
  return NextResponse.redirect(signed.signedUrl, { status: 302 })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; attachmentId: string }> },
) {
  const { organizationId, attachmentId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(attachmentId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireOrgAccess(organizationId, true)
  if ("error" in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  const visibilityRaw = String((body as { visibilityScope?: unknown }).visibilityScope ?? "") as AttachmentVisibilityScope
  if (!ATTACHMENT_VISIBILITY_SCOPES.has(visibilityRaw)) {
    return NextResponse.json({ error: "invalid_request", message: "Unsupported visibility state." }, { status: 400 })
  }
  if (!gate.permissions.canReleaseCertificatesToPortal) {
    return NextResponse.json(
      { error: "insufficient_permissions", message: "You do not have permission to change portal visibility." },
      { status: 403 },
    )
  }
  const existing = await requireAttachmentAccess(gate, organizationId, attachmentId)
  if (!existing) return NextResponse.json({ error: "not_found", message: "Attachment not found." }, { status: 404 })

  const releaseStatus = releaseStatusForVisibility(visibilityRaw)
  const now = new Date().toISOString()
  const { data, error } = await gate.svc
    .from("org_document_attachments")
    .update({
      visibility_scope: visibilityRaw,
      portal_visible: visibilityRaw !== "internal",
      portal_release_status: releaseStatus,
      released_at: releaseStatus === "released" ? now : null,
      released_by: releaseStatus === "released" ? gate.userId : null,
      revoked_at: releaseStatus === "internal" ? now : null,
      revoked_by: releaseStatus === "internal" ? gate.userId : null,
      withheld_reason:
        releaseStatus === "internal"
          ? "Internal only"
          : releaseStatus === "withheld_invoice_unpaid"
            ? "Invoice unpaid"
            : releaseStatus === "pending"
              ? "Manual release required"
              : null,
    })
    .eq("organization_id", organizationId)
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .select(DOCUMENT_ATTACHMENT_SELECT)
    .maybeSingle()

  if (error || !data) return NextResponse.json({ error: "update_failed", message: error?.message ?? "Attachment not found." }, { status: 500 })
  return NextResponse.json({ attachment: data })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ organizationId: string; attachmentId: string }> },
) {
  const { organizationId, attachmentId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(attachmentId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireOrgAccess(organizationId, true)
  if ("error" in gate) return gate.error

  const row = await requireAttachmentAccess(gate, organizationId, attachmentId)
  if (!row) return NextResponse.json({ error: "not_found", message: "Attachment not found." }, { status: 404 })
  const { error } = await gate.svc
    .from("org_document_attachments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: gate.userId })
    .eq("organization_id", organizationId)
    .eq("id", attachmentId)

  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 })
  await gate.svc.storage.from(row.storage_bucket).remove([row.storage_path])
  return NextResponse.json({ ok: true })
}
