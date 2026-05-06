import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { PlanId } from "@/lib/plans"
import {
  ORGANIZATION_LOGOS_BUCKET,
  pathFromOrganizationLogoPublicUrl,
} from "@/lib/organization/logo-storage"
import { processAppBrandingSquare } from "@/lib/organization/process-logos"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"])
const RASTER_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status })
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
    return jsonError("invalid_organization", "Invalid organization.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return jsonError("unauthorized", "Sign in required.", 401)
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
      return jsonError("forbidden", "Only owners and admins can upload a workspace logo.", 403)
    }
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File) || file.size < 1) {
    return jsonError("invalid_file", "Choose an image file to upload.", 400)
  }
  if (file.size > MAX_BYTES) {
    return jsonError("file_too_large", "Logo must be 2MB or smaller.", 400)
  }

  const mime = (file.type || "application/octet-stream").toLowerCase()
  if (!ALLOWED.has(mime)) {
    return jsonError("invalid_type", "Use PNG, JPG, WebP, GIF, or SVG.", 400)
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch (e) {
    logLogoRoute("service_role_missing", {
      organizationId,
      userId: user.id,
      err: e instanceof Error ? e.message : String(e),
    })
    return jsonError(
      "service_unavailable",
      "Server is missing SUPABASE_SERVICE_ROLE_KEY; logo upload cannot persist.",
      503,
    )
  }

  const { data: orgRow, error: orgErr } = await svc
    .from("organizations")
    .select("id, status, logo_url")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !orgRow) {
    logLogoRoute("load_org_failed", {
      organizationId,
      message: orgErr?.message,
      code: orgErr?.code,
    })
    return jsonError("not_found", "Organization not found.", 404)
  }
  if ((orgRow as { status?: string }).status === "archived") {
    return jsonError("org_archived", "This workspace is archived.", 403)
  }

  const { data: sub } = await svc
    .from("organization_subscriptions")
    .select("plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const planId = normalizePlanIdForRead((sub as { plan_id?: string } | null)?.plan_id ?? "solo")
  if (!planAllowsBranding(planId)) {
    return jsonError("plan_branding", "Custom logo is available on Growth and Scale plans.", 403)
  }

  const prevPath = pathFromOrganizationLogoPublicUrl((orgRow as { logo_url?: string | null }).logo_url)

  const buf = Buffer.from(await file.arrayBuffer())
  let uploadBody: Buffer = buf
  let uploadContentType = mime
  let ext = "png"

  try {
    if (mime === "image/svg+xml") {
      try {
        uploadBody = await processAppBrandingSquare(buf)
        uploadContentType = "image/png"
        ext = "png"
      } catch {
        uploadBody = buf
        uploadContentType = "image/svg+xml"
        ext = "svg"
      }
    } else if (RASTER_MIMES.has(mime)) {
      uploadBody = await processAppBrandingSquare(buf)
      uploadContentType = "image/png"
      ext = "png"
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not process image."
    logLogoRoute("process_image_failed", { organizationId, message: msg })
    return jsonError("process_failed", msg, 400)
  }

  const path = `${organizationId}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await svc.storage.from(ORGANIZATION_LOGOS_BUCKET).upload(path, uploadBody, {
    contentType: uploadContentType,
    cacheControl: "3600",
    upsert: false,
  })

  if (upErr) {
    logLogoRoute("storage_upload_failed", {
      organizationId,
      path,
      message: upErr.message,
    })
    return jsonError("upload_failed", upErr.message, 400)
  }

  const { data: pub } = svc.storage.from(ORGANIZATION_LOGOS_BUCKET).getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { data: updatedOrg, error: dbErr } = await svc
    .from("organizations")
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", organizationId)
    .select("id, logo_url")
    .single()

  if (dbErr || !updatedOrg) {
    await svc.storage.from(ORGANIZATION_LOGOS_BUCKET).remove([path])
    logLogoRoute("org_update_failed", {
      organizationId,
      message: dbErr?.message,
      code: dbErr?.code,
      details: dbErr?.details,
    })
    return jsonError("save_failed", dbErr?.message ?? "Could not save logo URL.", 500)
  }

  if (prevPath) {
    const { error: rmErr } = await svc.storage.from(ORGANIZATION_LOGOS_BUCKET).remove([prevPath])
    if (rmErr) {
      logLogoRoute("remove_previous_logo_failed", { organizationId, path: prevPath, message: rmErr.message })
    }
  }

  return NextResponse.json({ ok: true, logoUrl: publicUrl })
}
