import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import {
  ATTACHMENT_VISIBILITY_SCOPES,
  DOCUMENT_ATTACHMENT_SELECT,
  releaseStatusForVisibility,
  type AttachmentVisibilityScope,
} from "@/lib/attachments/document-attachments"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const WRITE_ROLES = new Set(["owner", "admin", "manager", "tech"])

async function requireOrgAccess(organizationId: string, write = false) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { error: NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 }) }
  }

  const platformAdmin = isPlatformAdminEmail(user.email)
  if (!platformAdmin) {
    const { data: mem, error } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    const role = (mem as { role?: string | null } | null)?.role ?? null
    if (error || !role || (write && !WRITE_ROLES.has(role))) {
      return { error: NextResponse.json({ error: "forbidden", message: "You do not have access to this workspace." }, { status: 403 }) }
    }
  }

  return { userId: user.id, svc: createServiceRoleSupabaseClient() }
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

  const { data, error } = await gate.svc
    .from("org_document_attachments")
    .select("storage_bucket, storage_path")
    .eq("organization_id", organizationId)
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error || !data) return NextResponse.json({ error: "not_found", message: "Attachment not found." }, { status: 404 })
  const row = data as { storage_bucket: string; storage_path: string }
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

  const { data: existing, error: fetchErr } = await gate.svc
    .from("org_document_attachments")
    .select("storage_bucket, storage_path")
    .eq("organization_id", organizationId)
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle()

  if (fetchErr || !existing) return NextResponse.json({ error: "not_found", message: "Attachment not found." }, { status: 404 })

  const row = existing as { storage_bucket: string; storage_path: string }
  const { error } = await gate.svc
    .from("org_document_attachments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: gate.userId })
    .eq("organization_id", organizationId)
    .eq("id", attachmentId)

  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 })
  await gate.svc.storage.from(row.storage_bucket).remove([row.storage_path])
  return NextResponse.json({ ok: true })
}
