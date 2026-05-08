import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import {
  ATTACHMENT_ENTITY_TYPES,
  ATTACHMENT_TYPES,
  ATTACHMENT_VISIBILITY_SCOPES,
  DOCUMENT_ATTACHMENT_SELECT,
  DOCUMENT_ATTACHMENTS_BUCKET,
  releaseStatusForVisibility,
  sanitizeAttachmentFileName,
  validateDocumentAttachmentFile,
  type AttachmentEntityType,
  type AttachmentType,
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

function validEntity(entityType: string | null, entityId: string | null) {
  return Boolean(entityType && ATTACHMENT_ENTITY_TYPES.has(entityType as AttachmentEntityType) && entityId && UUID_RE.test(entityId))
}

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid organization id." }, { status: 400 })
  }
  const gate = await requireOrgAccess(organizationId)
  if ("error" in gate) return gate.error

  const url = new URL(request.url)
  const entityType = url.searchParams.get("entityType")
  const entityId = url.searchParams.get("entityId")
  if (!validEntity(entityType, entityId)) {
    return NextResponse.json({ error: "invalid_request", message: "Provide a supported related entity." }, { status: 400 })
  }

  const { data, error } = await gate.svc
    .from("org_document_attachments")
    .select(DOCUMENT_ATTACHMENT_SELECT)
    .eq("organization_id", organizationId)
    .eq("related_entity_type", entityType)
    .eq("related_entity_id", entityId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })

  if (error) return NextResponse.json({ error: "load_failed", message: error.message }, { status: 500 })
  return NextResponse.json({ attachments: data ?? [] })
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid organization id." }, { status: 400 })
  }
  const gate = await requireOrgAccess(organizationId, true)
  if ("error" in gate) return gate.error

  const form = await request.formData()
  const file = form.get("file")
  const entityType = String(form.get("entityType") ?? "")
  const entityId = String(form.get("entityId") ?? "")
  const attachmentTypeRaw = String(form.get("attachmentType") ?? "document") as AttachmentType
  const visibilityRaw = String(form.get("visibilityScope") ?? "internal") as AttachmentVisibilityScope
  const sourceSystem = String(form.get("sourceSystem") ?? "").trim()

  if (!validEntity(entityType, entityId)) {
    return NextResponse.json({ error: "invalid_request", message: "Provide a supported related entity." }, { status: 400 })
  }
  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ error: "invalid_file", message: "Choose a file to upload." }, { status: 400 })
  }
  const validation = validateDocumentAttachmentFile(file)
  if (validation) {
    return NextResponse.json({ error: "invalid_file", message: validation }, { status: 400 })
  }

  const attachmentType = ATTACHMENT_TYPES.has(attachmentTypeRaw) ? attachmentTypeRaw : "document"
  const visibilityScope = ATTACHMENT_VISIBILITY_SCOPES.has(visibilityRaw) ? visibilityRaw : "internal"
  const portalReleaseStatus = releaseStatusForVisibility(visibilityScope)
  const now = new Date().toISOString()
  const mime = (file.type || "application/octet-stream").toLowerCase()
  const safeName = sanitizeAttachmentFileName(file.name)
  const storagePath = `${organizationId}/documents/${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await gate.svc.storage.from(DOCUMENT_ATTACHMENTS_BUCKET).upload(storagePath, buffer, {
    cacheControl: "3600",
    upsert: false,
    contentType: mime,
  })
  if (uploadError) {
    return NextResponse.json({ error: "upload_failed", message: uploadError.message }, { status: 500 })
  }

  const { data, error } = await gate.svc
    .from("org_document_attachments")
    .insert({
      organization_id: organizationId,
      attachment_type: attachmentType,
      storage_bucket: DOCUMENT_ATTACHMENTS_BUCKET,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: mime,
      file_size_bytes: file.size,
      uploaded_by: gate.userId,
      visibility_scope: visibilityScope,
      related_entity_type: entityType,
      related_entity_id: entityId,
      portal_visible: visibilityScope !== "internal",
      portal_release_status: portalReleaseStatus,
      source_system: sourceSystem || null,
      released_at: portalReleaseStatus === "released" ? now : null,
      released_by: portalReleaseStatus === "released" ? gate.userId : null,
      withheld_reason:
        portalReleaseStatus === "internal"
          ? "Internal only"
          : portalReleaseStatus === "withheld_invoice_unpaid"
            ? "Invoice unpaid"
            : portalReleaseStatus === "pending"
              ? "Manual release required"
              : null,
      metadata_json: {
        source: "unified_attachment_upload",
      },
    })
    .select(DOCUMENT_ATTACHMENT_SELECT)
    .maybeSingle()

  if (error || !data) {
    await gate.svc.storage.from(DOCUMENT_ATTACHMENTS_BUCKET).remove([storagePath])
    return NextResponse.json({ error: "insert_failed", message: error?.message ?? "Attachment was not saved." }, { status: 500 })
  }

  return NextResponse.json({ attachment: data })
}
