import { NextResponse } from "next/server"

import { requireOrgPermissionFromRequest } from "@/lib/api/require-org-permission"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { isDemoWorkspaceOrganization } from "@/lib/demo-workspace/is-demo-workspace-organization"
import { logProspectBusinessCardScanAudit } from "@/lib/prospects/prospect-business-card-scan-audit"
import { extractProspectFieldsFromBusinessCardUpload } from "@/lib/prospects/prospect-business-card-scan"

export const runtime = "nodejs"
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonFailure(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status })
}

/**
 * POST /api/organizations/{org}/prospects/business-card-scan
 *
 * Multipart business card image upload for AI prospect field extraction.
 * Body: `multipart/form-data` with field `file` (jpg/jpeg/png/heic, max 10MB).
 *
 * - No image or OCR persistence.
 * - Owner/admin/manager only (`canManageProspects`).
 * - Growth+ AI entitlement.
 * - Demo workspace blocked.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const started = Date.now()
  const { organizationId } = await context.params

  if (!UUID_RE.test(organizationId)) {
    return jsonFailure("bad_request", "Invalid workspace identifier.", 400)
  }

  const gate = await requireOrgPermissionFromRequest(request, organizationId, "canManageProspects")
  if ("error" in gate) return gate.error

  const { supabase, userId, isPlatformAdmin } = gate

  if (await isDemoWorkspaceOrganization(supabase, organizationId)) {
    await logProspectBusinessCardScanAudit({
      supabase,
      organizationId,
      userId,
      success: false,
      failureReason: "demo_mode_blocked",
      durationMs: Date.now() - started,
    })
    return jsonFailure(
      "demo_mode_blocked",
      "Business card scanning is unavailable in demo mode. Sign in with a live workspace to use AI prospect tools.",
      403,
    )
  }

  if (!isPlatformAdmin) {
    const planGate = await requireFeatureAccess(supabase, organizationId, "ai")
    if (!planGate.ok) {
      await logProspectBusinessCardScanAudit({
        supabase,
        organizationId,
        userId,
        success: false,
        failureReason: "NO_AI_ACCESS",
        durationMs: Date.now() - started,
      })
      return jsonFailure(
        "NO_AI_ACCESS",
        "Business card scanning is available on Growth, Scale, and Enterprise plans. Upgrade in billing to unlock AI prospect tools.",
        planGate.httpStatus,
      )
    }
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    await logProspectBusinessCardScanAudit({
      supabase,
      organizationId,
      userId,
      success: false,
      failureReason: "multipart_parse_failed",
      durationMs: Date.now() - started,
    })
    return jsonFailure(
      "UNSUPPORTED_FILE",
      "Could not read the upload. The file may be too large or the connection was interrupted.",
      400,
    )
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    await logProspectBusinessCardScanAudit({
      supabase,
      organizationId,
      userId,
      success: false,
      failureReason: "missing_file",
      durationMs: Date.now() - started,
    })
    return jsonFailure("UNSUPPORTED_FILE", "Please choose an image to upload.", 400)
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(await file.arrayBuffer())
  } catch {
    await logProspectBusinessCardScanAudit({
      supabase,
      organizationId,
      userId,
      success: false,
      failureReason: "buffer_read_failed",
      durationMs: Date.now() - started,
    })
    return jsonFailure("INVALID_IMAGE", "Could not read the uploaded image.", 400)
  }

  const result = await extractProspectFieldsFromBusinessCardUpload({
    organizationId,
    buffer,
    fileName: file.name || "business-card.jpg",
  })

  await logProspectBusinessCardScanAudit({
    supabase,
    organizationId,
    userId,
    success: result.ok,
    failureReason: result.ok ? null : result.code,
    durationMs: Date.now() - started,
  })

  if (!result.ok) {
    const status =
      result.code === "NO_AI_ACCESS"
        ? 403
        : result.code === "RATE_LIMITED"
          ? 429
          : result.code === "AI_UNAVAILABLE"
            ? 503
            : 400
    return jsonFailure(result.code, result.message, status)
  }

  return NextResponse.json({ ok: true, fields: result.fields })
}
