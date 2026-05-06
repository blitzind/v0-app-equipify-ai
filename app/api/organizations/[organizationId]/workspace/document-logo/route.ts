import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { PlanId } from "@/lib/plans"
import {
  getOrganizationLogosBucket,
  pathFromOrganizationLogoPublicUrl,
} from "@/lib/organization/logo-storage"
import {
  logoRouteJsonError,
  logoUploadVerboseLogs,
  normalizePublicUrl,
} from "@/lib/organization/logo-upload-route-shared"
import { processDocumentLogoRaster } from "@/lib/organization/process-logos"
import { serializeWorkspaceOrganization } from "@/lib/organization/workspace-org-serialize"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Larger allowance for wide raster originals (processed output stays bounded). */
const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"])
const RASTER_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

function logDocLogoRoute(context: string, payload: Record<string, unknown>) {
  console.error(`[workspace/document-logo] ${context}`, payload)
}

function planAllowsBranding(planId: PlanId): boolean {
  return planId === "growth" || planId === "scale"
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return logoRouteJsonError("invalid_organization", "Invalid organization.", 400, { step: "validate_org_id" })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return logoRouteJsonError("unauthorized", "Sign in required.", 401, { step: "auth_session" })
  }

  const platformAdmin = isPlatformAdminEmail(user.email)

  if (!platformAdmin) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem || (mem.role !== "owner" && mem.role !== "admin")) {
      return logoRouteJsonError(
        "forbidden",
        "Only owners and admins can upload a document logo.",
        403,
        { step: "auth_membership" },
      )
    }
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File) || file.size < 1) {
    return logoRouteJsonError("invalid_file", "Choose an image file to upload.", 400, { step: "parse_formdata" })
  }
  if (file.size > MAX_BYTES) {
    return logoRouteJsonError("file_too_large", "Document logo must be 4MB or smaller.", 400, { step: "validate_file" })
  }

  const mime = (file.type || "application/octet-stream").toLowerCase()
  if (!ALLOWED.has(mime)) {
    return logoRouteJsonError("invalid_type", "Use PNG, JPG, WebP, GIF, or SVG.", 400, { step: "validate_file" })
  }

  const bucket = getOrganizationLogosBucket()
  if (logoUploadVerboseLogs()) {
    console.info("[workspace/document-logo] request", {
      organizationId,
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      mime,
      bucket,
    })
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch (e) {
    logDocLogoRoute("service_role_missing", {
      organizationId,
      userId: user.id,
      err: e instanceof Error ? e.message : String(e),
    })
    return logoRouteJsonError(
      "service_unavailable",
      e instanceof Error ? e.message : "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
      503,
      { step: "service_role_client", details: e instanceof Error ? e.message : null },
    )
  }

  const { data: orgRow, error: orgErr } = await svc
    .from("organizations")
    .select("id, status, document_logo_url")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr) {
    logDocLogoRoute("load_org_failed", {
      organizationId,
      message: orgErr.message,
      code: orgErr.code,
    })
    return logoRouteJsonError("load_failed", orgErr.message, 500, {
      step: "load_org",
      details: orgErr.code,
    })
  }
  if (!orgRow) {
    return logoRouteJsonError("not_found", "Organization not found.", 404, { step: "load_org" })
  }
  if ((orgRow as { status?: string }).status === "archived") {
    return logoRouteJsonError("org_archived", "This workspace is archived.", 403, { step: "load_org" })
  }

  const { data: sub } = await svc
    .from("organization_subscriptions")
    .select("plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const planId = normalizePlanIdForRead((sub as { plan_id?: string } | null)?.plan_id ?? "solo")
  if (!planAllowsBranding(planId)) {
    return logoRouteJsonError(
      "plan_branding",
      "Document logo is available on Growth and Scale plans.",
      403,
      { step: "plan_check", details: planId },
    )
  }

  const prevPath = pathFromOrganizationLogoPublicUrl((orgRow as { document_logo_url?: string | null }).document_logo_url)

  const buf = Buffer.from(await file.arrayBuffer())
  let uploadBody: Buffer = buf
  let uploadContentType = mime
  let ext =
    mime === "image/svg+xml"
      ? "svg"
      : mime === "image/jpeg"
        ? "jpg"
        : mime === "image/gif"
          ? "gif"
          : mime === "image/webp"
            ? "webp"
            : "png"

  try {
    if (RASTER_MIMES.has(mime)) {
      uploadBody = await processDocumentLogoRaster(buf)
      uploadContentType = "image/png"
      ext = "png"
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not process image."
    logDocLogoRoute("process_image_failed", { organizationId, message: msg })
    return logoRouteJsonError("process_failed", msg, 400, {
      step: "process_image",
      details: e instanceof Error ? e.name : null,
    })
  }

  const path = `${organizationId}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await svc.storage.from(bucket).upload(path, uploadBody, {
    contentType: uploadContentType,
    cacheControl: "3600",
    upsert: false,
  })

  if (upErr) {
    logDocLogoRoute("storage_upload_failed", {
      organizationId,
      bucket,
      path,
      message: upErr.message,
    })
    return logoRouteJsonError("upload_failed", upErr.message, 400, {
      step: "storage_upload",
      details: "Confirm bucket exists and service role can write Storage.",
    })
  }

  const { data: pub } = svc.storage.from(bucket).getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { data: updatedOrg, error: dbErr } = await svc
    .from("organizations")
    .update({ document_logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", organizationId)
    .select("*")
    .single()

  if (dbErr || !updatedOrg) {
    await svc.storage.from(bucket).remove([path])
    logDocLogoRoute("org_update_failed", {
      organizationId,
      message: dbErr?.message,
      code: dbErr?.code,
      details: dbErr?.details,
    })
    return logoRouteJsonError("save_failed", dbErr?.message ?? "Could not save document logo URL.", 500, {
      step: "db_update",
      details: dbErr?.code ?? null,
    })
  }

  const serializedCheck = serializeWorkspaceOrganization(updatedOrg as Record<string, unknown>)
  if (normalizePublicUrl(serializedCheck.documentLogoUrl) !== normalizePublicUrl(publicUrl)) {
    await svc.storage.from(bucket).remove([path])
    logDocLogoRoute("verify_failed", {
      organizationId,
      expected: publicUrl,
      gotFromRow: serializedCheck.documentLogoUrl,
    })
    return logoRouteJsonError(
      "verify_failed",
      "organizations.document_logo_url did not match after UPDATE (check schema and triggers).",
      500,
      {
        step: "verify_db_row",
        details: serializedCheck.documentLogoUrl || "(empty)",
      },
    )
  }

  const { data: verifyRow } = await svc
    .from("organizations")
    .select("logo_url, document_logo_url")
    .eq("id", organizationId)
    .maybeSingle()

  const rereadDoc = String((verifyRow as { document_logo_url?: string | null } | null)?.document_logo_url ?? "").trim()

  if (prevPath) {
    const { error: rmErr } = await svc.storage.from(bucket).remove([prevPath])
    if (rmErr) {
      logDocLogoRoute("remove_previous_doc_logo_failed", {
        organizationId,
        path: prevPath,
        message: rmErr.message,
      })
    }
  }

  const serialized = serializeWorkspaceOrganization(updatedOrg as Record<string, unknown>)

  if (logoUploadVerboseLogs()) {
    console.info("[workspace/document-logo] complete", {
      organizationId,
      userId: user.id,
      bucket,
      storagePath: path,
      publicUrl,
      logoUrl: serialized.logoUrl,
      documentLogoUrl: serialized.documentLogoUrl,
      secondSelectDocumentLogoUrl: rereadDoc,
    })
  }

  const payload: Record<string, unknown> = {
    ok: true,
    logoUrl: serialized.logoUrl,
    documentLogoUrl: publicUrl,
    organization: serialized,
    savedVerified: true,
  }
  if (logoUploadVerboseLogs()) {
    payload.debug = { bucket, storagePath: path, organizationsRowDocumentLogoUrl: rereadDoc }
  }

  return NextResponse.json(payload)
}
