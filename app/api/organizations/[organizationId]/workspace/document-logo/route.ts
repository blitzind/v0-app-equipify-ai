import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { PlanId } from "@/lib/plans"
import {
  ORGANIZATION_LOGOS_BUCKET,
  pathFromOrganizationLogoPublicUrl,
} from "@/lib/organization/logo-storage"
import { processDocumentLogoRaster } from "@/lib/organization/process-logos"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Larger allowance for wide raster originals (processed output stays bounded). */
const MAX_BYTES = 4 * 1024 * 1024
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
      return jsonError("forbidden", "Only owners and admins can upload a document logo.", 403)
    }
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File) || file.size < 1) {
    return jsonError("invalid_file", "Choose an image file to upload.", 400)
  }
  if (file.size > MAX_BYTES) {
    return jsonError("file_too_large", "Document logo must be 4MB or smaller.", 400)
  }

  const mime = (file.type || "application/octet-stream").toLowerCase()
  if (!ALLOWED.has(mime)) {
    return jsonError("invalid_type", "Use PNG, JPG, WebP, GIF, or SVG.", 400)
  }

  const svc = platformAdmin ? createServiceRoleClient() : null
  if (platformAdmin && !svc) {
    return jsonError("service_unavailable", "Upload is not configured on this server.", 503)
  }

  const db = svc ?? supabase

  const { data: orgRow, error: orgErr } = await db
    .from("organizations")
    .select("id, status, document_logo_url")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !orgRow) {
    return jsonError("not_found", "Organization not found.", 404)
  }
  if ((orgRow as { status?: string }).status === "archived") {
    return jsonError("org_archived", "This workspace is archived.", 403)
  }

  const { data: sub } = await db.from("organization_subscriptions").select("plan_id").eq("organization_id", organizationId).maybeSingle()

  const planId = normalizePlanIdForRead((sub as { plan_id?: string } | null)?.plan_id ?? "solo")
  if (!planAllowsBranding(planId)) {
    return jsonError("plan_branding", "Document logo is available on Growth and Scale plans.", 403)
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
    return jsonError("process_failed", msg, 400)
  }

  const path = `${organizationId}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await db.storage.from(ORGANIZATION_LOGOS_BUCKET).upload(path, uploadBody, {
    contentType: uploadContentType,
    cacheControl: "3600",
    upsert: false,
  })

  if (upErr) {
    return jsonError("upload_failed", upErr.message, 400)
  }

  const { data: pub } = db.storage.from(ORGANIZATION_LOGOS_BUCKET).getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { error: dbErr } = await db
    .from("organizations")
    .update({ document_logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", organizationId)

  if (dbErr) {
    await db.storage.from(ORGANIZATION_LOGOS_BUCKET).remove([path])
    return jsonError("save_failed", dbErr.message ?? "Could not save document logo URL.", 400)
  }

  if (prevPath) {
    await db.storage.from(ORGANIZATION_LOGOS_BUCKET).remove([prevPath])
  }

  return NextResponse.json({ ok: true, documentLogoUrl: publicUrl })
}
